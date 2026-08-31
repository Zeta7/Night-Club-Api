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

const UUID_EXAMPLES: Record<string, string> = {
  id: '7e6b8c1f-1a42-4d95-9f63-8c2b7a4e5d10',
  userId: '3c79f4a2-6e51-4b8a-9d27-1f5a0c83e642',
  clubId: '8f24c1d7-5b39-4a6e-92d8-7c3f1a5b604e',
  eventId: 'a6d9e2f4-7c31-4b58-8f20-5e1a9d63c742',
  productId: '5b8e1c93-2d64-4fa7-a318-9c6e42d075bf',
  promotionId: 'd2a7f951-8c43-4e60-b195-6f3d28a7c014',
  orderId: 'c4e91a67-3b58-4fd2-8a06-7d25e9c1b340',
  paymentAttemptId: '9d3b7e15-6a42-4c98-b571-2f8e0a63d4c9',
  uploadId: 'f7a2c864-1d39-4e5b-90a6-3c8d27b154ef',
  workerId: '2e8c5a71-9b34-4d60-a192-6f7e3c48b025',
  shiftId: '6a1d9f42-3c75-4e8b-b206-5d7a91c4f638',
  deviceId: 'b3f7c216-8a59-4d40-9e15-2c6a74f893bd',
  ticketTypeId: 'e5c2a831-7d49-4b60-a918-3f6e25d7c104',
  ticketId: '4a9e7c32-6b15-4d80-8f24-1c5e93a7b642',
  notificationId: '1c6e8a42-9f35-4d70-b821-5a3c97e4d608',
  referralId: '7b2d5e91-4a68-4c30-9f15-2e8a63d7b049',
  transactionId: '0f8c2a75-6d41-4b93-a527-9e3d16c8f204',
  walletId: '5d7a1c84-3e69-4f20-8b15-6c2e97a4d038',
};

function uuidExample(name: string): string {
  if (UUID_EXAMPLES[name]) return UUID_EXAMPLES[name];
  const match = Object.keys(UUID_EXAMPLES).find(
    (key) => key !== 'id' && name.toLowerCase().includes(key.replace(/Id$/, '').toLowerCase()),
  );
  return (match && UUID_EXAMPLES[match]) || UUID_EXAMPLES.id;
}

function uriExample(name: string, context: string[] = []): string {
  if (/uploadUrl/i.test(name)) {
    return 'https://nightclub-platform-assets.s3.amazonaws.com/uploads/2026/08/nebula-cover.webp?X-Amz-Expires=300';
  }
  if (/checkoutUrl/i.test(name)) {
    return 'https://sandbox.flow.cl/app/web/pay.php?token=tok_8f3d1c7a6b2e4f90a5d8c1e7';
  }
  if (/shareUrl/i.test(name)) return 'https://beerry.app/eventos/noche-latina';
  if (/proofUrl/i.test(name)) {
    return 'https://cdn.beerry.app/withdrawals/comprobante-2026-0042.pdf';
  }
  if (/attendee|profile|user/i.test(name)) {
    return 'https://cdn.beerry.app/users/valeria/profile.webp';
  }
  const fields = new Set(context);
  if (fields.has('type') && fields.has('url')) return 'https://instagram.com/nebula.club';
  if (fields.has('objectKey')) {
    return 'https://cdn.beerry.app/uploads/2026/08/nebula-cover.webp';
  }
  if (fields.has('stockQuantity')) {
    return 'https://cdn.beerry.app/products/chilcano-maracuya.webp';
  }
  if (fields.has('pricingMode') || fields.has('itemsCount')) {
    return 'https://cdn.beerry.app/promotions/combo-bienvenida.webp';
  }
  if (fields.has('startsAt') || fields.has('endsAt')) {
    return 'https://cdn.beerry.app/events/noche-latina/cover.webp';
  }
  return 'https://cdn.beerry.app/clubs/nebula/cover.webp';
}

