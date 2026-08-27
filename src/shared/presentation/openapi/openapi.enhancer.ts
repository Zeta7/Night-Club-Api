import { OpenAPIObject } from '@nestjs/swagger';
import { OPENAPI_ERROR_CODES, OPENAPI_RESPONSE_SCHEMAS } from './openapi.response-schemas';

type PathItemObject = OpenAPIObject['paths'][string];
type OperationObject = NonNullable<PathItemObject['get']>;
type ReferenceObject = { $ref: string };
type ParameterObject = Exclude<NonNullable<OperationObject['parameters']>[number], ReferenceObject>;
type RequestBodyObject = Exclude<NonNullable<OperationObject['requestBody']>, ReferenceObject>;
type ResponseObject = Exclude<NonNullable<OperationObject['responses'][string]>, ReferenceObject>;
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
  'PublicEventsController_listPublicEvents',
  'PublicEventsController_getPublicEvent',
  'FlowPaymentsController_confirmation',
  'FlowPaymentsController_returnGet',
  'FlowPaymentsController_returnPost',
] as const;

export const OPENAPI_EXCLUDED_OPERATION_ALLOWLIST = ['GET /api/v1/media/*path'] as const;

const publicOperations = new Set<string>(OPENAPI_PUBLIC_OPERATION_ALLOWLIST);

const ACTIONS: Array<[RegExp, string]> = [
  [/^create/, 'Crear'],
  [/^get/, 'Obtener'],
  [/^list/, 'Listar'],
  [/^update/, 'Actualizar'],
  [/^delete/, 'Eliminar'],
  [/^activate/, 'Activar'],
  [/^deactivate/, 'Desactivar'],
  [/^register/, 'Registrar'],
  [/^confirm/, 'Confirmar'],
  [/^resend/, 'Reenviar'],
  [/^request/, 'Solicitar'],
  [/^reset/, 'Restablecer'],
  [/^change/, 'Cambiar'],
  [/^mark/, 'Marcar'],
  [/^start/, 'Iniciar'],
  [/^close/, 'Cerrar'],
  [/^authorize/, 'Autorizar'],
  [/^revoke/, 'Revocar'],
  [/^remove/, 'Eliminar'],
  [/^replace/, 'Reemplazar'],
  [/^explore/, 'Explorar'],
  [/^export/, 'Exportar'],
  [/^publish/, 'Publicar'],
  [/^cancel/, 'Cancelar'],
  [/^reactivate/, 'Reactivar'],
  [/^finish/, 'Finalizar'],
  [/^configure/, 'Configurar'],
  [/^correct/, 'Corregir'],
  [/^search/, 'Buscar'],
  [/^upsert/, 'Crear o actualizar'],
  [/^review/, 'Revisar'],
  [/^process/, 'Procesar'],
  [/^pay/, 'Marcar como pagado'],
  [/^fail/, 'Marcar como fallido'],
  [/^add/, 'Añadir'],
  [/^simulate/, 'Simular'],
  [/^validate/, 'Validar'],
  [/^reverse/, 'Revertir'],
  [/^associate/, 'Asociar'],
  [/^transfer/, 'Transferir'],
  [/^verify/, 'Verificar'],
  [/^sync/, 'Sincronizar'],
  [/^block/, 'Bloquear'],
];

