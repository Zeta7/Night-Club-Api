const fs = require('node:fs');
const path = require('node:path');
require('reflect-metadata');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');
const { getMetadataStorage, validateSync } = require('class-validator');
const { plainToInstance } = require('class-transformer');

const ROOT = path.resolve(__dirname, '..');
const DOCUMENT_PATH = path.join(ROOT, 'dist', 'openapi.json');
const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'patch', 'options', 'head']);
const EXPECTED_EXCLUSIONS = ['GET /api/v1/media/*path'];
const EXPECTED_PUBLIC_OPERATIONS = [
  'AuthController_confirmPhone',
  'AuthController_login',
  'AuthController_logout',
  'AuthController_refresh',
  'AuthController_register',
  'AuthController_requestPasswordReset',
  'AuthController_resendPhoneCode',
  'AuthController_resetPassword',
  'HealthController_check',
  'PreLaunchController_business',
  'PreLaunchController_event',
  'PreLaunchController_locations',
  'PreLaunchController_overview',
  'PreLaunchController_phoneCheck',
  'PreLaunchController_preferences',
  'PreLaunchController_recover',
  'PreLaunchController_resend',
  'PreLaunchController_start',
  'PreLaunchController_status',
  'PreLaunchController_venueOptions',
  'PreLaunchController_verify',
  'PublicEventsController_getPublicEvent',
  'PublicEventsController_listPublicEvents',
];
const EXPECTED_MEDIA_TYPES = {
  CommerceController_exportClubOrders: ['text/csv'],
  CapacityController_stream: ['text/event-stream'],
};
const EXPECTED_REQUEST_MEDIA_TYPES = {};
const DYNAMIC_RESPONSE_PATH_ALLOWLIST = [
  {
    pattern: /^NotificationDto::properties\.data$/,
    reason: 'Notification payloads vary by template.',
    nullable: true,
  },
  {
    pattern: /^PlatformDashboardDto::properties\.settings\.additionalProperties$/,
    reason: 'Platform settings are keyed JSON values.',
    nullable: true,
  },
  {
    pattern: /^PlatformSettingsResponseDto::properties\.settings\.additionalProperties$/,
    reason: 'Platform settings are keyed JSON values.',
    nullable: true,
  },
  {
    pattern: /^AuditEntryDto::properties\.metadata$/,
    reason: 'Audit details vary by operation.',
    nullable: true,
  },
  {
    pattern: /^ClubLedgerMovementTransactionDto::properties\.metadata$/,
    reason: 'Ledger metadata varies by transaction.',
    nullable: true,
  },
  {
    pattern: /^OrderReconciliationTransactionDto::properties\.metadata$/,
    reason: 'Ledger metadata varies by transaction.',
    nullable: true,
  },
  {
    pattern: /^OrderPaymentAttemptDto::properties\.providerData$/,
    reason: 'Provider-specific payment data.',
    nullable: true,
  },
];

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function resolvePointer(document, reference) {
  if (!reference.startsWith('#/')) return undefined;
  return reference
    .slice(2)
    .split('/')
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((value, segment) => value?.[segment], document);
}

function collectReferences(value, found = new Set()) {
  if (!value || typeof value !== 'object') return found;
  if (typeof value.$ref === 'string') found.add(value.$ref);
  for (const nested of Object.values(value)) collectReferences(nested, found);
  return found;
}

function dereferenceSchema(document, schema) {
  if (!schema || typeof schema !== 'object') return undefined;
  return schema.$ref ? resolvePointer(document, schema.$ref) : schema;
}

function isClosedEmptyObject(document, schema) {
  const resolved = dereferenceSchema(document, schema);
  if (!resolved || resolved.type !== 'object' || resolved.additionalProperties !== false) {
    return false;
  }
  return Object.keys(resolved.properties ?? {}).length === 0;
}

function isDynamicRootSchema(schema) {
  return (
    schema?.$ref === '#/components/schemas/JsonValue' ||
    schema?.allOf?.some((item) => item.$ref === '#/components/schemas/JsonValue')
  );
}