function tokenExample(name: string, context: string[] = []): string {
  if (/tokenType/i.test(name)) return 'Bearer';
  if (/refresh/i.test(name)) return 'rft_7Kp4mN9xQ2vL8sD5cB1hJ6wF3aR0';
  if (/access/i.test(name)) {
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzYzc5ZjRhMi02ZTUxLTRiOGEtOWQyNy0xZjVhMGM4M2U2NDIifQ.W7sP2kQ9mR4vN8xL1cD6';
  }
  const fields = new Set(context);
  if (fields.has('platform') || fields.has('deviceId')) {
    return 'dQw4w9WgXcQ:APA91bG7Kp4mN9xQ2vL8sD5cB1hJ6wF3aR0eT7uY2iO9pA4sD8fG1hJ5kL3zX6cV0bN2mQ';
  }
  return 'tok_8f3d1c7a6b2e4f90a5d8c1e7';
}

function dateTimeExample(name: string): string {
  if (/createdAt/i.test(name)) return '2026-08-27T18:30:00.000Z';
  if (/updatedAt/i.test(name)) return '2026-08-28T14:15:00.000Z';
  if (/approvedAt|paidAt/i.test(name)) return '2026-09-19T22:05:00.000Z';
  if (/endsAt|saleEndAt|\bto\b/i.test(name)) return '2026-09-20T05:00:00.000Z';
  if (/saleStartAt/i.test(name)) return '2026-09-01T12:00:00.000Z';
  return '2026-09-19T22:00:00.000Z';
}