const SUMMARY_OVERRIDES: Record<string, string> = {
  HealthController_check: 'Comprobar el estado de la API',
  AuthController_register: 'Registrar una cuenta',
  AuthController_confirmPhone: 'Confirmar el número de teléfono',
  AuthController_resendPhoneCode: 'Reenviar el código de confirmación',
  AuthController_login: 'Iniciar sesión',
  AuthController_refresh: 'Renovar la sesión',
  AuthController_logout: 'Cerrar sesión mediante refresh token',
  AuthController_requestPasswordReset: 'Solicitar el restablecimiento de contraseña',
  AuthController_resetPassword: 'Restablecer la contraseña',
  NotificationController_markRead: 'Marcar una notificación como leída',
  NotificationController_markAllRead: 'Marcar todas las notificaciones como leídas',
  PlatformController_changeUserRole: 'Cambiar el rol de un usuario',
  PlatformController_changeUserStatus: 'Cambiar el estado de un usuario',
  ClubWorkersController_startMyShift: 'Iniciar mi turno',
  ClubWorkersController_syncMyShift: 'Sincronizar mi turno',
  ClubsController_getAdminDashboard: 'Obtener el panel administrativo de una discoteca',
  ClubsController_getCustomerHome: 'Obtener el inicio para clientes',
  ClubsController_exploreCustomerContent: 'Explorar contenido para clientes',
  ClubsController_getCustomerClubDetail: 'Obtener el detalle público de una discoteca',
  ClubsController_getCustomerEventDetail: 'Obtener el detalle de un evento para clientes',
  ClubsController_getOperationalProfile: 'Obtener el perfil operativo de una discoteca',
  ClubsController_updateOperationalProfile: 'Actualizar el perfil operativo de una discoteca',
  UploadsController_createPresignedUploadUrl: 'Crear una URL de carga firmada',
  AdminEventsController_getAdminEventsDashboard: 'Obtener el panel administrativo de eventos',
  ClubEventsController_listClubEvents: 'Listar los eventos de una discoteca',
  ClubEventsController_startSale: 'Iniciar la venta de un evento',
  PublicEventsController_listPublicEvents: 'Listar eventos públicos',
  PublicEventsController_getPublicEvent: 'Obtener un evento público',
  CapacityController_configure: 'Configurar el aforo de una discoteca',
  CapacityController_correct: 'Corregir el aforo de una discoteca',
  ClubTicketsController_createClubTicketType: 'Crear un tipo de entrada de discoteca',
  ClubTicketsController_listClubTicketTypes: 'Listar tipos de entrada de discoteca',
  ClubTicketsController_updateTicketType: 'Actualizar un tipo de entrada de discoteca',
  ClubTicketsController_deleteTicketType: 'Eliminar un tipo de entrada de discoteca',
  ClubTicketsController_deactivateTicketType: 'Desactivar un tipo de entrada de discoteca',
  ClubTicketsController_activateTicketType: 'Activar un tipo de entrada de discoteca',
  EventTicketsController_createEventTicketType: 'Crear un tipo de entrada de evento',
  EventTicketsController_listEventTicketTypes: 'Listar tipos de entrada de evento',
  EventTicketsController_updateEventTicketType: 'Actualizar un tipo de entrada de evento',
  EventTicketsController_deleteEventTicketType: 'Eliminar un tipo de entrada de evento',
  EventTicketsController_deactivateEventTicketType: 'Desactivar un tipo de entrada de evento',
  EventTicketsController_activateEventTicketType: 'Activar un tipo de entrada de evento',
  UsersController_updateMyProfile: 'Actualizar mi perfil',
  WalletsController_getClubLedger: 'Obtener el libro mayor de una discoteca',
  WalletsController_reconcileOrder: 'Conciliar una orden',
  WalletsController_dailyDifferences: 'Obtener las diferencias diarias',
  WalletsController_upsertFinancialProfile: 'Crear o actualizar el perfil financiero',
  WalletsController_clubWithdrawals: 'Listar retiros de una discoteca',
  WalletsController_platformWithdrawals: 'Listar retiros de la plataforma',
  WalletsController_payWithdrawal: 'Marcar un retiro como pagado',
  WalletsController_failWithdrawal: 'Marcar un retiro como fallido',
  CommerceController_checkout: 'Completar el checkout del carrito',
  CommerceController_cart: 'Obtener el carrito actual',
  CommerceController_addCartItem: 'Añadir un ítem al carrito',
  CommerceController_updateCartItem: 'Actualizar un ítem del carrito',
  CommerceController_deleteCartItem: 'Eliminar un ítem del carrito',
  CommerceController_reservationMetrics: 'Obtener métricas de reservas',
  CommerceController_createWalletTopUp: 'Crear una recarga de billetera',
  CommerceController_walletTopUps: 'Listar recargas de billetera',
  CommerceController_walletTopUp: 'Obtener una recarga de billetera',
  CommerceController_clubOrders: 'Listar órdenes de una discoteca',
  CommerceController_exportClubOrders: 'Exportar órdenes de una discoteca',
  CommerceController_clubOrderDetail: 'Obtener el detalle de una orden de discoteca',
  CommerceController_payment: 'Obtener el estado del pago de una orden',
  CommerceController_operations: 'Obtener el panel operativo de una discoteca',
  CommerceController_tickets: 'Listar mis entradas',
  CommerceController_consumables: 'Listar mis consumibles',
  CommerceController_auditLogs: 'Listar validaciones auditadas',
  CommerceController_validateDetectedCode: 'Validar un código detectado',
  CapacityController_get: 'Obtener el aforo actual',
  CapacityController_stream: 'Transmitir actualizaciones de aforo',
  CapacityController_history: 'Listar el historial de aforo',
  CapacityController_exit: 'Registrar una salida de aforo',
  NotificationController_list: 'Listar mis notificaciones',
  NotificationController_preferences: 'Obtener preferencias de notificación',
  PlatformController_getDashboard: 'Obtener el panel global de la plataforma',
  AuditController_search: 'Buscar registros de auditoría',
  AuditController_policy: 'Obtener la política de auditoría',
  AuditController_verify: 'Verificar la integridad de auditoría',
  WalletsController_getMine: 'Obtener mi billetera',
  WalletsController_financialProfile: 'Obtener el perfil financiero de una discoteca',
  ReferralsController_mine: 'Obtener mi programa de referidos',
  ReferralsController_preview: 'Previsualizar un código de referido',
  ReferralsController_associate: 'Asociar un referido',
  ReferralsController_transfer: 'Transferir recompensas de referidos',
  ReferralsController_settings: 'Obtener la configuración de referidos',
  ReferralsController_updateSettings: 'Actualizar la configuración de referidos',
  ReferralsController_rewards: 'Listar recompensas de referidos',
  FlowPaymentsController_confirmation: 'Confirmar un pago notificado por Flow',
  FlowPaymentsController_returnGet: 'Mostrar el retorno de Flow mediante GET',
  FlowPaymentsController_returnPost: 'Mostrar el retorno de Flow mediante POST',
};

