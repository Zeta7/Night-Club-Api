const fs = require('node:fs');
const path = require('node:path');

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
  'FlowPaymentsController_confirmation',
  'FlowPaymentsController_returnGet',
  'FlowPaymentsController_returnPost',
  'HealthController_check',
  'PublicEventsController_getPublicEvent',
  'PublicEventsController_listPublicEvents',
];
const EXPECTED_MEDIA_TYPES = {
  CommerceController_exportClubOrders: ['text/csv'],
  CapacityController_stream: ['text/event-stream'],
  FlowPaymentsController_confirmation: ['application/json'],
  FlowPaymentsController_returnGet: ['text/html'],
  FlowPaymentsController_returnPost: ['text/html'],
};
const EXPECTED_REQUEST_MEDIA_TYPES = {
  FlowPaymentsController_confirmation: ['application/x-www-form-urlencoded'],
  FlowPaymentsController_returnPost: ['application/x-www-form-urlencoded'],
};

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

function operationContentTypes(operation) {
  const types = new Set();
  for (const [status, response] of Object.entries(operation.responses ?? {})) {
    if (!/^2\d\d$/.test(status) || response.$ref) continue;
    for (const contentType of Object.keys(response.content ?? {})) types.add(contentType);
  }
  return [...types];
}

const document = JSON.parse(fs.readFileSync(DOCUMENT_PATH, 'utf8'));
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
check(Object.keys(document.paths ?? {}).length === 124, 'Expected 124 documented paths.');
check(operations.length === 148, 'Expected 148 documented operations.');
check(
  Object.keys(document.components?.schemas ?? {}).length === 207,
  'Expected 207 component schemas.',
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

for (const [name, schema] of Object.entries(document.components?.schemas ?? {})) {
  if (!name.endsWith('Response')) continue;
  check(
    !isDynamicRootSchema(schema),
    `${name}: a stable response cannot use JsonValue as its root.`,
  );
  check(!schema.oneOf && !schema.anyOf, `${name}: root unions are not supported by the Dart gate.`);
}

if (failures.length) {
  process.stderr.write(`OpenAPI contract check failed with ${failures.length} finding(s):\n`);
  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exit(1);
}

process.stdout.write(
  `OpenAPI contract verified: ${Object.keys(document.paths).length} paths, ${operations.length} operations, ${operationIds.length} unique operationIds, ${Object.keys(document.components.schemas).length} schemas, 0 broken references.\n`,
);