function stringExample(name: string, context: string[] = []): string {
  const examples: Record<string, string> = {
    action: 'ORDER_REFUNDED',
    assignedDoor: 'Acceso norte',
    assignedPoint: 'Barra central',
    assignedZone: 'Pista principal',
    bankAccountHolder: 'Inversiones Nébula S.A.C.',
    bankAccountNumber: '19123456789012',
    bankAccountType: 'CORRIENTE',
    bankName: 'Banco de Crédito del Perú',
    correlationId: 'req_01J6M8R4Q2AX7NV5K3ZT9C1BDE',
    currency: 'PEN',
    department: 'Lima',
    deviceFingerprint: 'ios-4f8d2a91c7e6b305',
    district: 'Miraflores',
    fingerprint: 'sha256:4f8d2a91c7e6b3059c1a7e24d8b6f3c0',
    idempotencyKey: 'checkout-20260919-valeria-0042',
    legalName: 'Inversiones Nébula S.A.C.',
    note: 'Ajuste autorizado durante el cierre de caja.',
    password: 'NocheSegura#2026',
    paymentReference: 'FLOW-20260919-847215',
    platform: 'ios',
    province: 'Lima',
    q: 'música latina',
    qrCode: 'BRY-TKT-8K4M2P',
    query: 'Valeria Mendoza',
    reason: 'Ajuste autorizado por cierre de caja.',
    refundPolicy: 'Se aceptan solicitudes hasta 48 horas antes del evento.',
    resourceType: 'ORDER',
    responsibleName: 'Valeria Mendoza',
    responsiblePhone: '+51987654321',
    search: 'Valeria Mendoza',
    status: 'PENDING',
    taxDocumentNumber: '20601234567',
    taxDocumentType: 'RUC',
  };
  if (examples[name]) return examples[name];
  const fields = new Set(context);
  if (name === 'code') {
    return fields.has('qrCode') || fields.has('confirm') ? 'BRY-TKT-8K4M2P' : 'VALERIA25';
  }
  if (name === 'description') {
    if (fields.has('stockQuantity')) return 'Chilcano de maracuyá preparado en barra.';
    if (fields.has('pricingMode') || fields.has('items')) {
      return 'Incluye dos chilcanos de maracuyá a precio promocional.';
    }
    if (fields.has('quantityTotal') || fields.has('perUserLimit')) {
      return 'Acceso a la zona VIP durante el evento.';
    }
    if (fields.has('startsAt') || fields.has('endsAt')) {
      return 'Evento de música latina con acceso general y zona VIP.';
    }
    return 'Local nocturno con pista principal, zona VIP y servicio de barra.';
  }
  if (name === 'name') {
    if (fields.has('platform') || fields.has('fingerprint')) return 'iPhone 15 Pro de Valeria';
    if (fields.has('stockQuantity')) return 'Chilcano de maracuyá';
    if (fields.has('pricingMode') || fields.has('itemsCount')) return 'Combo de bienvenida';
    if (fields.has('quantityTotal') || fields.has('perUserLimit')) return 'Entrada VIP';
    if (fields.has('startsAt') || fields.has('endsAt')) return 'Noche Latina';
    return 'Nébula Club';
  }
  return 'Noche Latina';
}

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
  ClubsController_getAdminDashboard: 'Obtener el panel administrativo de un local nocturno',
  ClubsController_getCustomerHome: 'Obtener el inicio para clientes',
  ClubsController_exploreCustomerContent: 'Explorar contenido para clientes',
  ClubsController_getCustomerClubDetail: 'Obtener el detalle público de un local nocturno',
  ClubsController_getCustomerEventDetail: 'Obtener el detalle de un evento para clientes',
  ClubsController_getOperationalProfile: 'Obtener el perfil operativo de un local nocturno',
  ClubsController_updateOperationalProfile: 'Actualizar el perfil operativo de un local nocturno',
  UploadsController_createPresignedUploadUrl: 'Crear una URL de carga firmada',
  AdminEventsController_getAdminEventsDashboard: 'Obtener el panel administrativo de eventos',
  ClubEventsController_listClubEvents: 'Listar los eventos de un local nocturno',
  ClubEventsController_startSale: 'Iniciar la venta de un evento',
  PublicEventsController_listPublicEvents: 'Listar eventos públicos',
  PublicEventsController_getPublicEvent: 'Obtener un evento público',
  CapacityController_configure: 'Configurar el aforo de un local nocturno',
  CapacityController_correct: 'Corregir el aforo de un local nocturno',
  ClubTicketsController_createClubTicketType: 'Crear un tipo de entrada para un local nocturno',
  ClubTicketsController_listClubTicketTypes: 'Listar tipos de entrada de un local nocturno',
  ClubTicketsController_updateTicketType: 'Actualizar un tipo de entrada de un local nocturno',
  ClubTicketsController_deleteTicketType: 'Eliminar un tipo de entrada de un local nocturno',
  ClubTicketsController_deactivateTicketType: 'Desactivar un tipo de entrada de un local nocturno',
  ClubTicketsController_activateTicketType: 'Activar un tipo de entrada de un local nocturno',
  EventTicketsController_createEventTicketType: 'Crear un tipo de entrada de evento',
  EventTicketsController_listEventTicketTypes: 'Listar tipos de entrada de evento',
  EventTicketsController_updateEventTicketType: 'Actualizar un tipo de entrada de evento',
  EventTicketsController_deleteEventTicketType: 'Eliminar un tipo de entrada de evento',
  EventTicketsController_deactivateEventTicketType: 'Desactivar un tipo de entrada de evento',
  EventTicketsController_activateEventTicketType: 'Activar un tipo de entrada de evento',
  UsersController_updateMyProfile: 'Actualizar mi perfil',
  WalletsController_getClubLedger: 'Obtener el libro mayor de un local nocturno',
  WalletsController_reconcileOrder: 'Conciliar una orden',
  WalletsController_dailyDifferences: 'Obtener las diferencias diarias',
  WalletsController_upsertFinancialProfile: 'Crear o actualizar el perfil financiero',
  WalletsController_clubWithdrawals: 'Listar retiros de un local nocturno',
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
  CommerceController_clubOrders: 'Listar órdenes de un local nocturno',
  CommerceController_exportClubOrders: 'Exportar órdenes de un local nocturno',
  CommerceController_clubOrderDetail: 'Obtener el detalle de una orden de un local nocturno',
  CommerceController_payment: 'Obtener el estado del pago de una orden',
  CommerceController_operations: 'Obtener el panel operativo de un local nocturno',
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
  WalletsController_financialProfile: 'Obtener el perfil financiero de un local nocturno',
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
  club: 'local nocturno',
  clubs: 'locales nocturnos',
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
  clubId: 'UUID del local nocturno.',
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
    'Filtra notificaciones no leídas. Cualquier texto no vacío, incluso "false", se interpreta como true.',
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
      operation.description = descriptionFor(operation, path, isPublic);
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