const WORDS: Record<string, string> = {
  admin: 'administrador',
  dashboard: 'panel',
  events: 'eventos',
  event: 'evento',
  club: 'discoteca',
  clubs: 'discotecas',
  customer: 'cliente',
  content: 'contenido',
  detail: 'detalle',
  public: 'público',
  operational: 'operativo',
  profile: 'perfil',
  worker: 'trabajador',
  workers: 'trabajadores',
  permissions: 'permisos',
  device: 'dispositivo',
  shift: 'turno',
  shifts: 'turnos',
  product: 'producto',
  products: 'productos',
  promotion: 'promoción',
  promotions: 'promociones',
  ticket: 'entrada',
  tickets: 'entradas',
  type: 'tipo',
  types: 'tipos',
  user: 'usuario',
  users: 'usuarios',
  role: 'rol',
  status: 'estado',
  policy: 'política',
  preference: 'preferencia',
  all: 'todas',
  read: 'leída',
  mine: 'propia',
  ledger: 'libro mayor',
  reconciliation: 'conciliación',
  daily: 'diaria',
  differences: 'diferencias',
  withdrawal: 'retiro',
  withdrawals: 'retiros',
  financial: 'financiero',
  cart: 'carrito',
  item: 'ítem',
  order: 'orden',
  orders: 'órdenes',
  refund: 'devolución',
  reservation: 'reserva',
  metrics: 'métricas',
  wallet: 'billetera',
  top: 'recarga',
  up: '',
  payment: 'pago',
  attempt: 'intento',
  detected: 'detectado',
  code: 'código',
  redemption: 'canje',
  report: 'informe',
  upload: 'carga',
  presigned: 'firmada',
  url: 'URL',
  phone: 'teléfono',
  password: 'contraseña',
  refresh: 'refresh token',
  settings: 'configuración',
  rewards: 'recompensas',
};

const PARAMETER_DESCRIPTIONS: Record<string, string> = {
  clubId: 'UUID de la discoteca.',
  eventId: 'UUID del evento.',
  userId: 'UUID del usuario.',
  workerId: 'UUID del trabajador.',
  shiftId: 'UUID del turno.',
  deviceId: 'UUID del dispositivo.',
  notificationId: 'UUID de la notificación.',
  uploadId: 'UUID de la carga temporal.',
  productId: 'UUID del producto.',
  promotionId: 'UUID de la promoción.',
  ticketTypeId: 'UUID del tipo de entrada.',
  cartItemId: 'UUID del ítem del carrito.',
  orderId: 'UUID de la orden.',
  topUpId: 'UUID de la recarga.',
  attemptId: 'UUID del intento de pago.',
  resourceId: 'Identificador del recurso.',
  id: 'UUID del retiro.',
  code: 'Código de referido.',
  kind: 'Tipo de recurso canjeable.',
  query: 'Texto de búsqueda.',
  search: 'Texto de búsqueda por datos visibles.',
  role: 'Rol exacto por el que filtrar.',
  status: 'Estado exacto por el que filtrar.',
  page: 'Número de página, comenzando en 1.',
  pageSize: 'Cantidad máxima de elementos por página.',
  from: 'Inicio inclusivo del intervalo en formato ISO 8601.',
  to: 'Fin inclusivo del intervalo en formato ISO 8601.',
  date: 'Fecha de conciliación en formato ISO 8601.',
  unreadOnly:
    'Filtra notificaciones no leídas. Por la transformación runtime actual, cualquier string no vacío —incluido "false"— se interpreta como true.',
  category: 'Categoría de notificación.',
  readStatus: 'Estado de lectura de las notificaciones.',
  action: 'Acción de auditoría.',
  resourceType: 'Tipo del recurso auditado.',
  correlationId: 'Identificador de correlación del flujo auditado.',
  actorUserId: 'UUID del usuario que ejecutó la acción.',
  severity: 'Severidad del registro de auditoría.',
  token: 'Token opaco enviado por Flow.',
  q: 'Texto de búsqueda de contenido.',
  district: 'Distrito usado para localizar contenido.',
  province: 'Provincia usada para localizar contenido.',
  department: 'Departamento usado para localizar contenido.',
};

const ERROR_CODES_BY_OPERATION: Record<string, Record<string, string[]>> = {
  AuthController_register: {
    '400': ['VALIDATION_ERROR'],
    '409': ['PHONE_ALREADY_REGISTERED', 'EMAIL_ALREADY_REGISTERED'],
    '503': ['SMS_SEND_FAILED'],
  },
  AuthController_confirmPhone: {
    '400': [
      'VALIDATION_ERROR',
      'PHONE_CODE_NOT_FOUND',
      'PHONE_CODE_EXPIRED',
      'PHONE_CODE_ATTEMPTS_EXCEEDED',
      'INVALID_PHONE_CODE',
    ],
    '404': ['USER_NOT_FOUND'],
  },
  AuthController_resendPhoneCode: {
    '400': ['VALIDATION_ERROR'],
    '404': ['USER_NOT_FOUND'],
    '503': ['SMS_SEND_FAILED'],
  },
  AuthController_login: {
    '400': ['VALIDATION_ERROR'],
    '401': ['INVALID_CREDENTIALS', 'PHONE_NOT_CONFIRMED', 'USER_NOT_ACTIVE'],
  },
  AuthController_refresh: {
    '400': ['VALIDATION_ERROR'],
    '401': ['INVALID_REFRESH_TOKEN', 'PHONE_NOT_CONFIRMED', 'USER_NOT_ACTIVE'],
  },
  AuthController_logout: {
    '400': ['VALIDATION_ERROR'],
    '401': ['INVALID_REFRESH_TOKEN'],
  },
  AuthController_requestPasswordReset: {
    '400': ['VALIDATION_ERROR', 'PHONE_NOT_CONFIRMED'],
    '404': ['USER_NOT_FOUND'],
    '503': ['SMS_SEND_FAILED'],
  },
  AuthController_resetPassword: {
    '400': [
      'VALIDATION_ERROR',
      'PHONE_CODE_NOT_FOUND',
      'PHONE_CODE_EXPIRED',
      'PHONE_CODE_ATTEMPTS_EXCEEDED',
      'INVALID_PHONE_CODE',
    ],
    '404': ['USER_NOT_FOUND'],
  },
  AuthController_me: { '401': ['INVALID_ACCESS_TOKEN'] },
};

