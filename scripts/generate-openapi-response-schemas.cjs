const fs = require('node:fs');
const path = require('node:path');
const prettier = require('prettier');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const configFile = ts.readConfigFile(path.join(ROOT, 'tsconfig.json'), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, ROOT);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();
const schemas = {};
const errorCodes = {};

const HTTP_DECORATORS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete', 'Sse']);
const ERROR_HELPERS = {
  badRequest: '400',
  unauthorized: '401',
  forbidden: '403',
  notFound: '404',
  conflict: '409',
  serviceUnavailable: '503',
};
const NULLABLE_RESPONSE_PROPERTIES = new Set([
  'paymentAttemptId',
  'paymentStatus',
  'paymentProvider',
  'paymentMethod',
  'checkoutUrl',
  'approvedAt',
]);
const ORDER_STATUSES = [
  'PENDING',
  'PAID',
  'FAILED',
  'EXPIRED',
  'CANCELLED',
  'REFUND_PENDING',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
];
const PAYMENT_ATTEMPT_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
  'REFUND_PENDING',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
];
const ORDER_PAYMENT_METHODS = ['FLOW', 'BEERRY_WALLET', 'SIMULATED'];
const WALLET_TOP_UP_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'REFUND_PENDING',
  'REFUNDED',
  'CHARGEDBACK',
];
const PAYMENT_PROVIDERS = ['flow', 'simulated', 'beerry_wallet'];

function decoratorsOf(node) {
  return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
}

function decoratorName(decorator) {
  const expression = decorator.expression;
  if (ts.isCallExpression(expression)) {
    return ts.isIdentifier(expression.expression) ? expression.expression.text : undefined;
  }
  return ts.isIdentifier(expression) ? expression.text : undefined;
}

function isOpenApiController(node) {
  return !decoratorsOf(node).some(
    (decorator) => decoratorName(decorator) === 'ApiExcludeController',
  );
}

function isHttpMethod(node) {
  return decoratorsOf(node).some((decorator) => HTTP_DECORATORS.has(decoratorName(decorator)));
}

function words(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase();
}

function descriptionFor(name) {
  const known = {
    amountCents: 'Importe expresado en céntimos.',
    totalCents: 'Importe total expresado en céntimos.',
    createdAt: 'Fecha y hora de creación en formato ISO 8601.',
    updatedAt: 'Fecha y hora de la última actualización en formato ISO 8601.',
    id: 'Identificador UUID del recurso.',
    message: 'Mensaje legible que resume el resultado.',
    status: 'Estado actual expuesto por el runtime.',
  };
  return known[name] ?? `Campo ${words(name)} expuesto por el runtime actual.`;
}

function exampleFor(name, schema) {
  if (schema.enum?.length) return schema.enum[0];
  if (schema.format === 'uuid') return '11111111-1111-4111-8111-111111111111';
  if (schema.format === 'date-time') return '2026-08-27T18:30:00.000Z';
  if (schema.format === 'date') return '2026-08-27';
  if (schema.format === 'email') return 'usuario@example.com';
  if (schema.format === 'uri') return 'https://example.com/recurso';
  if (/token/i.test(name)) return 'token-ficticio-no-valido';
  if (/phoneNumber/i.test(name)) return '999999999';
  if (/phoneCountryCode/i.test(name)) return '+51';
  if (/Cents$/.test(name)) return 1500;
  if (/count|quantity|page|total|version/i.test(name) && schema.type === 'number') return 1;
  if (/name/i.test(name) && schema.type === 'string') return 'Ejemplo ficticio';
  if (/code/i.test(name) && schema.type === 'string') return 'CODE-EXAMPLE';
  if (schema.type === 'boolean') return false;
  return undefined;
}

