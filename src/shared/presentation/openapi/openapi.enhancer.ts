import { OpenAPIObject } from '@nestjs/swagger';
import { OPENAPI_ERROR_CODES } from './openapi.error-codes';

type PathItemObject = OpenAPIObject['paths'][string];
type OperationObject = NonNullable<PathItemObject['get']>;
type ReferenceObject = { $ref: string };
type ParameterObject = Exclude<NonNullable<OperationObject['parameters']>[number], ReferenceObject>;
type ResponseObject = Exclude<
  NonNullable<OperationObject['responses'][string]>,
  ReferenceObject
> & {
  'x-error-codes'?: string[];
};
type SchemasObject = NonNullable<NonNullable<OpenAPIObject['components']>['schemas']>;
type SchemaObject = Exclude<SchemasObject[string], ReferenceObject>;

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head'] as const;

export const OPENAPI_PUBLIC_OPERATION_ALLOWLIST = [
  'HealthController_check',
  'AuthController_register',
  'AuthController_confirmPhone',
  'AuthController_resendPhoneCode',
  'AuthController_login',
  'AuthController_refresh',
  'AuthController_logout',
  'AuthController_requestPasswordReset',
  'AuthController_resetPassword',
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
  'PublicEventsController_listPublicEvents',
  'PublicEventsController_getPublicEvent',
  'MercadoPagoPaymentsController_webhook',
] as const;

export const OPENAPI_EXCLUDED_OPERATION_ALLOWLIST = ['GET /api/v1/media/*path'] as const;

const publicOperations = new Set<string>(OPENAPI_PUBLIC_OPERATION_ALLOWLIST);

export function enhanceOpenApiDocument(document: OpenAPIObject): OpenAPIObject {
  Object.assign(document, { 'x-excluded-operations': OPENAPI_EXCLUDED_OPERATION_ALLOWLIST });
  document.components ??= {};
  document.components.schemas = {
    ...(document.components.schemas ?? {}),
    ...sharedSchemas(),
  };

  for (const pathItem of Object.values(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem?.[method];
      if (!operation) continue;
      const operationId = operation.operationId;
      if (!operationId) throw new Error('Missing OpenAPI operationId');
      const isPublic = publicOperations.has(operationId);
      operation.security = isPublic ? [] : [{ bearer: [] }];
      normalizeParameters(operation);
      normalizeRequestBody(operation, document);
      normalizeResponses(operation, operationId, method, isPublic, document);
    }
  }

  delete document.components.schemas.Object;
  return document;
}

function sharedSchemas(): Record<string, SchemaObject> {
  return {
    JsonValue: {
      description:
        'Valor JSON arbitrario, incluido null, emitido por campos dinámicos del runtime.',
      oneOf: [
        { type: 'string', nullable: true },
        { type: 'number' },
        { type: 'boolean' },
        { type: 'array', items: { $ref: '#/components/schemas/JsonValue' } },
        {
          type: 'object',
          additionalProperties: { $ref: '#/components/schemas/JsonValue' },
        },
      ],
    },
    ApiErrorDetail: {
      type: 'object',
      additionalProperties: true,
      properties: {
        field: { type: 'string', description: 'Ruta del campo inválido.', example: 'email' },
        messages: {
          type: 'array',
          description: 'Mensajes de validación del campo.',
          items: { type: 'string' },
          example: ['El correo electrónico no tiene un formato válido.'],
        },
      },
    },
    ApiError: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message', 'details'],
      properties: {
        code: {
          type: 'string',
          description: 'Código estable y machine-readable.',
          example: 'VALIDATION_ERROR',
        },
        message: {
          type: 'string',
          description: 'Mensaje legible del error.',
          example: 'La solicitud contiene datos inválidos.',
        },
        details: {
          type: 'array',
          description:
            'Detalles adicionales. En errores de validación usa los campos conocidos de ApiErrorDetail.',
          items: { $ref: '#/components/schemas/ApiErrorDetail' },
        },
      },
    },
    ApiErrorEnvelope: {
      type: 'object',
      additionalProperties: false,
      required: ['data', 'meta', 'error'],
      properties: {
        data: {
          type: 'object',
          nullable: true,
          example: null,
          description: 'Siempre null en errores compartidos.',
        },
        meta: {
          type: 'object',
          additionalProperties: true,
          description: 'Metadata adicional del error.',
          example: {},
        },
        error: { $ref: '#/components/schemas/ApiError' },
      },
    },
    NestInternalServerError: {
      type: 'object',
      additionalProperties: false,
      required: ['statusCode', 'message'],
      properties: {
        statusCode: {
          type: 'integer',
          format: 'int32',
          enum: [500],
          description: 'Status HTTP emitido por el manejador predeterminado de NestJS.',
          example: 500,
        },
        message: {
          type: 'string',
          description: 'Mensaje genérico que evita exponer el error interno.',
          example: 'Internal server error',
        },
      },
    },
  };
}

function normalizeParameters(operation: OperationObject): void {
  for (const raw of operation.parameters ?? []) {
    if (isReference(raw)) continue;
    const parameter = raw;
    parameter.required = parameter.in === 'path' ? true : Boolean(parameter.required);
    if (!parameter.schema) {
      throw new Error(
        'Missing OpenAPI schema for ' +
          operation.operationId +
          ' parameter ' +
          parameter.name +
          '.',
      );
    }
    if (isReference(parameter.schema)) continue;
    const schema = parameter.schema;
    if (parameter.in === 'query' && schema.default !== undefined) parameter.required = false;
  }
}

function normalizeRequestBody(operation: OperationObject, document: OpenAPIObject): void {
  if (!operation.requestBody || isReference(operation.requestBody)) return;
  const requestBody = operation.requestBody;
  for (const media of Object.values(requestBody.content)) {
    if (media.schema) closeSchema(media.schema, document, new Set());
  }
}