function descriptionFor(operation: OperationObject, path: string, isPublic: boolean): string {
  const access = isPublic
    ? 'Acceso público.'
    : authorizationRule(operation.operationId!, path, operation.tags?.[0] ?? 'API');
  const details = OPERATION_DETAILS[operation.operationId!] ?? '';
  return [access, details].filter(Boolean).join(' ');
}

const OPERATION_DETAILS: Record<string, string> = {
  UploadsController_createPresignedUploadUrl:
    'Genera los datos para cargar JPEG, PNG o WebP de hasta 10 MB directamente a S3. La URL vence en 5 minutos.',
  UploadsController_confirmUpload: 'Valida el archivo cargado y devuelve su clave y URL pública.',
  CommerceController_exportClubOrders:
    'Descarga un CSV con los mismos filtros del listado de órdenes.',
  CapacityController_stream: 'Abre un stream SSE y emite capacity.updated cuando cambia el aforo.',
  CapacityController_history: 'Devuelve los últimos 500 movimientos sin paginación.',
  NotificationController_list: 'Devuelve un listado limitado y sin paginación.',
  WalletsController_clubWithdrawals: 'Devuelve un listado limitado y sin paginación.',
  WalletsController_platformWithdrawals: 'Devuelve hasta 200 retiros sin paginación.',
  ClubWorkersController_listShifts: 'Devuelve hasta 100 turnos sin paginación.',
  FlowPaymentsController_confirmation: 'Recibe el token de Flow y procesa el evento de pago.',
  FlowPaymentsController_returnPost:
    'Acepta un token opcional y devuelve una página HTML sin caché.',
  FlowPaymentsController_returnGet:
    'Acepta un token opcional en la URL y devuelve una página HTML sin caché.',
};