function normalizedSchemaPath(name, path) {
  const semanticPath = path
    .filter((segment) => !/^(?:allOf|anyOf|oneOf)\[\d+\]$/.test(segment))
    .join('.')
    .replaceAll(/\[\d+\]/g, '[*]');
  return `${name}::${semanticPath}`;
}

function visitSchema(schema, visitor, path = []) {
  if (!schema || typeof schema !== 'object') return;
  visitor(schema, path);
  if (isDynamicRootSchema(schema)) return;
  for (const [key, nested] of Object.entries(schema)) {
    if (['description', 'example'].includes(key)) continue;
    if (Array.isArray(nested)) {
      nested.forEach((item, index) => visitSchema(item, visitor, [...path, `${key}[${index}]`]));
    } else {
      visitSchema(nested, visitor, [...path, key]);
    }
  }
}

function enumValuesAreDisjoint(left, right) {
  if (!Array.isArray(left?.enum) || !Array.isArray(right?.enum)) return false;
  const leftValues = new Set(left.enum.map((value) => JSON.stringify(value)));
  return right.enum.every((value) => !leftValues.has(JSON.stringify(value)));
}

function objectVariantsAreDisjoint(left, right) {
  const leftProperties = left.properties ?? {};
  const rightProperties = right.properties ?? {};
  const commonRequired = (left.required ?? []).filter((name) => right.required?.includes(name));
  if (
    commonRequired.some((name) =>
      enumValuesAreDisjoint(leftProperties[name], rightProperties[name]),
    )
  ) {
    return true;
  }

  return (
    (right.additionalProperties === false &&
      left.required?.some((name) => !Object.hasOwn(rightProperties, name))) ||
    (left.additionalProperties === false &&
      right.required?.some((name) => !Object.hasOwn(leftProperties, name)))
  );
}

function schemaVariantsAreDisjoint(document, left, right) {
  const resolvedLeft = dereferenceSchema(document, left) ?? left;
  const resolvedRight = dereferenceSchema(document, right) ?? right;
  if (resolvedLeft.type && resolvedRight.type && resolvedLeft.type !== resolvedRight.type) {
    return true;
  }
  if (enumValuesAreDisjoint(resolvedLeft, resolvedRight)) return true;
  return (
    resolvedLeft.type === 'object' &&
    resolvedRight.type === 'object' &&
    objectVariantsAreDisjoint(resolvedLeft, resolvedRight)
  );
}

function isDeclaredSchema(schema) {
  return Boolean(
    schema?.$ref ||
    schema?.type ||
    schema?.allOf ||
    schema?.oneOf ||
    schema?.anyOf ||
    schema?.not ||
    schema?.enum,
  );
}

function unionVariantsAreComplete(document, name, path, keyword, variants) {
  check(variants.length >= 2, `${name}::${path}: ${keyword} must contain at least two variants.`);
  check(
    new Set(variants.map((variant) => JSON.stringify(variant))).size === variants.length,
    `${name}::${path}: ${keyword} contains duplicate variants.`,
  );
  const resolvedVariants = variants.map(
    (variant) => dereferenceSchema(document, variant) ?? variant,
  );
  for (const [index, variant] of resolvedVariants.entries()) {
    check(
      isDeclaredSchema(variant),
      `${name}::${path}.${keyword}[${index}]: response variant has no declared schema.`,
    );
  }
  if (resolvedVariants.every((variant) => variant.type === 'object')) {
    for (const [index, variant] of resolvedVariants.entries()) {
      check(
        variant.additionalProperties === false &&
          Array.isArray(variant.required) &&
          variant.required.length > 0,
        `${name}::${path}.${keyword}[${index}]: object response variants must be closed and have required properties.`,
      );
    }
  }
}

function isClosedObjectOrTypedMap(schema) {
  if (schema?.allOf?.length && !schema.properties && schema.allOf.every(isDeclaredSchema))
    return true;
  if (schema?.type !== 'object') return true;
  if (schema.additionalProperties === false) return true;
  return (
    schema.additionalProperties &&
    typeof schema.additionalProperties === 'object' &&
    isDeclaredSchema(schema.additionalProperties)
  );
}

