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
const DYNAMIC_RESPONSE_PATH_ALLOWLIST = [
  {
    pattern: /^NotificationController_listResponse::properties\.items\.items\.properties\.data$/,
    reason: 'Notification data is arbitrary nullable JSON selected by each template.',
    nullable: true,
  },
  {
    pattern:
      /^ClubsController_(?:createClub|getClub|updateClub|activateClub|deactivateClub)Response::properties\.club\.properties\.(?:address|contact|socialMedia|schedule)$/,
    reason: 'Administrative club responses expose the stored JSON values without narrowing them.',
    nullable: false,
  },
  {
    pattern:
      /^ClubsController_listClubsResponse::properties\.clubs\.items\.properties\.(?:address|contact|socialMedia|schedule)$/,
    reason: 'The club list exposes the stored JSON values without narrowing them.',
    nullable: false,
  },
  {
    pattern:
      /^ClubsController_getAdminDashboardResponse::properties\.club\.properties\.(?:address|contact|socialMedia|schedule)$/,
    reason: 'The dashboard club uses the same open JSON fields as the administrative club payload.',
    nullable: false,
  },
  {
    pattern:
      /^ClubsController_getCustomerHomeResponse::properties\.clubs\.items\.properties\.contact$/,
    reason: 'Customer Home forwards the stored contact JSON without a guaranteed closed shape.',
    nullable: false,
  },
  {
    pattern:
      /^ClubsController_(?:exploreCustomerContent|getCustomerClubDetail|getCustomerEventDetail)Response::properties\.(?:clubs\.items|club)\.properties\.contact$/,
    reason:
      'Customer discovery forwards the stored contact JSON without a guaranteed closed shape.',
    nullable: false,
  },
  {
    pattern:
      /^PlatformController_(?:getDashboard|updateSettings)Response::properties\.(?:dashboard\.properties\.)?settings\.additionalProperties$/,
    reason: 'Platform settings are a map whose values are arbitrary JSON.',
    nullable: false,
  },
  {
    pattern: /^AuditController_searchResponse::properties\.items\.items\.properties\.metadata$/,
    reason: 'Audit metadata records operation-specific nullable JSON.',
    nullable: true,
  },
  {
    pattern:
      /^WalletsController_(?:getClubLedger|reconcileOrder)Response::properties\.(?:movements\.items\.properties\.transaction|transactions\.items)\.properties\.metadata$/,
    reason: 'Ledger transaction metadata is operation-specific nullable JSON.',
    nullable: true,
  },
  {
    pattern:
      /^WalletsController_platformWithdrawalsResponse::properties\.items\.items\.properties\.club\.properties\.(?:addressJson|contactJson|socialMediaJson|scheduleJson)$/,
    reason: 'Platform withdrawal rows include the Club JSON columns returned by the runtime.',
    nullable: true,
  },
  {
    pattern:
      /^CommerceController_(?:clubOrders|clubOrderDetail)Response::properties\.(?:items\.items|order)\.properties\.paymentAttempts\.items\.properties\.providerData$/,
    reason: 'Payment provider data is provider-specific nullable JSON.',
    nullable: true,
  },
  {
    pattern:
      /^CommerceController_(?:tickets|consumables)Response::properties\.items\.items\.properties\.club\.properties\.(?:addressJson|contactJson|socialMediaJson|scheduleJson)$/,
    reason: 'Redeemable rows include the Club JSON columns returned by the runtime.',
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

const dynamicResponses = [];
for (const [name, schema] of Object.entries(document.components?.schemas ?? {})) {
  if (!name.endsWith('Response')) continue;
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

if (failures.length) {
  process.stderr.write(`OpenAPI contract check failed with ${failures.length} finding(s):\n`);
  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exit(1);
}

process.stdout.write(
  `OpenAPI contract verified: ${Object.keys(document.paths).length} paths, ${operations.length} operations, ${operationIds.length} unique operationIds, ${Object.keys(document.components.schemas).length} schemas, 0 broken references.\n`,
);