function schemaForKnownProperty(name, type, schema) {
  const nullable =
    NULLABLE_RESPONSE_PROPERTIES.has(name) ||
    (type.isUnion?.() && type.types.some((item) => item.flags & ts.TypeFlags.Null))
      ? { nullable: true }
      : {};
  if (
    (name === 'id' || /Id$/.test(name)) &&
    !['correlationId', 'externalPaymentId', 'idempotencyKey'].includes(name)
  ) {
    return { type: 'string', format: 'uuid', ...nullable };
  }
  if (/email/i.test(name)) return { type: 'string', format: 'email', ...nullable };
  if (name === 'date' && schema.type === 'string') {
    return { ...schema, format: 'date' };
  }
  if (/At$/.test(name) && (!schema.type || schema.type === 'string')) {
    return { type: 'string', format: 'date-time', ...nullable };
  }
  if (/^(url|uploadUrl|checkoutUrl|shareUrl)$/.test(name) || /(image|cover).*Url$/i.test(name)) {
    return { type: 'string', format: 'uri', ...nullable };
  }
  if (
    !schema.type &&
    (name === 'status' ||
      /Status$/.test(name) ||
      name === 'currency' ||
      /Provider$/.test(name) ||
      /Method$/.test(name))
  ) {
    return { type: 'string', ...nullable };
  }
  if (/Cents$/.test(name)) return { type: 'integer', format: 'int64', ...nullable };
  if (
    /Count$/.test(name) ||
    /^(count|quantity|page|pageSize|totalPages|revision|expiresIn)$/.test(name)
  ) {
    return { type: 'integer', format: 'int32', ...nullable };
  }
  return schema;
}

function refinePaymentResponseSchema(operationId, schema) {
  const isWalletTopUp = /CommerceController_(createWalletTopUp|walletTopUps|walletTopUp)$/.test(
    operationId,
  );

  function visit(value) {
    if (!value || typeof value !== 'object') return;
    const properties = value.properties ?? {};
    const applyEnum = (name, values, nullable = false) => {
      if (!properties[name]) return;
      properties[name] = {
        ...properties[name],
        type: 'string',
        enum: values,
        ...(nullable ? { nullable: true } : {}),
        example: values[0],
      };
      delete properties[name].oneOf;
    };
    applyEnum('orderStatus', ORDER_STATUSES);
    applyEnum('paymentStatus', PAYMENT_ATTEMPT_STATUSES, true);
    applyEnum('paymentMethod', ORDER_PAYMENT_METHODS, true);
    applyEnum('paymentProvider', PAYMENT_PROVIDERS, true);
    if (isWalletTopUp) applyEnum('status', WALLET_TOP_UP_STATUSES);
    for (const property of Object.values(properties)) visit(property);
    if (value.items) visit(value.items);
    for (const key of ['allOf', 'oneOf', 'anyOf']) {
      for (const variant of value[key] ?? []) visit(variant);
    }
  }

  visit(schema);
  return schema;
}

function dynamicValueSchema(description = 'Valor JSON dinámico expuesto por el runtime.') {
  return {
    description,
    allOf: [{ $ref: '#/components/schemas/JsonValue' }],
  };
}

function nullableSchema(schema) {
  if (schema.allOf?.some((item) => item.$ref === '#/components/schemas/JsonValue')) return schema;
  if (schema.oneOf) return { ...schema, oneOf: schema.oneOf.map(nullableSchema) };
  if (schema.type) return { ...schema, nullable: true };
  return dynamicValueSchema();
}

