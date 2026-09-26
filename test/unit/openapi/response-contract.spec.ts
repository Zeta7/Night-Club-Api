/// <reference types="jest" />
import * as path from 'node:path';
import * as ts from 'typescript';
import type { OpenAPIObject } from '@nestjs/swagger';
type SchemaObject = Exclude<
  NonNullable<NonNullable<OpenAPIObject['components']>['schemas']>[string],
  { $ref: string }
>;

const { generateResponseSchemas } =
  require('../../../scripts/generate-openapi-response-schemas.cjs') as {
    generateResponseSchemas(program: ts.Program): { schemas: Record<string, SchemaObject> };
  };

function generate(methods: string) {
  const file = path.resolve('src/contract-fixture.controller.ts').replaceAll('\\', '/');
  const options: ts.CompilerOptions = {
    strict: true,
    experimentalDecorators: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    types: [],
  };
  const host = ts.createCompilerHost(options);
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (name, language, onError, createNew) =>
    name === file
      ? ts.createSourceFile(
          name,
          'declare function Get(): MethodDecorator; class FixtureController {' + methods + '}',
          language,
          true,
        )
      : original(name, language, onError, createNew);
  return generateResponseSchemas(ts.createProgram([file], options, host)).schemas;
}

describe('Response schema generation from source types', () => {
  it('keeps enums, nullable values, optional branches and nested arrays without field-name guesses', () => {
    const schemas = generate(`
      @Get() async detail(): Promise<{ id: number; email: string; date: Date; state: 'OPEN' | 'CLOSED'; nullableState: 'OPEN' | 'CLOSED' | null; note: string | null; optional?: string; items: { price: number }[] }> { throw new Error(); }
      @Get() branches(): { found: false } | { found: true; item: { name: string } } { throw new Error(); }
      @Get() timestamp() { return { value: new Date().toISOString() }; }
      @Get() collection(): { items: never[] } | { items: { id: string }[] } { throw new Error(); }
      @Get() amount(): { value: number;
/** @integer */
count: number } { throw new Error(); }
    `);
    expect(schemas.FixtureController_detailResponse).toMatchObject({
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'number' },
        email: { type: 'string' },
        date: { type: 'string', format: 'date-time' },
        state: { type: 'string', enum: ['OPEN', 'CLOSED'] },
        nullableState: { type: 'string', nullable: true, enum: ['OPEN', 'CLOSED', null] },
        note: { type: 'string', nullable: true },
        items: {
          type: 'array',
          items: { type: 'object', properties: { price: { type: 'number' } } },
        },
      },
      required: ['id', 'email', 'date', 'state', 'nullableState', 'note', 'items'],
    });
    expect(schemas.FixtureController_detailResponse.properties?.id).not.toHaveProperty('format');
    expect(schemas.FixtureController_detailResponse.properties?.email).not.toHaveProperty('format');
    expect(schemas.FixtureController_branchesResponse).toMatchObject({
      type: 'object',
      required: ['found'],
      properties: { found: { type: 'boolean', enum: [false, true] }, item: { type: 'object' } },
    });
    expect(schemas.FixtureController_branchesResponse).not.toHaveProperty('oneOf');
    expect(schemas.FixtureController_collectionResponse).toMatchObject({
      properties: { items: { items: { properties: { id: { type: 'string' } } } } },
    });
    expect(schemas.FixtureController_timestampResponse).toMatchObject({
      properties: { value: { type: 'string', format: 'date-time' } },
    });
    expect(schemas.FixtureController_amountResponse).toMatchObject({
      properties: { value: { type: 'number' }, count: { type: 'integer' } },
    });
  });

  it.each(['any', 'unknown'])(
    'rejects %s in a public response instead of publishing a dynamic fallback',
    (type) => {
      expect(() =>
        generate('@Get() detail(): { payload: ' + type + ' } { throw new Error(); }'),
      ).toThrow('Untyped response fields:');
    },
  );

  it.each(['never[]', 'null'])(
    'rejects incomplete %s response types before publication',
    (type) => {
      expect(() =>
        generate('@Get() detail(): { value: ' + type + ' } { throw new Error(); }'),
      ).toThrow('declare the type');
    },
  );
});