export function enhanceOpenApiDocument(document: OpenAPIObject): OpenAPIObject {
  (
    document as OpenAPIObject & {
      'x-excluded-operations'?: readonly string[];
    }
  )['x-excluded-operations'] = OPENAPI_EXCLUDED_OPERATION_ALLOWLIST;
  document.components ??= {};
  document.components.schemas = {
    ...(document.components.schemas ?? {}),
    ...sharedSchemas(),
    ...OPENAPI_RESPONSE_SCHEMAS,
  };

  const usedSummaries = new Set<string>();
  for (const [path, item] of Object.entries(document.paths)) {
    const pathItem = item as Record<string, OperationObject>;
    for (const method of HTTP_METHODS) {
      const operation = pathItem?.[method];
      if (!operation) continue;
      const operationId = operation.operationId!;
      const isPublic = publicOperations.has(operationId);
      operation.tags = [
        (operation.tags?.[0] === 'FlowPayments' ? 'Flow Payments' : operation.tags?.[0]) ?? 'API',
      ];
      operation.summary = uniqueSummary(
        summaryFor(operationId, operation.tags[0]),
        usedSummaries,
        operation.tags[0],
      );
      operation.description = descriptionFor(operation, path, method, isPublic);
      operation.security = isPublic ? [] : [{ bearer: [] }];
      normalizeParameters(operation);
      normalizeRequestBody(operation, operationId, document);
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
    ValidationErrorDetail: {
      type: 'object',
      additionalProperties: false,
      required: ['field', 'messages'],
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
          description: 'Detalles adicionales; en validación usa objetos ValidationErrorDetail.',
          items: {
            oneOf: [
              { $ref: '#/components/schemas/ValidationErrorDetail' },
              { type: 'object', additionalProperties: true },
            ],
          },
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
    Pagination: {
      type: 'object',
      additionalProperties: false,
      required: ['page', 'pageSize', 'total', 'totalPages'],
      properties: {
        page: { type: 'integer', minimum: 1, example: 1 },
        pageSize: { type: 'integer', minimum: 1, example: 20 },
        total: { type: 'integer', minimum: 0, example: 42 },
        totalPages: { type: 'integer', minimum: 1, example: 3 },
      },
    },
  };
}

function summaryFor(operationId: string, tag: string): string {
  if (SUMMARY_OVERRIDES[operationId]) return SUMMARY_OVERRIDES[operationId];
  const methodName = operationId.split('_').slice(1).join('_');
  for (const [pattern, action] of ACTIONS) {
    if (!pattern.test(methodName)) continue;
    const remainder = methodName.replace(pattern, '');
    return `${action} ${translateWords(remainder || tag)}`.replace(/\s+/g, ' ').trim();
  }
  const fallback: Record<string, string> = {
    me: 'Obtener el usuario autenticado',
    mine: 'Obtener los recursos propios',
    cart: 'Obtener el carrito',
    policy: 'Obtener la política',
    preferences: 'Obtener las preferencias',
    settings: 'Obtener la configuración',
    operations: 'Obtener el panel operativo',
    payment: 'Obtener el pago',
    history: 'Listar el historial',
    report: 'Obtener el informe',
    rewards: 'Listar las recompensas',
  };
  return fallback[methodName] ?? `Obtener ${translateWords(methodName || tag)}`;
}

function translateWords(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => WORDS[word.toLowerCase()] ?? word.toLowerCase())
    .filter(Boolean)
    .join(' ');
}

function uniqueSummary(summary: string, used: Set<string>, tag: string): string {
  if (!used.has(summary)) {
    used.add(summary);
    return summary;
  }
  const unique = `${summary} en ${tag}`;
  used.add(unique);
  return unique;
}

function descriptionFor(
  operation: OperationObject,
  path: string,
  method: (typeof HTTP_METHODS)[number],
  isPublic: boolean,
): string {
  const access = isPublic
    ? 'Acceso público: no requiere access token.'
    : `Requiere access token bearer. ${authorizationRule(
        operation.operationId!,
        path,
        operation.tags?.[0] ?? 'API',
      )}`;
  const sideEffect = ['post', 'put', 'patch', 'delete'].includes(method)
    ? 'Puede producir cambios persistentes; cuando el body acepta idempotencyKey, las repeticiones usan esa clave conforme al runtime.'
    : 'No modifica el recurso consultado.';
  const details = OPERATION_DETAILS[operation.operationId!] ?? '';
  return `${operation.summary}. Devuelve el payload directo que emite actualmente la aplicación, sin envelope de éxito. ${access} ${sideEffect} ${details}`.trim();
}

const OPERATION_DETAILS: Record<string, string> = {
  UploadsController_createPresignedUploadUrl:
    'Inicia una carga directa a S3: admite JPEG, PNG y WebP de hasta 10 MB y devuelve uploadUrl, objectKey, headers y una vigencia de 300 segundos. NestJS no recibe el binario; el cliente debe hacer PUT a S3 usando exactamente el Content-Type indicado.',
  UploadsController_confirmUpload:
    'Confirma el objeto subido previamente a S3 mediante POST /uploads/{uploadId}/confirm; valida tamaño y MIME antes de devolver objectKey y la URL pública actual.',
  CommerceController_exportClubOrders:
    'Entrega text/csv como descarga mediante Content-Disposition; aplica los mismos filtros que el listado de órdenes.',
  CapacityController_stream:
    'Mantiene un stream text/event-stream y emite capacity.updated cuando cambia la revisión del aforo.',
  CapacityController_history:
    'Devuelve como máximo los 500 movimientos más recientes; no es una respuesta paginada.',
  NotificationController_list:
    'El listado está acotado por el servicio y no publica metadata de paginación.',
  WalletsController_clubWithdrawals: 'El listado es acotado y no publica metadata de paginación.',
  WalletsController_platformWithdrawals:
    'Devuelve como máximo 200 retiros y no publica metadata de paginación.',
  ClubWorkersController_listShifts:
    'Devuelve como máximo 100 turnos y no publica metadata de paginación.',
  FlowPaymentsController_confirmation:
    'Flow envía token obligatorio mediante application/x-www-form-urlencoded; el callback verifica y procesa el evento de pago.',
  FlowPaymentsController_returnPost:
    'Acepta token opcional mediante application/x-www-form-urlencoded y devuelve HTML no almacenable.',
  FlowPaymentsController_returnGet:
    'Acepta token opcional en query y devuelve HTML con Cache-Control no-store, max-age=0.',
};

function authorizationRule(operationId: string, path: string, tag: string): string {
  if (operationId.startsWith('PlatformController_') || operationId.startsWith('AuditController_')) {
    return 'Exige rol SUPER_ADMIN.';
  }
  if (operationId.startsWith('AdminEventsController_')) {
    return 'Exige rol ADMIN o SUPER_ADMIN.';
  }
  if (path.includes('/platform/referrals/')) return 'Exige rol SUPER_ADMIN.';
  if (tag === 'Notification') return 'Limita la operación al usuario autenticado.';
  if (tag === 'Users') {
    return operationId === 'UsersController_updateMyProfile'
      ? 'Limita la actualización al perfil del usuario autenticado.'
      : 'Exige rol ADMIN o SUPER_ADMIN.';
  }
  if (tag === 'Uploads') return 'Limita la carga al usuario autenticado que la inició.';
  if (/ClubWorkersController_(startMyShift|syncMyShift)/.test(operationId)) {
    return 'Exige un trabajador activo y limita el turno y dispositivo al usuario autenticado.';
  }
  if (operationId.startsWith('ClubWorkersController_')) {
    return 'Exige rol ADMIN o SUPER_ADMIN, pertenencia a la discoteca y los permisos operativos aplicables.';
  }
  if (operationId.startsWith('ClubsController_')) {
    if (/getCustomer|exploreCustomer/.test(operationId)) {
      return 'Devuelve únicamente contenido visible para el usuario autenticado.';
    }
    if (/activateClub|deactivateClub/.test(operationId)) return 'Exige rol SUPER_ADMIN.';
    if (operationId === 'ClubsController_createClub') return 'Exige rol ADMIN o SUPER_ADMIN.';
    if (operationId === 'ClubsController_getAdminDashboard') {
      return 'Exige rol ADMIN, SUPER_ADMIN o WORKER y limita el panel a una discoteca vinculada al usuario.';
    }
    if (/listClubs|getClub/.test(operationId)) {
      return 'Filtra la visibilidad por rol: SUPER_ADMIN ve todas, ADMIN las que administra y los demás usuarios sólo las activas.';
    }
    return 'Exige rol ADMIN o SUPER_ADMIN y ownership de la discoteca.';
  }
  if (
    ['Club Events', 'Club Products', 'Club Promotions', 'Club Tickets', 'Event Tickets'].includes(
      tag,
    )
  ) {
    return 'Exige rol ADMIN o SUPER_ADMIN y ownership de la discoteca asociada.';
  }
  if (tag === 'Capacity') {
    const mutatesCapacity = /_(configure|exit|correct)$/.test(operationId);
    return mutatesCapacity
      ? 'Exige rol ADMIN o SUPER_ADMIN, o un trabajador autorizado con permiso MANAGE_CAPACITY.'
      : 'Exige rol ADMIN o SUPER_ADMIN, o un trabajador autorizado con permiso VIEW_CAPACITY.';
  }
  if (operationId.startsWith('WalletsController_')) {
    if (operationId === 'WalletsController_getMine') {
      return 'Limita la billetera al usuario autenticado.';
    }
    if (operationId === 'WalletsController_dailyDifferences') return 'Exige rol SUPER_ADMIN.';
    if (
      /platformWithdrawals|reviewWithdrawal|processWithdrawal|payWithdrawal|failWithdrawal/.test(
        operationId,
      )
    ) {
      return 'Exige rol SUPER_ADMIN.';
    }
    return 'Exige rol ADMIN o SUPER_ADMIN y ownership de la discoteca o recurso financiero.';
  }
  if (path.includes('/validate/') || path.includes('/redemptions/')) {
    return 'Exige un trabajador o administrador autorizado y verifica discoteca, turno, dispositivo y permisos operativos.';
  }
  if (/CommerceController_(simulatePayment)/.test(operationId)) return 'Exige rol SUPER_ADMIN.';
  if (operationId === 'CommerceController_reservationMetrics') {
    return 'Permite ADMIN o SUPER_ADMIN con ownership, o un trabajador activo con permiso VIEW_DASHBOARD.';
  }
  if (operationId === 'CommerceController_requestRefund') {
    return 'Permite ADMIN o SUPER_ADMIN con ownership, o un trabajador activo con permiso REQUEST_REFUNDS.';
  }
  if (
    /CommerceController_(clubOrders|exportClubOrders|clubOrderDetail|operations|auditLogs)/.test(
      operationId,
    )
  ) {
    if (operationId === 'CommerceController_operations') {
      return 'Permite ADMIN o SUPER_ADMIN con ownership, o un trabajador activo con permiso VIEW_OPERATIONS.';
    }
    if (operationId === 'CommerceController_auditLogs') {
      return 'Permite ADMIN o SUPER_ADMIN con ownership; un trabajador activo sólo puede consultar sus propios registros.';
    }
    return 'Permite ADMIN o SUPER_ADMIN con ownership, o un trabajador activo con permiso VIEW_SALES.';
  }
  if (operationId.startsWith('CommerceController_')) {
    return 'Limita carritos, órdenes, pagos, entradas, consumibles y recargas al usuario autenticado.';
  }
  if (operationId.startsWith('ReferralsController_')) {
    return 'Limita el programa, las recompensas y las transferencias al usuario autenticado.';
  }
  return 'Permite la operación a cualquier usuario autenticado.';
}

function normalizeParameters(operation: OperationObject): void {
  for (const raw of operation.parameters ?? []) {
    if (isReference(raw)) continue;
    const parameter = raw as ParameterObject;
    parameter.description =
      PARAMETER_DESCRIPTIONS[parameter.name] ??
      `Valor de ${translateWords(parameter.name)} aceptado por la operación.`;
    parameter.required = parameter.in === 'path' ? true : Boolean(parameter.required);
    const schema = (parameter.schema ??= { type: 'string' }) as SchemaObject;
    if (schema.allOf?.some((item) => isReference(item) && item.$ref.endsWith('/Object'))) {
      delete schema.allOf;
      schema.type = 'integer';
      schema.format = 'int32';
    }
    if (
      /(^id$|Id$)/.test(parameter.name) &&
      !['correlationId', 'externalPaymentId'].includes(parameter.name)
    ) {
      schema.type = 'string';
      schema.format = 'uuid';
    }
    if (parameter.name === 'kind') {
      schema.type = 'string';
      schema.enum = ['TICKET', 'PRODUCT', 'PROMOTION'];
    }
    if (['from', 'to'].includes(parameter.name)) schema.format = 'date-time';
    if (parameter.name === 'date') schema.format = 'date';
    if (parameter.in === 'query' && schema.default !== undefined) parameter.required = false;
    parameter.example ??= parameterExample(parameter.name, schema);
  }
}

function parameterExample(name: string, schema: SchemaObject): unknown {
  if (schema.enum?.length) return schema.enum[0];
  if (schema.format === 'uuid') return '11111111-1111-4111-8111-111111111111';
  if (schema.format === 'date-time') return '2026-08-01T00:00:00.000Z';
  if (schema.format === 'date') return '2026-08-27';
  if (name === 'page') return 1;
  if (name === 'pageSize') return schema.default ?? 20;
  if (name === 'unreadOnly') return true;
  if (name === 'token') return 'flow-token-ficticio';
  if (name === 'code') return 'REF-EXAMPLE';
  return 'ejemplo';
}

function normalizeRequestBody(
  operation: OperationObject,
  operationId: string,
  document: OpenAPIObject,
): void {
  if (operationId === 'FlowPaymentsController_confirmation') {
    operation.requestBody = flowRequestBody(true);
  } else if (operationId === 'FlowPaymentsController_returnPost') {
    operation.requestBody = flowRequestBody(false);
  }
  if (!operation.requestBody || isReference(operation.requestBody)) return;
  const requestBody = operation.requestBody as RequestBodyObject;
  requestBody.description ??=
    'Cuerpo validado con whitelist y rechazo de propiedades desconocidas.';
  for (const media of Object.values(requestBody.content) as Array<{
    schema?: SchemaObject | ReferenceObject;
  }>) {
    if (!media.schema || !isReference(media.schema)) continue;
    const name = media.schema.$ref.split('/').pop()!;
    closeRequestSchema(name, document, new Set());
  }

  if (operationId === 'UploadsController_createPresignedUploadUrl') {
    const schema = document.components?.schemas?.CreatePresignedUploadUrlDto as SchemaObject;
    const contentType = schema?.properties?.contentType as SchemaObject | undefined;
    if (contentType) {
      contentType.enum = ['image/jpeg', 'image/png', 'image/webp'];
      contentType.description = 'MIME real del archivo: JPEG, PNG o WebP.';
    }
    const sizeBytes = schema?.properties?.sizeBytes as SchemaObject | undefined;
    if (sizeBytes)
      sizeBytes.description = 'Tamaño del archivo en bytes; máximo 10 MB (10 485 760 bytes).';
  }
}

function closeRequestSchema(name: string, document: OpenAPIObject, visited: Set<string>): void {
  if (visited.has(name)) return;
  visited.add(name);
  const schema = document.components?.schemas?.[name];
  if (!schema || isReference(schema)) return;
  schema.additionalProperties = false;

  for (const [propertyName, raw] of Object.entries(schema.properties ?? {})) {
    if (isReference(raw)) {
      const target = raw.$ref.split('/').pop()!;
      schema.properties![propertyName] = {
        allOf: [raw],
        description: requestPropertyDescription(propertyName),
      };
      closeRequestSchema(target, document, visited);
      continue;
    }
    const property = raw as SchemaObject;
    property.description ??= requestPropertyDescription(propertyName);
    normalizeRequestPropertyMetadata(propertyName, property);
    property.example ??= requestPropertyExample(propertyName, property);
    for (const item of property.allOf ?? []) {
      if (isReference(item)) closeRequestSchema(item.$ref.split('/').pop()!, document, visited);
    }
    if (property.items && isReference(property.items)) {
      closeRequestSchema(property.items.$ref.split('/').pop()!, document, visited);
    }
  }
}

function normalizeRequestPropertyMetadata(name: string, schema: SchemaObject): void {
  if (/(^id$|Id$)/.test(name) && !['correlationId', 'externalPaymentId'].includes(name)) {
    schema.type = 'string';
    schema.format = 'uuid';
    schema.example = '11111111-1111-4111-8111-111111111111';
    delete schema.allOf;
    return;
  }
  if (/At$/.test(name) && schema.type === 'string') {
    schema.format = 'date-time';
    schema.example = '2026-08-27T18:30:00.000Z';
    return;
  }
  if (/email/i.test(name) && schema.type === 'string') {
    schema.format = 'email';
    schema.example = 'usuario@example.com';
    return;
  }
  if (/(^url$|Url$)/.test(name) && schema.type === 'string') {
    schema.format = 'uri';
    schema.example = 'https://example.com/recurso';
  }
}

function flowRequestBody(required: boolean): RequestBodyObject {
  return {
    required,
    description: required
      ? 'Callback form-urlencoded de Flow; token obligatorio.'
      : 'Retorno form-urlencoded de Flow; el token es opcional según el runtime.',
    content: {
      'application/x-www-form-urlencoded': {
        schema: {
          type: 'object',
          additionalProperties: false,
          ...(required ? { required: ['token'] } : {}),
          properties: {
            token: {
              type: 'string',
              description: 'Token opaco de Flow.',
              example: 'flow-token-ficticio',
            },
          },
        },
      },
    },
  };
}

function requestPropertyDescription(name: string): string {
  const known: Record<string, string> = {
    idempotencyKey: 'Clave única del cliente para repetir la operación sin duplicarla.',
    amountCents: 'Importe entero expresado en céntimos.',
    priceCents: 'Precio entero expresado en céntimos.',
    startsAt: 'Fecha y hora de inicio en formato ISO 8601.',
    endsAt: 'Fecha y hora de fin en formato ISO 8601.',
    assignedDoor: 'Puerta asignada al trabajador.',
    assignedZone: 'Zona asignada al trabajador.',
    assignedPoint: 'Punto operativo asignado al trabajador.',
    token: 'Token ficticio o del proveedor; nunca usar un valor real en ejemplos.',
  };
  return known[name] ?? `Valor de ${translateWords(name)} aceptado por el runtime.`;
}

function requestPropertyExample(name: string, schema: SchemaObject): unknown {
  if (schema.enum?.length) return schema.enum[0];
  if (schema.format === 'uuid') return '11111111-1111-4111-8111-111111111111';
  if (schema.format === 'email') return 'usuario@example.com';
  if (schema.format === 'date-time') return '2026-08-27T18:30:00.000Z';
  if (/Cents$/.test(name)) return 1500;
  if (/token/i.test(name)) return 'token-ficticio-no-valido';
  if (/phoneNumber/i.test(name)) return '999999999';
  if (/phoneCountryCode/i.test(name)) return '+51';
  if (schema.type === 'boolean') return false;
  if (schema.type === 'integer' || schema.type === 'number') return schema.minimum ?? 1;
  if (schema.type === 'string') return 'ejemplo';
  return undefined;
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
  operation.responses[successStatus] = successResponse(operationId);

  if (operationId === 'CommerceController_exportClubOrders') {
    operation.responses[successStatus] = {
      description: 'CSV UTF-8 con las órdenes visibles para la discoteca.',
      headers: {
        'Content-Disposition': {
          description: 'Fuerza la descarga con el nombre ventas-beerry.csv.',
          schema: { type: 'string', example: 'attachment; filename="ventas-beerry.csv"' },
        },
      },
      content: {
        'text/csv': {
          schema: {
            type: 'string',
            example: 'orderId,status,totalCents\n11111111-1111-4111-8111-111111111111,PAID,1500',
          },
        },
      },
    };
  }
  if (operationId === 'CapacityController_stream') {
    operation.responses[successStatus] = {
      description:
        'Stream SSE; emite eventos capacity.updated cada vez que cambia la revisión del aforo.',
      content: {
        'text/event-stream': {
          schema: {
            type: 'string',
            example:
              'event: capacity.updated\ndata: {"current":120,"capacity":300,"available":180,"revision":8}\n\n',
          },
        },
      },
    };
  }
  if (
    operationId === 'FlowPaymentsController_returnGet' ||
    operationId === 'FlowPaymentsController_returnPost'
  ) {
    operation.responses[successStatus] = {
      description: 'Página HTML que redirige de vuelta a la aplicación móvil.',
      headers: {
        'Cache-Control': {
          description: 'Impide almacenar la página de retorno.',
          schema: { type: 'string', example: 'no-store, max-age=0' },
        },
      },
      content: {
        'text/html': {
          schema: { type: 'string', example: '<!doctype html><html lang="es">...</html>' },
        },
      },
    };
    return;
  }

  if (
    operationId !== 'FlowPaymentsController_confirmation' &&
    (operation.requestBody ||
      (operation.parameters ?? []).some(
        (raw: ParameterObject | ReferenceObject) => !isReference(raw) && raw.in === 'query',
      ))
  ) {
    addError(
      operation,
      '400',
      'VALIDATION_ERROR',
      'La entrada o una regla de solicitud no es válida.',
    );
  }
  if (operationId === 'FlowPaymentsController_confirmation') {
    addInternalServerError(
      operation,
      'El token falta o Flow/configuración producen un Error que el manejador predeterminado de NestJS convierte en 500.',
    );
  }
  if (
    operationId === 'CommerceController_checkout' ||
    operationId === 'CommerceController_createWalletTopUp'
  ) {
    addInternalServerError(
      operation,
      'La configuración, red o respuesta de Flow produce un Error que el manejador predeterminado de NestJS convierte en 500.',
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
  if (
    !isPublic &&
    (operationId.startsWith('PlatformController_') || operationId.startsWith('AuditController_'))
  ) {
    addError(
      operation,
      '403',
      'SUPER_ADMIN_REQUIRED',
      'El rol, permiso u ownership no autoriza la operación.',
    );
  }

  for (const [status, codes] of Object.entries(OPENAPI_ERROR_CODES[operationId] ?? {})) {
    const existingResponse = operation.responses[status];
    if (
      !existingResponse ||
      (!isReference(existingResponse) && !existingResponse.content?.['application/json'])
    ) {
      addError(
        operation,
        status,
        codes[0],
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

  for (const [status, codes] of Object.entries(ERROR_CODES_BY_OPERATION[operationId] ?? {})) {
    const existingResponse = operation.responses[status];
    if (
      !existingResponse ||
      (!isReference(existingResponse) && !existingResponse.content?.['application/json'])
    ) {
      addError(
        operation,
        status,
        codes[0],
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

  // Ensure every response reference resolves after response replacement.
  document.components!.schemas ??= {};
}

function addInternalServerError(operation: OperationObject, description: string): void {
  operation.responses['500'] = {
    description,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/NestInternalServerError' },
        example: { statusCode: 500, message: 'Internal server error' },
      },
    },
  };
}

function applyErrorCodes(response: ResponseObject, codes: string[]): void {
  const extended = response as ResponseObject & { 'x-error-codes'?: string[] };
  const mergedCodes = [...new Set([...(extended['x-error-codes'] ?? []), ...codes])];
  extended['x-error-codes'] = mergedCodes;
  const media = response.content?.['application/json'];
  const example = media?.example;
  if (!example || typeof example !== 'object' || !('error' in example)) return;
  const error = (example as { error?: unknown }).error;
  if (!error || typeof error !== 'object' || !('code' in error)) return;
  (error as { code: string }).code = mergedCodes[0];
}

function errorDescription(status: string): string {
  const descriptions: Record<string, string> = {
    '400': 'La entrada o una regla de solicitud no es válida.',
    '401': 'Las credenciales o el token no son válidos.',
    '403': 'El rol, permiso u ownership no autoriza la operación.',
    '404': 'El recurso requerido no existe o no es visible.',
    '409': 'El estado actual impide completar la operación.',
    '503': 'Un proveedor requerido no está disponible.',
  };
  return descriptions[status] ?? 'La operación no pudo completarse.';
}

function successResponse(operationId: string): ResponseObject {
  return {
    description: 'Operación completada; payload directo emitido por el runtime actual.',
    content: {
      'application/json': {
        schema: { $ref: `#/components/schemas/${operationId}Response` },
      },
    },
  };
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
  return Boolean(value && typeof value === 'object' && '$ref' in value);
}