function typeToSchema(type, location, depth = 0, stack = new Set()) {
  const flags = type.flags;
  if (flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return dynamicValueSchema();
  if (flags & ts.TypeFlags.Never) return dynamicValueSchema();
  if (flags & ts.TypeFlags.StringLike) {
    if (type.isStringLiteral?.()) return { type: 'string', enum: [type.value] };
    return { type: 'string' };
  }
  if (flags & ts.TypeFlags.NumberLike) {
    if (type.isNumberLiteral?.()) return { type: 'number', enum: [type.value] };
    return { type: 'number' };
  }
  if (flags & ts.TypeFlags.BooleanLike) {
    const intrinsic = type.intrinsicName;
    return intrinsic === 'true' || intrinsic === 'false'
      ? { type: 'boolean', enum: [intrinsic === 'true'] }
      : { type: 'boolean' };
  }
  if (flags & ts.TypeFlags.BigIntLike) return { type: 'integer', format: 'int64' };
  if (flags & ts.TypeFlags.Null) return dynamicValueSchema('Valor null expuesto por el runtime.');
  if (flags & ts.TypeFlags.Undefined) return dynamicValueSchema();

  if (type.isUnion?.()) {
    const hasNull = type.types.some((item) => item.flags & ts.TypeFlags.Null);
    const meaningful = type.types.filter(
      (item) => !(item.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)),
    );
    const stringLiterals = meaningful.filter((item) => item.isStringLiteral?.());
    const numberLiterals = meaningful.filter((item) => item.isNumberLiteral?.());
    if (stringLiterals.length === meaningful.length) {
      return {
        type: 'string',
        enum: stringLiterals.map((item) => item.value),
        ...(hasNull ? { nullable: true } : {}),
      };
    }
    if (numberLiterals.length === meaningful.length) {
      return {
        type: 'number',
        enum: numberLiterals.map((item) => item.value),
        ...(hasNull ? { nullable: true } : {}),
      };
    }
    const variants = meaningful.map((item) => typeToSchema(item, location, depth, stack));
    const unique = [...new Map(variants.map((item) => [JSON.stringify(item), item])).values()];
    const dynamic = unique.find((item) =>
      item.allOf?.some((part) => part.$ref === '#/components/schemas/JsonValue'),
    );
    if (dynamic) return dynamic;
    if (unique.length === 1) return hasNull ? nullableSchema(unique[0]) : unique[0];
    return { oneOf: hasNull ? unique.map(nullableSchema) : unique };
  }

  const promised = checker.getPromisedTypeOfPromise(type);
  if (promised) return typeToSchema(promised, location, depth, stack);
  if (checker.isArrayType(type) || checker.isTupleType(type)) {
    const arguments_ = checker.getTypeArguments(type);
    const itemType = arguments_[0] ?? checker.getIndexTypeOfType(type, ts.IndexKind.Number);
    return {
      type: 'array',
      items: itemType ? typeToSchema(itemType, location, depth + 1, stack) : dynamicValueSchema(),
    };
  }

  const symbolName = type.aliasSymbol?.name ?? type.getSymbol()?.name;
  const rendered = checker.typeToString(type, location);
  if (symbolName === 'Date' || rendered === 'Date') return { type: 'string', format: 'date-time' };
  if (symbolName === 'URL') return { type: 'string', format: 'uri' };
  if (/Json(Value|Object|Array)/.test(rendered)) return dynamicValueSchema();
  if (depth >= 7) {
    return {
      type: 'object',
      description: 'Objeto anidado del payload runtime.',
      additionalProperties: true,
    };
  }

  const identity = type.id;
  if (stack.has(identity)) {
    return {
      type: 'object',
      description: 'Referencia recursiva del payload runtime.',
      additionalProperties: true,
    };
  }
  const nextStack = new Set(stack).add(identity);
  const properties = {};
  const required = [];
  for (const property of checker.getPropertiesOfType(type)) {
    const declaration = property.valueDeclaration ?? property.declarations?.[0] ?? location;
    const propertyType = checker.getTypeOfSymbolAtLocation(property, declaration);
    const schema = schemaForKnownProperty(
      property.name,
      propertyType,
      typeToSchema(propertyType, declaration, depth + 1, nextStack),
    );
    schema.description ??= descriptionFor(property.name);
    const example = exampleFor(property.name, schema);
    if (example !== undefined) schema.example = example;
    properties[property.name] = schema;
    const optional =
      Boolean(property.flags & ts.SymbolFlags.Optional) ||
      (propertyType.isUnion?.() &&
        propertyType.types.some((item) => item.flags & ts.TypeFlags.Undefined));
    if (!optional) required.push(property.name);
  }

  const stringIndex = checker.getIndexTypeOfType(type, ts.IndexKind.String);
  const result = {
    type: 'object',
    properties,
    ...(required.length ? { required } : {}),
    additionalProperties: stringIndex
      ? typeToSchema(stringIndex, location, depth + 1, nextStack)
      : false,
  };
  return result;
}