function authorizationRule(operationId: string, path: string, tag: string): string {
  if (operationId.startsWith('PlatformController_') || operationId.startsWith('AuditController_')) {
    return 'Solo para SUPER_ADMIN.';
  }
  if (operationId.startsWith('AdminEventsController_')) {
    return 'Solo para ADMIN o SUPER_ADMIN.';
  }
  if (path.includes('/platform/referrals/')) return 'Solo para SUPER_ADMIN.';
  if (tag === 'Notification') return 'Solo para el usuario autenticado.';
  if (tag === 'Users') {
    return operationId === 'UsersController_updateMyProfile'
      ? 'Solo para el usuario autenticado.'
      : 'Solo para ADMIN o SUPER_ADMIN.';
  }
  if (tag === 'Uploads') return 'Solo para el usuario que inició la carga.';
  if (/ClubWorkersController_(startMyShift|syncMyShift)/.test(operationId)) {
    return 'Solo para el trabajador activo asignado al turno y dispositivo.';
  }
  if (operationId.startsWith('ClubWorkersController_')) {
    return 'Solo para ADMIN o SUPER_ADMIN con acceso al local nocturno.';
  }
  if (operationId.startsWith('ClubsController_')) {
    if (/getCustomer|exploreCustomer/.test(operationId)) {
      return 'Muestra solo contenido visible para el usuario autenticado.';
    }
    if (/activateClub|deactivateClub/.test(operationId)) return 'Solo para SUPER_ADMIN.';
    if (operationId === 'ClubsController_createClub') return 'Solo para ADMIN o SUPER_ADMIN.';
    if (operationId === 'ClubsController_getAdminDashboard') {
      return 'Para ADMIN, SUPER_ADMIN o WORKER vinculados al local nocturno.';
    }
    if (/listClubs|getClub/.test(operationId)) {
      return 'La visibilidad depende del rol y del acceso al local nocturno.';
    }
    return 'Solo para ADMIN o SUPER_ADMIN con acceso al local nocturno.';
  }
  if (
    ['Club Events', 'Club Products', 'Club Promotions', 'Club Tickets', 'Event Tickets'].includes(
      tag,
    )
  ) {
    return 'Solo para ADMIN o SUPER_ADMIN con acceso al local nocturno.';
  }
  if (tag === 'Capacity') {
    const mutatesCapacity = /_(configure|exit|correct)$/.test(operationId);
    return mutatesCapacity
      ? 'Para ADMIN, SUPER_ADMIN o trabajadores con permiso MANAGE_CAPACITY.'
      : 'Para ADMIN, SUPER_ADMIN o trabajadores con permiso VIEW_CAPACITY.';
  }
  if (operationId.startsWith('WalletsController_')) {
    if (operationId === 'WalletsController_getMine') {
      return 'Solo para el usuario autenticado.';
    }
    if (operationId === 'WalletsController_dailyDifferences') return 'Solo para SUPER_ADMIN.';
    if (
      /platformWithdrawals|reviewWithdrawal|processWithdrawal|payWithdrawal|failWithdrawal/.test(
        operationId,
      )
    ) {
      return 'Solo para SUPER_ADMIN.';
    }
    return 'Solo para ADMIN o SUPER_ADMIN con acceso al local nocturno o recurso financiero.';
  }
  if (path.includes('/validate/') || path.includes('/redemptions/')) {
    return 'Para trabajadores o administradores autorizados en el local nocturno.';
  }
  if (/CommerceController_(simulatePayment)/.test(operationId)) return 'Solo para SUPER_ADMIN.';
  if (operationId === 'CommerceController_reservationMetrics') {
    return 'Para ADMIN, SUPER_ADMIN o trabajadores con permiso VIEW_DASHBOARD.';
  }
  if (operationId === 'CommerceController_requestRefund') {
    return 'Para ADMIN, SUPER_ADMIN o trabajadores con permiso REQUEST_REFUNDS.';
  }
  if (
    /CommerceController_(clubOrders|exportClubOrders|clubOrderDetail|operations|auditLogs)/.test(
      operationId,
    )
  ) {
    if (operationId === 'CommerceController_operations') {
      return 'Para ADMIN, SUPER_ADMIN o trabajadores con permiso VIEW_OPERATIONS.';
    }
    if (operationId === 'CommerceController_auditLogs') {
      return 'Para ADMIN, SUPER_ADMIN o trabajadores que consulten sus propios registros.';
    }
    return 'Para ADMIN, SUPER_ADMIN o trabajadores con permiso VIEW_SALES.';
  }
  if (operationId.startsWith('CommerceController_')) {
    return 'Solo para el usuario autenticado.';
  }
  if (operationId.startsWith('ReferralsController_')) {
    return 'Solo para el usuario autenticado.';
  }
  return 'Requiere autenticación.';
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
  if (schema.format === 'uuid') return uuidExample(name);
  if (schema.format === 'date-time') return dateTimeExample(name);
  if (schema.format === 'date') return '2026-09-19';
  if (name === 'page') return 1;
  if (name === 'pageSize') return schema.default ?? 20;
  if (name === 'unreadOnly') return true;
  if (name === 'token') return tokenExample('flowToken');
  return stringExample(name);
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
  requestBody.description ??= 'Solo acepta las propiedades documentadas; rechaza cualquier otra.';
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
      sizeBytes.description = 'Tamaño del archivo en bytes. El máximo es 10 MB (10 485 760 bytes).';
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
    normalizeRequestPropertyMetadata(propertyName, property, Object.keys(schema.properties ?? {}));
    property.example ??= requestPropertyExample(
      propertyName,
      property,
      Object.keys(schema.properties ?? {}),
    );
    for (const item of property.allOf ?? []) {
      if (isReference(item)) closeRequestSchema(item.$ref.split('/').pop()!, document, visited);
    }
    if (property.items && isReference(property.items)) {
      closeRequestSchema(property.items.$ref.split('/').pop()!, document, visited);
    }
  }
}