function operationContentTypes(operation) {
  const types = new Set();
  for (const [status, response] of Object.entries(operation.responses ?? {})) {
    if (!/^2\d\d$/.test(status) || response.$ref) continue;
    for (const contentType of Object.keys(response.content ?? {})) types.add(contentType);
  }
  return [...types];
}

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(file) : [file];
  });
}

// Include query DTOs and DTOs declared inside controllers, even if Swagger inlines them.
function requestModels() {
  const models = new Set();
  const add = (type) => {
    if (typeof type === 'function' && type.name.endsWith('Dto')) models.add(type);
  };
  for (const file of filesIn(path.join(ROOT, 'dist', 'src', 'modules'))) {
    if (!/\.(dto|controller)\.js$/.test(file) || file.endsWith('.response.dto.js')) continue;
    for (const type of Object.values(require(file))) {
      if (typeof type !== 'function' || !type.prototype) continue;
      add(type);
      if (!type.name.endsWith('Controller')) continue;
      for (const method of Object.getOwnPropertyNames(type.prototype)) {
        for (const parameter of Reflect.getMetadata('design:paramtypes', type.prototype, method) ??
          []) {
          add(parameter);
        }
      }
    }
  }
  return [...models];
}

function checkRequestSchemas(models, schemas) {
  const failures = [];
  let fields = 0;
  function enumValues(schema, visited = new Set()) {
    if (!schema || visited.has(schema)) return undefined;
    visited.add(schema);
    if (schema.enum) return schema.enum.filter((value) => value !== null);
    if (schema.$ref) return enumValues(schemas[schema.$ref.split('/').pop()], visited);
    if (schema.allOf?.length === 1) return enumValues(schema.allOf[0], visited);
    return undefined;
  }
  function checkShape(schema, label) {
    if (!schema || typeof schema !== 'object') return;
    if (schema.required !== undefined && !Array.isArray(schema.required)) {
      failures.push(`${label}: Schema Object required must be an array of property names.`);
    }
    for (const [name, property] of Object.entries(schema.properties ?? {}))
      checkShape(property, `${label}.${name}`);
    if (schema.items) checkShape(schema.items, `${label}[]`);
    for (const keyword of ['allOf', 'oneOf', 'anyOf']) {
      for (const [index, variant] of (schema[keyword] ?? []).entries())
        checkShape(variant, `${label}.${keyword}[${index}]`);
    }
  }
  for (const model of models) {
    const schema = schemas[model.name];
    if (!schema) {
      failures.push(`${model.name}: missing request schema.`);
      continue;
    }
    checkShape(schema, model.name);
    const metadata = getMetadataStorage().getTargetValidationMetadatas(model, '', false, false);
    for (const property of new Set(metadata.map((item) => item.propertyName))) {
      fields += 1;
      const field = schema.properties?.[property];
      const label = `${model.name}.${property}`;
      if (!field) {
        failures.push(`${label}: validated property is missing from Swagger.`);
        continue;
      }
      const rules = metadata.filter((item) => item.propertyName === property);
      if (
        rules.some(
          (item) =>
            item.name === 'isInt' &&
            (item.each ? field.items?.type !== 'integer' : field.type !== 'integer'),
        )
      ) {
        failures.push(`${label}: @IsInt requires OpenAPI type integer; use @IsInteger().`);
      }
      for (const rule of rules.filter((item) => item.name === 'isEnum' || item.name === 'isIn')) {
        const expected = rule.name === 'isEnum' ? rule.constraints[1] : rule.constraints[0];
        const actual = enumValues(rule.each ? field.items : field);
        if (
          !actual ||
          actual.length !== expected.length ||
          expected.some((value) => !actual.includes(value))
        ) {
          failures.push(label + ': Swagger enum must match the values accepted by validation.');
        }
      }
      if (
        rules.some((item) => item.name === 'isDateString') &&
        !['date', 'date-time'].includes(field.format)
      ) {
        failures.push(
          label + ': ISO dates must explicitly document format date or date-time in the DTO.',
        );
      }
      const errors = validateSync(plainToInstance(model, { [property]: null }));
      const acceptsNull = !errors.some((error) => error.property === property);
      if (acceptsNull !== (field.nullable === true)) {
        failures.push(
          `${label}: validation accepts null=${acceptsNull}, Swagger nullable=${field.nullable === true}. Use @OptionalField and explicit nullable types; PATCH PartialType must set skipNullProperties: false.`,
        );
      }
    }
  }
  return { failures, fields };
}