function collectErrorCodes(root) {
  const found = new Map();
  const visited = new Set();

  function add(status, code) {
    if (!found.has(status)) found.set(status, new Set());
    found.get(status).add(code);
  }

  function visitDeclaration(node) {
    const key = `${node.getSourceFile().fileName}:${node.pos}:${node.end}`;
    if (visited.has(key)) return;
    visited.add(key);
    ts.forEachChild(node, visitNode);
  }

  function visitNode(node) {
    if (ts.isCallExpression(node)) {
      const calledName = ts.isIdentifier(node.expression)
        ? node.expression.text
        : ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : undefined;
      const status =
        calledName && Object.hasOwn(ERROR_HELPERS, calledName)
          ? ERROR_HELPERS[calledName]
          : undefined;
      const firstArgument = node.arguments[0];
      if (status && firstArgument && ts.isStringLiteralLike(firstArgument)) {
        add(status, firstArgument.text);
      }

      const declaration = checker.getResolvedSignature(node)?.declaration;
      if (
        declaration &&
        /[\\/]src[\\/]/.test(declaration.getSourceFile().fileName) &&
        !declaration.getSourceFile().isDeclarationFile
      ) {
        visitDeclaration(declaration);
      }
    }
    ts.forEachChild(node, visitNode);
  }

  visitDeclaration(root);
  return Object.fromEntries(
    [...found.entries()]
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([status, codes]) => [status, [...codes].sort()]),
  );
}

for (const sourceFile of program
  .getSourceFiles()
  .filter(
    (file) => /[\\/]src[\\/]/.test(file.fileName) && file.fileName.endsWith('.controller.ts'),
  )) {
  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isClassDeclaration(node) || !node.name || !isOpenApiController(node)) return;
    for (const member of node.members) {
      if (!ts.isMethodDeclaration(member) || !ts.isIdentifier(member.name) || !isHttpMethod(member))
        continue;
      const signature = checker.getSignatureFromDeclaration(member);
      if (!signature) continue;
      const operationId = `${node.name.text}_${member.name.text}`;
      const isServerSentEvents = decoratorsOf(member).some(
        (decorator) => decoratorName(decorator) === 'Sse',
      );
      const responseSchema = isServerSentEvents
        ? {
            type: 'string',
            description: 'Secuencia de eventos Server-Sent Events emitida por el runtime.',
          }
        : typeToSchema(checker.getReturnTypeOfSignature(signature), member);
      schemas[`${operationId}Response`] = refinePaymentResponseSchema(operationId, responseSchema);
      errorCodes[operationId] = collectErrorCodes(member);
    }
  });
}

const target = path.join(
  ROOT,
  'src',
  'shared',
  'presentation',
  'openapi',
  'openapi.response-schemas.ts',
);
const output =
  `/* Generated by scripts/generate-openapi-response-schemas.cjs. */\n` +
  `import { OpenAPIObject } from '@nestjs/swagger';\n\n` +
  `type SchemasObject = NonNullable<NonNullable<OpenAPIObject['components']>['schemas']>;\n` +
  `type SchemaObject = Exclude<SchemasObject[string], { $ref: string }>;\n\n` +
  `export const OPENAPI_RESPONSE_SCHEMAS: Record<string, SchemaObject> = ${JSON.stringify(schemas, null, 2)};\n\n` +
  `export const OPENAPI_ERROR_CODES: Record<string, Record<string, string[]>> = ${JSON.stringify(errorCodes, null, 2)};\n`;
async function writeGeneratedSchemas() {
  const formatted = await prettier.format(output, { filepath: target });
  fs.writeFileSync(target, formatted, 'utf8');
  process.stdout.write(`Generated ${Object.keys(schemas).length} response schemas in ${target}\n`);
}

void writeGeneratedSchemas();