function normalizeRequestPropertyMetadata(
  name: string,
  schema: SchemaObject,
  context: string[] = [],
): void {
  if (/(^id$|Id$)/.test(name) && !['correlationId', 'externalPaymentId'].includes(name)) {
    schema.type = 'string';
    schema.format = 'uuid';
    schema.example = uuidExample(name);
    delete schema.allOf;
    return;
  }
  if (/At$/.test(name) && schema.type === 'string') {
    schema.format = 'date-time';
    schema.example = dateTimeExample(name);
    return;
  }
  if (/email/i.test(name) && schema.type === 'string') {
    schema.format = 'email';
    schema.example = 'valeria.mendoza@correo.pe';
    return;
  }
  if (/(^url$|Url$)/.test(name) && schema.type === 'string') {
    schema.format = 'uri';
    schema.example = uriExample(name, context);
    return;
  }
  if (/phoneNumber/i.test(name) && schema.type === 'string') {
    schema.example = '987654321';
  }
}

function flowRequestBody(required: boolean): RequestBodyObject {
  return {
    required,
    description: required
      ? 'Datos enviados por Flow. El token es obligatorio.'
      : 'Datos de retorno enviados por Flow. El token es opcional.',
    content: {
      'application/x-www-form-urlencoded': {
        schema: {
          title: required ? 'FlowConfirmationRequest' : 'FlowReturnRequest',
          type: 'object',
          additionalProperties: false,
          ...(required ? { required: ['token'] } : {}),
          properties: {
            token: {
              type: 'string',
              description: 'Token opaco de Flow.',
              example: tokenExample('flowToken'),
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
    token: 'Token opaco emitido por el proveedor correspondiente.',
  };
  return known[name] ?? `Valor de ${translateWords(name)} aceptado por el runtime.`;
}

function requestPropertyExample(
  name: string,
  schema: SchemaObject,
  context: string[] = [],
): unknown {
  if (schema.enum?.length) return schema.enum[0];
  if (schema.format === 'uuid') return uuidExample(name);
  if (schema.format === 'email') return 'valeria.mendoza@correo.pe';
  if (schema.format === 'date-time') return dateTimeExample(name);
  if (schema.format === 'date') return '2026-09-19';
  if (schema.format === 'uri') return uriExample(name, context);
  if (/Cents$/.test(name)) return 1500;
  if (/token/i.test(name)) return tokenExample(name, context);
  if (/phoneNumber/i.test(name)) return '987654321';
  if (/phoneCountryCode/i.test(name)) return '+51';
  if (schema.type === 'boolean') return false;
  if (schema.type === 'integer' || schema.type === 'number') return schema.minimum ?? 1;
  if (schema.type === 'string') return stringExample(name, context);
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
      description: 'CSV UTF-8 con las órdenes visibles para el local nocturno.',
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
            example: 'orderId,status,totalCents\nc4e91a67-3b58-4fd2-8a06-7d25e9c1b340,PAID,18500',
          },
        },
      },
    };
  }
  if (operationId === 'CapacityController_stream') {
    operation.responses[successStatus] = {
      description:
        'Stream SSE que emite eventos capacity.updated cada vez que cambia la revisión del aforo.',
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
          schema: {
            type: 'string',
            example:
              '<!doctype html><html lang="es"><head><title>Volviendo a Beerry</title></head><body>Redirigiendo a la aplicación.</body></html>',
          },
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
      'El rol, permiso o acceso asignado no autoriza la operación.',
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
    '403': 'El rol, permiso o acceso asignado no autoriza la operación.',
    '404': 'El recurso requerido no existe o no es visible.',
    '409': 'El estado actual impide completar la operación.',
    '503': 'Un proveedor requerido no está disponible.',
  };
  return descriptions[status] ?? 'La operación no pudo completarse.';
}

function successResponse(operationId: string): ResponseObject {
  return {
    description: 'Operación completada correctamente.',
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