async function checkRequestDocument(document) {
  const models = requestModels();
  class ContractModule {}
  Module({})(ContractModule);
  const app = await NestFactory.create(ContractModule, { logger: false });
  try {
    const dtoDocument = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
      extraModels: models,
    });
    // Query DTOs may be inlined rather than published as components.
    const schemas = { ...dtoDocument.components.schemas, ...document.components.schemas };
    return { models: models.length, ...checkRequestSchemas(models, schemas) };
  } finally {
    await app.close();
  }
}

async function main() {
  const SwaggerParser = require('@apidevtools/swagger-parser');
  const document = JSON.parse(fs.readFileSync(DOCUMENT_PATH, 'utf8'));
  await SwaggerParser.validate(structuredClone(document), { resolve: { external: false } });
  const operations = [];

  for (const [route, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) continue;
      operations.push({ route, method, operation });
    }
  }

  check(document.openapi === '3.0.0', `Expected OpenAPI 3.0.0, received ${document.openapi}.`);
  check(
    JSON.stringify(document.servers ?? []) ===
      JSON.stringify([{ url: '/api/v1', description: 'Prefijo canónico de la API v1.' }]),
    'servers must contain only the canonical /api/v1 base URL.',
  );
  check(
    JSON.stringify(document['x-excluded-operations'] ?? []) === JSON.stringify(EXPECTED_EXCLUSIONS),
    'The explicit operation exclusion allowlist changed.',
  );

  const operationIds = operations.map(({ operation }) => operation.operationId).filter(Boolean);
  const publicOperationIds = [];
  check(operationIds.length === operations.length, 'Every operation must define operationId.');
  check(new Set(operationIds).size === operations.length, 'Every operationId must be unique.');

  for (const { route, method, operation } of operations) {
    const label = `${method.toUpperCase()} ${route} (${operation.operationId ?? 'missing operationId'})`;
    check(route.startsWith('/'), `${label}: paths must be absolute.`);
    check(!route.startsWith('/api/v1/'), `${label}: global prefix must not be repeated in paths.`);
    check(Array.isArray(operation.security), `${label}: security must be explicit.`);
    if (Array.isArray(operation.security)) {
      if (operation.security.length === 0) {
        publicOperationIds.push(operation.operationId);
      } else {
        check(
          JSON.stringify(operation.security) === JSON.stringify([{ bearer: [] }]),
          `${label}: protected operations must use the canonical bearer scheme.`,
        );
      }
    }

    for (const [status, response] of Object.entries(operation.responses ?? {})) {
      if (!/^2\d\d$/.test(status)) continue;
      const resolved = response.$ref ? resolvePointer(document, response.$ref) : response;
      const schema = resolved?.content?.['application/json']?.schema;
      if (!schema) continue;
      const target = dereferenceSchema(document, schema);
      check(
        isDeclaredSchema(target) &&
          isClosedObjectOrTypedMap(target) &&
          !isClosedEmptyObject(document, target),
        label +
          ': successful JSON response must use a concrete schema, not an empty Object placeholder.',
      );
    }

    if (operation.requestBody && !operation.requestBody.$ref) {
      for (const [contentType, media] of Object.entries(operation.requestBody.content ?? {})) {
        check(
          !isClosedEmptyObject(document, media.schema),
          `${label}: ${contentType} request schema is a closed empty object.`,
        );
      }
    }

    for (const contentType of EXPECTED_MEDIA_TYPES[operation.operationId] ?? []) {
      check(
        operationContentTypes(operation).includes(contentType),
        `${label}: successful response must document ${contentType}.`,
      );
    }

    for (const contentType of EXPECTED_REQUEST_MEDIA_TYPES[operation.operationId] ?? []) {
      check(
        Object.hasOwn(operation.requestBody?.content ?? {}, contentType),
        `${label}: request body must document ${contentType}.`,
      );
    }
  }

  check(
    JSON.stringify(publicOperationIds.sort()) === JSON.stringify(EXPECTED_PUBLIC_OPERATIONS),
    'The explicit public-operation allowlist changed.',
  );

  for (const reference of collectReferences(document)) {
    check(Boolean(resolvePointer(document, reference)), `Broken local reference: ${reference}.`);
  }

  const responseModelNames = new Set();
  for (const file of filesIn(path.join(ROOT, 'dist', 'src'))) {
    if (
      !file.endsWith('.response.dto.js') &&
      !file.endsWith(path.join('presentation', 'response.dto.js'))
    )
      continue;
    for (const model of Object.values(require(file)))
      if (typeof model === 'function') responseModelNames.add(model.name);
  }
  const dynamicResponses = [];
  for (const [name, schema] of Object.entries(document.components?.schemas ?? {})) {
    visitSchema(schema, (nested, path) => {
      if (nested.type && nested.type !== 'object') {
        check(
          nested.additionalProperties === undefined,
          `${normalizedSchemaPath(name, path)}: scalar and array schemas cannot declare object properties.`,
        );
      }
    });
    if (!responseModelNames.has(name)) continue;
    check(
      !isDynamicRootSchema(schema),
      `${name}: a stable response cannot use JsonValue as its root.`,
    );
    visitSchema(schema, (nested, path) => {
      const label = normalizedSchemaPath(name, path);
      if (isDynamicRootSchema(nested)) {
        dynamicResponses.push({ path: label, nullable: nested.nullable === true });
      }
      check(
        nested['x-generated-never'] !== true && nested['x-generated-null'] !== true,
        `${label}: an internal inference marker leaked into the public document.`,
      );
      check(
        !nested.nullable || !nested.enum || nested.enum.includes(null),
        label + ': nullable enums must include null.',
      );
      check(isClosedObjectOrTypedMap(nested), `${label}: object must be closed or a typed map.`);
      for (const keyword of ['oneOf', 'anyOf']) {
        const variants = nested[keyword];
        if (!Array.isArray(variants)) continue;
        unionVariantsAreComplete(document, name, path.join('.') || '<root>', keyword, variants);
        if (keyword === 'oneOf') {
          for (let left = 0; left < variants.length; left += 1) {
            for (let right = left + 1; right < variants.length; right += 1) {
              check(
                schemaVariantsAreDisjoint(document, variants[left], variants[right]),
                `${label}: oneOf variants ${left} and ${right} are not provably disjoint.`,
              );
            }
          }
        }
      }
    });
  }

  for (const occurrence of dynamicResponses) {
    const matches = DYNAMIC_RESPONSE_PATH_ALLOWLIST.filter(({ pattern }) =>
      pattern.test(occurrence.path),
    );
    check(
      matches.length === 1,
      `${occurrence.path}: JsonValue must match exactly one reviewed dynamic-field allowlist entry.`,
    );
    if (matches.length === 1) {
      check(
        occurrence.nullable === matches[0].nullable,
        `${occurrence.path}: JsonValue nullable=${occurrence.nullable} does not match the reviewed contract nullable=${matches[0].nullable}.`,
      );
    }
  }
  const dynamicResponsePaths = new Set(dynamicResponses.map(({ path }) => path));
  for (const { pattern, reason } of DYNAMIC_RESPONSE_PATH_ALLOWLIST) {
    check(
      [...dynamicResponsePaths].some((path) => pattern.test(path)),
      `Stale JsonValue allowlist entry (${reason})`,
    );
  }

  const requests = await checkRequestDocument(document);
  failures.push(...requests.failures);

  if (failures.length) {
    process.stderr.write(`OpenAPI contract check failed with ${failures.length} finding(s):\n`);
    for (const failure of failures) process.stderr.write(`- ${failure}\n`);
    process.exit(1);
  }

  process.stdout.write(
    `OpenAPI contract verified: ${Object.keys(document.paths).length} paths, ${operations.length} operations, ${operationIds.length} unique operationIds, ${Object.keys(document.components.schemas).length} schemas, 0 broken references.\n`,
  );

  process.stdout.write(
    `Request contract verified: ${requests.models} DTOs, ${requests.fields} fields.\n`,
  );
}

module.exports = { checkRequestSchemas };
if (require.main === module)
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