function normalizeResponses(
  operation: OperationObject,
  operationId: string,
  method: (typeof HTTP_METHODS)[number],
  isPublic: boolean,
  document: OpenAPIObject,
): void {
  const successStatus =
    Object.keys(operation.responses ?? {}).find((status) => /^2\d\d$/.test(status)) ??
    (method === 'post' ? '201' : '200');
  operation.responses ??= {};
  const declared = operation.responses[successStatus];
  const hasDeclaredSchema =
    declared &&
    (isReference(declared) ||
      Object.values(declared.content ?? {}).some((media) => {
        const schema = media.schema;
        if (!schema || Object.keys(schema).length === 0) return false;
        if (isReference(schema) || schema.type !== 'object') return true;
        return Boolean(
          Object.keys(schema.properties ?? {}).length ||
          schema.allOf?.length ||
          schema.oneOf?.length ||
          schema.anyOf?.length ||
          typeof schema.additionalProperties === 'object',
        );
      }));
  if (!hasDeclaredSchema) throw new Error(`Missing response DTO for ${operationId}`);
  closeResponseSchemas(operation, document);

  if (
    operation.requestBody ||
    (operation.parameters ?? []).some(
      (raw: ParameterObject | ReferenceObject) => !isReference(raw) && raw.in === 'query',
    )
  ) {
    addError(
      operation,
      '400',
      'VALIDATION_ERROR',
      'La entrada o una regla de solicitud no es válida.',
    );
  }
  if (!isPublic) {
    addError(
      operation,
      '401',
      'ACCESS_TOKEN_REQUIRED',
      'El access token falta, expiró o no es válido.',
    );
    const unauthorizedResponse = operation.responses['401'];
    if (unauthorizedResponse && !isReference(unauthorizedResponse)) {
      applyErrorCodes(unauthorizedResponse, ['ACCESS_TOKEN_REQUIRED', 'INVALID_ACCESS_TOKEN']);
    }
  }
  for (const [status, codes] of Object.entries(OPENAPI_ERROR_CODES[operationId] ?? {})) {
    const [firstCode] = codes;
    if (!firstCode) continue;
    const existingResponse = operation.responses[status];
    if (
      !existingResponse ||
      (!isReference(existingResponse) && !existingResponse.content?.['application/json'])
    ) {
      addError(
        operation,
        status,
        firstCode,
        !existingResponse || isReference(existingResponse)
          ? errorDescription(status)
          : existingResponse.description,
      );
    }
    const response = operation.responses[status];
    if (response && !isReference(response)) {
      applyErrorCodes(response, codes);
    }
  }
}

function closeResponseSchemas(operation: OperationObject, document: OpenAPIObject): void {
  const visited = new Set<string>();
  for (const [status, response] of Object.entries(operation.responses)) {
    if (!/^2\d\d$/.test(status) || !response || isReference(response)) continue;
    const schema = response.content?.['application/json']?.schema;
    if (schema) closeSchema(schema, document, visited);
  }
}

function closeSchema(
  schema: SchemaObject | ReferenceObject,
  document: OpenAPIObject,
  visited: Set<string>,
): void {
  if (isReference(schema)) {
    if (visited.has(schema.$ref)) return;
    visited.add(schema.$ref);
    const name = schema.$ref.split('/').pop();
    if (!name) throw new Error(`Invalid OpenAPI reference: ${schema.$ref}`);
    if (name === 'JsonValue') return;
    const target = document.components?.schemas?.[name];
    if (target) closeSchema(target, document, visited);
    return;
  }
  if (schema.type === 'object' && schema.properties) schema.additionalProperties ??= false;
  for (const property of Object.values(schema.properties ?? {}))
    closeSchema(property, document, visited);
  if (schema.items) closeSchema(schema.items, document, visited);
  if (typeof schema.additionalProperties === 'object')
    closeSchema(schema.additionalProperties, document, visited);
  for (const variant of [...(schema.allOf ?? []), ...(schema.oneOf ?? []), ...(schema.anyOf ?? [])])
    closeSchema(variant, document, visited);
}

function applyErrorCodes(response: ResponseObject, codes: string[]): void {
  const mergedCodes = [...new Set([...(response['x-error-codes'] ?? []), ...codes])];
  response['x-error-codes'] = mergedCodes;
  const media = response.content?.['application/json'];
  const example: unknown = media?.example;
  if (!example || typeof example !== 'object' || !('error' in example)) return;
  const error = example.error;
  if (!error || typeof error !== 'object' || !('code' in error)) return;
  const [firstCode] = mergedCodes;
  if (firstCode) error.code = firstCode;
}

function errorDescription(status: string): string {
  const descriptions: Record<string, string> = {
    '400': 'La entrada o una regla de solicitud no es válida.',
    '401': 'Las credenciales o el token no son válidos.',
    '403': 'El rol, permiso o acceso asignado no autoriza la operación.',
    '404': 'El recurso requerido no existe o no es visible.',
    '409': 'El estado actual impide completar la operación.',
    '503': 'Un proveedor requerido no está disponible.',
  };
  return descriptions[status] ?? 'La operación no pudo completarse.';
}

function addError(
  operation: OperationObject,
  status: string,
  code: string,
  description: string,
): void {
  operation.responses[status] = {
    description,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ApiErrorEnvelope' },
        example: {
          data: null,
          meta: {},
          error: { code, message: description, details: [] },
        },
      },
    },
  };
  const response = operation.responses[status];
  if (response && !isReference(response)) applyErrorCodes(response, [code]);
}

function isReference(value: unknown): value is ReferenceObject {
  return (
    value !== null && typeof value === 'object' && '$ref' in value && typeof value.$ref === 'string'
  );
}
