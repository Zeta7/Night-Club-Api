/** Documented domain errors by operation. Update when changing public error behavior. */
export const OPENAPI_ERROR_CODES: Record<string, Record<string, string[]>> = {
  NotificationController_list: {
    '400': ['INVALID_NOTIFICATION_CURSOR', 'INVALID_NOTIFICATION_LIMIT'],
  },
  NotificationController_markRead: {
    '404': ['NOTIFICATION_NOT_FOUND'],
  },
  NotificationController_removeDevice: {
    '404': ['DEVICE_NOT_FOUND'],
  },
  AuthController_register: {
    '400': ['VALIDATION_ERROR'],
    '409': ['EMAIL_ALREADY_REGISTERED', 'PHONE_ALREADY_REGISTERED'],
    '503': ['SMS_SEND_FAILED'],
  },
  AuthController_confirmPhone: {
    '400': [
      'INVALID_PHONE_CODE',
      'PHONE_CODE_ATTEMPTS_EXCEEDED',
      'PHONE_CODE_EXPIRED',
      'PHONE_CODE_NOT_FOUND',
      'VALIDATION_ERROR',
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
    '400': ['PHONE_NOT_CONFIRMED', 'VALIDATION_ERROR'],
    '404': ['USER_NOT_FOUND'],
    '503': ['SMS_SEND_FAILED'],
  },
  AuthController_resetPassword: {
    '400': [
      'INVALID_PHONE_CODE',
      'PHONE_CODE_ATTEMPTS_EXCEEDED',
      'PHONE_CODE_EXPIRED',
      'PHONE_CODE_NOT_FOUND',
      'VALIDATION_ERROR',
    ],
    '404': ['USER_NOT_FOUND'],
  },
  AuthController_me: {
    '401': ['INVALID_ACCESS_TOKEN'],
  },
  UploadsController_createPresignedUploadUrl: {
    '400': [
      'UPLOAD_CONTENT_TYPE_NOT_ALLOWED',
      'UPLOAD_EXTENSION_MISMATCH',
      'UPLOAD_EXTENSION_NOT_ALLOWED',
      'UPLOAD_SIZE_INVALID',
      'UPLOAD_TOO_LARGE',
    ],
    '503': ['UPLOADS_NOT_CONFIGURED'],
  },
  UploadsController_confirmUpload: {
    '400': [
      'UPLOAD_CONTENT_TYPE_NOT_ALLOWED',
      'UPLOAD_EXPIRED',
      'UPLOAD_FILE_NOT_FOUND',
      'UPLOAD_SIZE_INVALID',
      'UPLOAD_TOO_LARGE',
    ],
    '404': ['UPLOAD_NOT_FOUND'],
    '409': ['UPLOAD_NOT_PENDING'],
    '503': ['UPLOADS_NOT_CONFIGURED'],
  },
  ClubWorkersController_startMyShift: {
    '403': ['ACTIVE_WORKER_REQUIRED', 'AUTHORIZED_DEVICE_REQUIRED'],
    '404': ['EVENT_NOT_FOUND'],
    '409': ['WORKER_SHIFT_ALREADY_ACTIVE'],
  },
  ClubWorkersController_syncMyShift: {
    '403': ['ACTIVE_WORKER_REQUIRED', 'WORKER_SHIFT_NOT_ACTIVE'],
  },
  ClubWorkersController_listShifts: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'CLUB_WORKER_NOT_FOUND'],
  },
  ClubWorkersController_closeShift: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'CLUB_WORKER_NOT_FOUND'],
    '409': ['WORKER_SHIFT_NOT_ACTIVE'],
  },
  ClubWorkersController_authorizeDevice: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'CLUB_WORKER_NOT_FOUND'],
  },
  ClubWorkersController_revokeDevice: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'CLUB_WORKER_NOT_FOUND', 'WORKER_DEVICE_NOT_FOUND'],
  },
  ClubWorkersController_report: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'CLUB_WORKER_NOT_FOUND'],
  },
  ClubWorkersController_registerWorker: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'USER_NOT_FOUND'],
    '409': ['CLUB_WORKER_ALREADY_EXISTS', 'USER_NOT_ACTIVE'],
  },
  ClubWorkersController_listWorkers: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND'],
  },
  ClubWorkersController_updateWorker: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'CLUB_WORKER_NOT_FOUND'],
  },
  ClubWorkersController_replacePermissions: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'CLUB_WORKER_NOT_FOUND'],
  },
  ClubWorkersController_removeWorker: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'CLUB_WORKER_NOT_FOUND'],
  },
  ClubsController_createClub: {
    '400': ['UPLOAD_EXPIRED'],
    '403': ['CLUB_CREATE_FORBIDDEN'],
    '404': ['UPLOAD_NOT_FOUND'],
    '409': ['UPLOAD_ALREADY_USED', 'UPLOAD_NOT_TEMPORARY'],
  },
  ClubsController_getAdminDashboard: {
    '403': ['ADMIN_DASHBOARD_FORBIDDEN'],
  },
  ClubsController_getCustomerNearbyEvents: {
    '400': ['INVALID_NEARBY_CURSOR'],
  },
  ClubsController_getCustomerNearbyClubs: {
    '400': ['INVALID_NEARBY_CURSOR'],
  },
  ClubsController_getCustomerNearbyPromotions: {
    '400': ['INVALID_NEARBY_CURSOR'],
  },
  ClubsController_getCustomerClubDetail: {
    '404': ['CLUB_NOT_FOUND'],
  },
  ClubsController_getCustomerEventDetail: {
    '404': ['EVENT_NOT_FOUND'],
  },
  ClubsController_getClub: {
    '404': ['CLUB_NOT_FOUND'],
  },
  ClubsController_updateClub: {
    '400': ['UPLOAD_EXPIRED'],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'UPLOAD_NOT_FOUND'],
    '409': ['UPLOAD_ALREADY_USED', 'UPLOAD_NOT_TEMPORARY'],
  },
  ClubsController_getOperationalProfile: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND'],
  },
  ClubsController_updateOperationalProfile: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND'],
  },
  ClubsController_activateClub: {
    '403': ['SUPER_ADMIN_REQUIRED'],
    '404': ['CLUB_NOT_FOUND'],
  },
  ClubsController_deactivateClub: {
    '403': ['SUPER_ADMIN_REQUIRED'],
    '404': ['CLUB_NOT_FOUND'],
  },
  EventResolutionController_jobs: {
    '403': ['CLUB_MANAGE_FORBIDDEN', 'SUPER_ADMIN_REQUIRED'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND'],
  },
  EventResolutionController_businessJobs: {
    '403': ['CLUB_MANAGE_FORBIDDEN', 'SUPER_ADMIN_REQUIRED'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND'],
  },
  EventResolutionController_reviewJob: {
    '403': ['SUPER_ADMIN_REQUIRED'],
    '409': ['INVALID_RESOLUTION', 'JOB_CHANGED', 'RECONCILIATION_REQUIRED'],
  },
  EventResolutionController_processUnallocated: {
    '403': ['SUPER_ADMIN_REQUIRED'],
    '404': [
      'FEATURED_CAMPAIGN_NOT_FOUND',
      'NOTIFICATION_TEMPLATE_NOT_FOUND',
      'ORDER_PAYMENT_NOT_FOUND',
      'PAYMENT_ATTEMPT_NOT_FOUND',
      'REFUND_REQUEST_NOT_FOUND',
      'WALLET_TOP_UP_NOT_FOUND',
    ],
    '409': [
      'EVENT_REFUND_NOT_AUTHORIZED',
      'MERCADO_PAGO_PAYMENT_MISMATCH',
      'PAYMENT_ID_UNRESOLVED',
      'PAYMENT_NOT_REFUNDABLE',
      'PRODUCT_OVERSOLD',
      'REFUND_AMOUNT_EXCEEDS_AVAILABLE',
      'REFUND_AMOUNT_IMMUTABLE',
      'REFUND_CHANGED',
      'REFUND_GATEWAY_UNAVAILABLE',
      'REFUND_IN_FLIGHT',
      'REFUND_MANUAL_REVIEW_REQUIRED',
      'REFUND_PROVIDER_NOT_SUPPORTED',
      'REFUND_REQUEST_NOT_PROCESSABLE',
      'RESERVATION_EXPIRED',
      'TICKET_OVERSOLD',
      'USE_EVENT_JOB',
      'WALLET_FULL_REFUND_REQUIRED',
    ],
  },
  EventResolutionController_options: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND'],
    '409': ['NO_REPLACEMENT'],
  },
  EventResolutionController_configure: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND'],
    '409': [
      'MAPPING_IMMUTABLE',
      'NO_PURCHASES',
      'REPLACEMENT_CAPACITY',
      'REPLACEMENT_CLOSED',
      'REPLACEMENT_ITEM_INVALID',
      'REPLACEMENT_UNAVAILABLE',
    ],
  },
  EventResolutionController_accept: {
    '404': ['PURCHASE_NOT_FOUND'],
    '409': [
      'MANUAL_REVIEW_REQUIRED',
      'REPLACEMENT_CAPACITY',
      'REPLACEMENT_CHANGED',
      'REPLACEMENT_NOT_CONFIGURED',
      'REPLACEMENT_NOT_ELIGIBLE',
      'REPLACEMENT_UNAVAILABLE',
    ],
  },
  CommerceController_checkout: {
    '400': [
      'CREDIT_EXCEEDS_ORDER_TOTAL',
      'CREDIT_USAGE_LIMIT_EXCEEDED',
      'EMPTY_CART',
      'EVENT_SALES_UNAVAILABLE',
      'INVALID_WALLET_PAYMENT',
      'MIXED_PAYMENT_NOT_ALLOWED',
      'MULTI_CLUB_CHECKOUT',
      'PRODUCT_UNAVAILABLE',
      'PROMOTION_UNAVAILABLE',
      'TICKET_UNAVAILABLE',
    ],
    '404': [
      'CLUB_NOT_FOUND',
      'FEATURED_CAMPAIGN_NOT_FOUND',
      'NOTIFICATION_TEMPLATE_NOT_FOUND',
      'ORDER_NOT_FOUND',
      'ORDER_PAYMENT_NOT_FOUND',
      'PAYMENT_ATTEMPT_NOT_FOUND',
      'WALLET_TOP_UP_NOT_FOUND',
    ],
    '409': [
      'CART_TOTAL_CHANGED',
      'INSUFFICIENT_ELIGIBLE_CREDIT',
      'INSUFFICIENT_WALLET_BALANCE',
      'INVALID_EXTERNAL_AMOUNT',
      'INVALID_MARKETPLACE_FEE_BPS',
      'MARKETPLACE_FEE_NOT_CONFIGURED',
      'MERCADO_PAGO_NOT_CONNECTED',
      'MERCADO_PAGO_PAYMENT_MISMATCH',
      'PAYMENT_NOT_REFUNDABLE',
      'PRODUCT_OVERSOLD',
      'RESERVATION_EXPIRED',
      'TICKET_OVERSOLD',
      'WALLET_NOT_ACCEPTED',
    ],
  },
  CommerceController_addCartItem: {
    '400': ['CART_ITEM_UNAVAILABLE', 'CART_QUANTITY_UNAVAILABLE', 'MULTI_CLUB_CART'],
  },
  CommerceController_updateCartItem: {
    '400': ['CART_QUANTITY_UNAVAILABLE'],
    '404': ['CART_ITEM_NOT_FOUND'],
  },
  CommerceController_updateProductDelivery: {
    '400': ['INVALID_PRODUCT_DELIVERY_ITEM'],
    '404': ['CART_NOT_FOUND'],
  },
  CommerceController_deleteCartItem: {
    '404': ['CART_ITEM_NOT_FOUND'],
  },
  CommerceController_reservationMetrics: {
    '403': ['RESERVATION_METRICS_FORBIDDEN'],
  },
  CommerceController_payment: {
    '404': [
      'FEATURED_CAMPAIGN_NOT_FOUND',
      'NOTIFICATION_TEMPLATE_NOT_FOUND',
      'ORDER_NOT_FOUND',
      'ORDER_PAYMENT_NOT_FOUND',
      'PAYMENT_ATTEMPT_NOT_FOUND',
      'WALLET_TOP_UP_NOT_FOUND',
    ],
    '409': [
      'MERCADO_PAGO_PAYMENT_MISMATCH',
      'PAYMENT_NOT_REFUNDABLE',
      'PRODUCT_OVERSOLD',
      'RESERVATION_EXPIRED',
      'TICKET_OVERSOLD',
    ],
  },
  CommerceController_createWalletTopUp: {
    '400': ['WALLET_TOP_UP_AMOUNT_OUT_OF_RANGE'],
    '409': ['IDEMPOTENCY_KEY_CONFLICT'],
  },
  CommerceController_walletTopUp: {
    '404': [
      'FEATURED_CAMPAIGN_NOT_FOUND',
      'NOTIFICATION_TEMPLATE_NOT_FOUND',
      'ORDER_PAYMENT_NOT_FOUND',
      'PAYMENT_ATTEMPT_NOT_FOUND',
      'WALLET_TOP_UP_NOT_FOUND',
    ],
    '409': [
      'MERCADO_PAGO_PAYMENT_MISMATCH',
      'PAYMENT_NOT_REFUNDABLE',
      'PRODUCT_OVERSOLD',
      'RESERVATION_EXPIRED',
      'TICKET_OVERSOLD',
    ],
  },
  CommerceController_clubOrders: {
    '403': ['CLUB_PERMISSION_REQUIRED'],
  },
  CommerceController_exportClubOrders: {
    '403': ['CLUB_PERMISSION_REQUIRED'],
  },
  CommerceController_clubOrderDetail: {
    '403': ['CLUB_PERMISSION_REQUIRED'],
    '404': ['ORDER_NOT_FOUND'],
  },
  CommerceController_requestRefund: {
    '403': ['CLUB_PERMISSION_REQUIRED'],
    '404': ['ORDER_NOT_FOUND'],
    '409': [
      'ORDER_NOT_REFUNDABLE',
      'PAYMENT_NOT_REFUNDABLE',
      'REFUND_ALREADY_REQUESTED',
      'REFUND_AMOUNT_EXCEEDS_AVAILABLE',
    ],
  },
  CommerceController_processRefund: {
    '403': ['SUPER_ADMIN_REQUIRED'],
    '404': ['REFUND_REQUEST_NOT_FOUND'],
    '409': [
      'EVENT_REFUND_NOT_AUTHORIZED',
      'PAYMENT_ID_UNRESOLVED',
      'PAYMENT_NOT_REFUNDABLE',
      'REFUND_AMOUNT_EXCEEDS_AVAILABLE',
      'REFUND_AMOUNT_IMMUTABLE',
      'REFUND_CHANGED',
      'REFUND_GATEWAY_UNAVAILABLE',
      'REFUND_IN_FLIGHT',
      'REFUND_MANUAL_REVIEW_REQUIRED',
      'REFUND_PROVIDER_NOT_SUPPORTED',
      'REFUND_REQUEST_NOT_PROCESSABLE',
      'WALLET_FULL_REFUND_REQUIRED',
    ],
  },
  CommerceController_operations: {
    '403': ['CLUB_PERMISSION_REQUIRED'],
  },
  CommerceController_simulatePayment: {
    '403': ['PAYMENT_SIMULATOR_DISABLED'],
    '404': [
      'FEATURED_CAMPAIGN_NOT_FOUND',
      'NOTIFICATION_TEMPLATE_NOT_FOUND',
      'ORDER_NOT_FOUND',
      'ORDER_PAYMENT_NOT_FOUND',
      'PAYMENT_ATTEMPT_NOT_FOUND',
      'WALLET_TOP_UP_NOT_FOUND',
    ],
    '409': [
      'MERCADO_PAGO_PAYMENT_MISMATCH',
      'PAYMENT_NOT_REFUNDABLE',
      'PRODUCT_OVERSOLD',
      'RESERVATION_EXPIRED',
      'TICKET_OVERSOLD',
    ],
  },
  CommerceController_validateTicket: {
    '400': ['VALIDATION_CODE_REQUIRED'],
    '403': ['ACTIVE_WORKER_SHIFT_REQUIRED', 'VALIDATION_PERMISSION_REQUIRED'],
    '404': ['EVENT_NOT_FOUND'],
    '409': [
      'CODE_ALREADY_REDEEMED',
      'EVENT_CAPACITY_REACHED',
      'EVENT_REENTRY_DISABLED',
      'EVENT_UNAVAILABLE',
      'ORDER_NOT_REDEEMABLE',
      'TICKET_ALREADY_INSIDE',
    ],
  },
  CommerceController_validateDetectedCode: {
    '400': ['VALIDATION_CODE_REQUIRED'],
    '403': ['ACTIVE_WORKER_SHIFT_REQUIRED', 'VALIDATION_PERMISSION_REQUIRED'],
    '404': ['EVENT_NOT_FOUND'],
    '409': [
      'CODE_ALREADY_REDEEMED',
      'EVENT_CAPACITY_REACHED',
      'EVENT_REENTRY_DISABLED',
      'EVENT_UNAVAILABLE',
      'ORDER_NOT_REDEEMABLE',
      'TICKET_ALREADY_INSIDE',
    ],
  },
  CommerceController_validateProduct: {
    '400': ['VALIDATION_CODE_REQUIRED'],
    '403': ['ACTIVE_WORKER_SHIFT_REQUIRED', 'VALIDATION_PERMISSION_REQUIRED'],
    '404': ['EVENT_NOT_FOUND'],
    '409': [
      'CODE_ALREADY_REDEEMED',
      'EVENT_CAPACITY_REACHED',
      'EVENT_REENTRY_DISABLED',
      'EVENT_UNAVAILABLE',
      'ORDER_NOT_REDEEMABLE',
      'TICKET_ALREADY_INSIDE',
    ],
  },
  CommerceController_validatePromotion: {
    '400': ['VALIDATION_CODE_REQUIRED'],
    '403': ['ACTIVE_WORKER_SHIFT_REQUIRED', 'VALIDATION_PERMISSION_REQUIRED'],
    '404': ['EVENT_NOT_FOUND'],
    '409': [
      'CODE_ALREADY_REDEEMED',
      'EVENT_CAPACITY_REACHED',
      'EVENT_REENTRY_DISABLED',
      'EVENT_UNAVAILABLE',
      'ORDER_NOT_REDEEMABLE',
      'TICKET_ALREADY_INSIDE',
    ],
  },
  CommerceController_reverseRedemption: {
    '400': ['INVALID_REDEMPTION_KIND'],
    '403': ['REDEMPTION_REVERSAL_FORBIDDEN'],
    '404': ['REDEEMABLE_NOT_FOUND'],
    '409': ['REDEMPTION_NOT_USED'],
  },
  CommerceController_auditLogs: {
    '403': ['CLUB_AUDIT_FORBIDDEN'],
  },
  WalletsController_getMine: {
    '404': ['ACTIVE_USER_NOT_FOUND'],
  },
  WalletsController_movement: {
    '404': ['MOVEMENT_NOT_FOUND', 'ORDER_NOT_FOUND', 'WALLET_TOP_UP_NOT_FOUND'],
  },
  WalletsController_orderDetail: {
    '404': ['ORDER_NOT_FOUND'],
  },
  WalletsController_topUpDetail: {
    '404': ['WALLET_TOP_UP_NOT_FOUND'],
  },
  WalletsController_getClubLedger: {
    '403': ['CLUB_LEDGER_FORBIDDEN'],
  },
  WalletsController_reconcileOrder: {
    '403': ['CLUB_LEDGER_FORBIDDEN'],
    '404': ['ORDER_NOT_FOUND'],
  },
  WalletsController_dailyDifferences: {
    '403': ['PLATFORM_LEDGER_FORBIDDEN'],
  },
  WalletsController_financialProfile: {
    '403': ['WITHDRAWAL_FORBIDDEN'],
  },
  WalletsController_upsertFinancialProfile: {
    '400': ['INVALID_BANK_ACCOUNT'],
    '403': ['WITHDRAWAL_FORBIDDEN'],
  },
  WalletsController_requestWithdrawal: {
    '400': ['FINANCIAL_PROFILE_REQUIRED', 'WITHDRAWAL_BELOW_MINIMUM'],
    '403': ['WITHDRAWAL_FORBIDDEN'],
    '404': ['NOTIFICATION_TEMPLATE_NOT_FOUND'],
    '409': ['INSUFFICIENT_AVAILABLE_BALANCE', 'LEGACY_SPLIT_RECONCILIATION_REQUIRED'],
  },
  WalletsController_clubWithdrawals: {
    '403': ['WITHDRAWAL_FORBIDDEN'],
  },
  WalletsController_platformWithdrawals: {
    '403': ['WITHDRAWAL_REVIEW_FORBIDDEN'],
  },
  WalletsController_reviewWithdrawal: {
    '400': ['REJECTION_REASON_REQUIRED'],
    '403': ['WITHDRAWAL_REVIEW_FORBIDDEN'],
    '404': ['NOTIFICATION_TEMPLATE_NOT_FOUND', 'WITHDRAWAL_NOT_FOUND'],
    '409': ['WITHDRAWAL_NOT_REVIEWABLE'],
  },
  WalletsController_processWithdrawal: {
    '403': ['WITHDRAWAL_REVIEW_FORBIDDEN'],
    '404': ['WITHDRAWAL_NOT_FOUND'],
    '409': ['WITHDRAWAL_INVALID_TRANSITION'],
  },
  WalletsController_payWithdrawal: {
    '403': ['WITHDRAWAL_REVIEW_FORBIDDEN'],
    '404': ['NOTIFICATION_TEMPLATE_NOT_FOUND', 'WITHDRAWAL_NOT_FOUND'],
    '409': ['WITHDRAWAL_NOT_PAYABLE'],
  },
  WalletsController_failWithdrawal: {
    '403': ['WITHDRAWAL_REVIEW_FORBIDDEN'],
    '404': ['NOTIFICATION_TEMPLATE_NOT_FOUND', 'WITHDRAWAL_NOT_FOUND'],
    '409': ['WITHDRAWAL_NOT_FAILABLE'],
  },
  BuyerEventRefundsController_request: {
    '400': ['REASON_REQUIRED'],
    '404': ['EVENT_PURCHASE_NOT_FOUND'],
    '409': ['PURCHASE_NOT_ELIGIBLE', 'REFUND_ALREADY_REQUESTED', 'REPLACEMENT_REQUIRED'],
  },
  ClubEventsController_buyerRefunds: {
    '403': ['CLUB_MANAGE_FORBIDDEN', 'SUPER_ADMIN_REQUIRED'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND'],
  },
  ClubEventsController_reviewBuyerRefund: {
    '400': ['REASON_REQUIRED'],
    '403': ['CLUB_MANAGE_FORBIDDEN', 'SUPER_ADMIN_REQUIRED'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND', 'REQUEST_NOT_FOUND'],
    '409': ['REQUEST_CHANGED'],
  },
  ClubEventsController_cancellation: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND'],
  },
  ClubEventsController_requestCancellationRefund: {
    '400': ['REVIEW_REASON_REQUIRED'],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND'],
    '409': ['CANCELLATION_CHANGED'],
  },
  ClubEventsController_postpone: {
    '400': ['EVENT_REASON_REQUIRED', 'EVENT_STATUS_TRANSITION_NOT_ALLOWED'],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND'],
    '409': ['EVENT_ALREADY_ENDED'],
  },
  ClubEventsController_reschedule: {
    '400': [
      'EVENT_DATE_RANGE_INVALID',
      'EVENT_RESCHEDULE_INVALID',
      'EVENT_STATUS_TRANSITION_NOT_ALLOWED',
    ],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND'],
  },
  ClubEventsController_createEvent: {
    '400': ['EVENT_DATE_RANGE_INVALID', 'EVENT_IMAGE_INPUT_CONFLICT', 'UPLOAD_EXPIRED'],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'UPLOAD_NOT_FOUND'],
    '409': ['UPLOAD_ALREADY_USED', 'UPLOAD_NOT_TEMPORARY'],
  },
  ClubEventsController_listClubEvents: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND'],
  },
  ClubEventsController_updateEvent: {
    '400': ['EVENT_DATE_RANGE_INVALID', 'EVENT_IMAGE_INPUT_CONFLICT', 'UPLOAD_EXPIRED'],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND', 'UPLOAD_NOT_FOUND'],
    '409': [
      'EVENT_CAPACITY_BELOW_COMMITMENTS',
      'EVENT_CHANGED',
      'EVENT_REPROGRAMMING_REQUIRED',
      'UPLOAD_ALREADY_USED',
      'UPLOAD_NOT_TEMPORARY',
    ],
  },
  ClubEventsController_publishEvent: {
    '400': [
      'CANCELLATION_DECISION_REQUIRED',
      'EVENT_ALREADY_ENDED',
      'EVENT_PAYMENTS_NOT_READY',
      'EVENT_STATUS_TRANSITION_NOT_ALLOWED',
      'REPLACEMENT_INVALID',
      'REPLACEMENT_NOT_ALLOWED',
      'REPLACEMENT_REQUIRED',
    ],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND'],
    '409': ['EVENT_CHANGED', 'EVENT_REACTIVATION_UNSAFE'],
  },
  ClubEventsController_startSale: {
    '400': [
      'CANCELLATION_DECISION_REQUIRED',
      'EVENT_ALREADY_ENDED',
      'EVENT_PAYMENTS_NOT_READY',
      'EVENT_STATUS_TRANSITION_NOT_ALLOWED',
      'REPLACEMENT_INVALID',
      'REPLACEMENT_NOT_ALLOWED',
      'REPLACEMENT_REQUIRED',
    ],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND'],
    '409': ['EVENT_CHANGED', 'EVENT_REACTIVATION_UNSAFE'],
  },
  ClubEventsController_cancelEvent: {
    '400': [
      'CANCELLATION_DECISION_REQUIRED',
      'EVENT_ALREADY_ENDED',
      'EVENT_PAYMENTS_NOT_READY',
      'EVENT_STATUS_TRANSITION_NOT_ALLOWED',
      'REPLACEMENT_INVALID',
      'REPLACEMENT_NOT_ALLOWED',
      'REPLACEMENT_REQUIRED',
    ],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND'],
    '409': ['EVENT_CHANGED', 'EVENT_REACTIVATION_UNSAFE'],
  },
  ClubEventsController_reactivateEvent: {
    '400': [
      'CANCELLATION_DECISION_REQUIRED',
      'EVENT_ALREADY_ENDED',
      'EVENT_PAYMENTS_NOT_READY',
      'EVENT_STATUS_TRANSITION_NOT_ALLOWED',
      'REPLACEMENT_INVALID',
      'REPLACEMENT_NOT_ALLOWED',
      'REPLACEMENT_REQUIRED',
    ],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND'],
    '409': ['EVENT_CHANGED', 'EVENT_REACTIVATION_UNSAFE'],
  },
  ClubEventsController_finishEvent: {
    '400': [
      'CANCELLATION_DECISION_REQUIRED',
      'EVENT_ALREADY_ENDED',
      'EVENT_PAYMENTS_NOT_READY',
      'EVENT_STATUS_TRANSITION_NOT_ALLOWED',
      'REPLACEMENT_INVALID',
      'REPLACEMENT_NOT_ALLOWED',
      'REPLACEMENT_REQUIRED',
    ],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND'],
    '409': ['EVENT_CHANGED', 'EVENT_REACTIVATION_UNSAFE'],
  },
  AdminEventsController_buyerRefunds: {
    '403': ['CLUB_MANAGE_FORBIDDEN', 'SUPER_ADMIN_REQUIRED'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND'],
  },
  AdminEventsController_reviewBuyerRefund: {
    '400': ['REASON_REQUIRED'],
    '403': ['CLUB_MANAGE_FORBIDDEN', 'SUPER_ADMIN_REQUIRED'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND', 'REQUEST_NOT_FOUND'],
    '409': ['REQUEST_CHANGED'],
  },
  AdminEventsController_cancellations: {
    '403': ['SUPER_ADMIN_REQUIRED'],
  },
  AdminEventsController_reviewCancellation: {
    '400': ['REVIEW_REASON_REQUIRED'],
    '403': ['SUPER_ADMIN_REQUIRED'],
    '404': ['CANCELLATION_NOT_FOUND'],
    '409': ['CANCELLATION_CHANGED', 'CANCELLATION_NOT_REVIEWABLE'],
  },
  AdminEventsController_getAdminEventsDashboard: {
    '403': ['ADMIN_EVENTS_FORBIDDEN'],
  },
  PublicEventsController_getPublicEvent: {
    '404': ['EVENT_NOT_FOUND'],
  },
  CapacityController_get: {
    '403': ['CAPACITY_PERMISSION_REQUIRED'],
    '404': ['EVENT_NOT_FOUND'],
  },
  CapacityController_stream: {
    '403': ['CAPACITY_PERMISSION_REQUIRED'],
    '404': ['EVENT_NOT_FOUND'],
  },
  CapacityController_history: {
    '403': ['CAPACITY_PERMISSION_REQUIRED'],
    '404': ['EVENT_NOT_FOUND'],
  },
  CapacityController_configure: {
    '403': ['CAPACITY_PERMISSION_REQUIRED'],
    '404': ['EVENT_NOT_FOUND'],
  },
  CapacityController_exit: {
    '403': ['CAPACITY_PERMISSION_REQUIRED'],
    '404': ['EVENT_NOT_FOUND'],
    '409': ['CAPACITY_ALREADY_EMPTY', 'TICKET_NOT_INSIDE'],
  },
  CapacityController_correct: {
    '403': ['CAPACITY_PERMISSION_REQUIRED'],
    '404': ['EVENT_NOT_FOUND'],
    '409': ['CAPACITY_TARGET_EXCEEDS_LIMIT'],
  },
  ReferralsController_mine: {
    '404': ['USER_NOT_FOUND'],
    '409': ['REFERRAL_CODE_GENERATION_FAILED'],
  },
  ReferralsController_preview: {
    '404': ['REFERRAL_CODE_NOT_FOUND'],
  },
  ReferralsController_associate: {
    '400': ['SELF_REFERRAL_NOT_ALLOWED'],
    '403': ['REFERRAL_ACCOUNT_NOT_ELIGIBLE', 'REFERRAL_PROGRAM_DISABLED'],
    '404': ['NOTIFICATION_TEMPLATE_NOT_FOUND', 'REFERRAL_CODE_NOT_FOUND'],
    '409': [
      'REFERRAL_ALREADY_ASSOCIATED',
      'REFERRAL_ASSOCIATION_WINDOW_EXPIRED',
      'REFERRAL_PAYMENT_IN_PROGRESS',
      'REFERRAL_PURCHASE_ALREADY_EXISTS',
    ],
  },
  ReferralsController_transfer: {
    '400': ['SELF_TRANSFER_NOT_ALLOWED'],
    '403': ['WALLET_TRANSFERS_DISABLED'],
    '404': ['NOTIFICATION_TEMPLATE_NOT_FOUND', 'TRANSFER_RECIPIENT_NOT_FOUND'],
    '409': [
      'DAILY_TRANSFER_LIMIT_EXCEEDED',
      'INSUFFICIENT_TRANSFERABLE_CREDIT',
      'MONTHLY_TRANSFER_LIMIT_EXCEEDED',
    ],
  },
  ReferralsController_settings: {
    '403': ['SUPER_ADMIN_REQUIRED'],
  },
  ReferralsController_updateSettings: {
    '400': [
      'REFERRAL_CAMPAIGN_DATES_INVALID',
      'REFERRAL_EXPIRATION_DAYS_REQUIRED',
      'REFERRAL_MARGIN_NOT_PROTECTED',
    ],
    '403': ['SUPER_ADMIN_REQUIRED'],
  },
  ReferralsController_rewards: {
    '403': ['SUPER_ADMIN_REQUIRED'],
  },
  MercadoPagoConnectionsController_walletAcceptance: {
    '404': ['CLUB_NOT_FOUND'],
  },
  MercadoPagoConnectionsController_setWalletAcceptance: {
    '403': ['CLUB_ADMIN_REQUIRED'],
    '404': ['CLUB_NOT_FOUND'],
  },
  MercadoPagoConnectionsController_status: {
    '403': ['CLUB_ADMIN_REQUIRED'],
    '404': ['CLUB_NOT_FOUND'],
  },
  MercadoPagoConnectionsController_connect: {
    '403': ['CLUB_ADMIN_REQUIRED'],
    '404': ['CLUB_NOT_FOUND'],
  },
  MercadoPagoConnectionsController_disconnect: {
    '403': ['CLUB_ADMIN_REQUIRED'],
    '404': ['CLUB_NOT_FOUND'],
  },
  MercadoPagoOAuthCallbackController_callback: {
    '401': ['INVALID_OAUTH_STATE', 'OAUTH_STATE_EXPIRED'],
    '409': [
      'MERCADO_PAGO_ACCOUNT_ALREADY_CONNECTED',
      'MERCADO_PAGO_PERMISSIONS_REQUIRED',
      'OAUTH_STATE_ALREADY_USED',
    ],
  },
  PlatformController_getMarketplaceFee: {
    '403': ['SUPER_ADMIN_REQUIRED'],
    '409': ['INVALID_MARKETPLACE_FEE_BPS'],
  },
  PlatformController_updateMarketplaceFee: {
    '403': ['SUPER_ADMIN_REQUIRED'],
    '409': ['INVALID_MARKETPLACE_FEE_BPS'],
  },
  PlatformController_setClubMarketplaceFee: {
    '403': ['SUPER_ADMIN_REQUIRED', 'CLUB_ADMIN_REQUIRED'],
    '404': ['CLUB_NOT_FOUND'],
    '409': ['INVALID_EXTERNAL_AMOUNT', 'INVALID_MARKETPLACE_FEE_BPS'],
  },
  PlatformController_removeClubMarketplaceFee: {
    '403': ['SUPER_ADMIN_REQUIRED', 'CLUB_ADMIN_REQUIRED'],
    '404': ['CLUB_NOT_FOUND'],
    '409': ['INVALID_EXTERNAL_AMOUNT', 'INVALID_MARKETPLACE_FEE_BPS'],
  },
  PlatformController_updateSettings: {
    '400': ['FEATURED_CAMPAIGN_PRICE_INVALID'],
    '403': ['SUPER_ADMIN_REQUIRED'],
  },
  PlatformController_changeUserRole: {
    '403': ['SUPER_ADMIN_REQUIRED'],
    '404': ['USER_NOT_FOUND'],
  },
  PlatformController_changeUserStatus: {
    '403': ['SUPER_ADMIN_REQUIRED'],
    '404': ['USER_NOT_FOUND'],
  },
  PlatformController_activateUser: {
    '403': ['SUPER_ADMIN_REQUIRED'],
    '404': ['USER_NOT_FOUND'],
  },
  PlatformController_deactivateUser: {
    '403': ['SUPER_ADMIN_REQUIRED'],
    '404': ['USER_NOT_FOUND'],
  },
  PlatformController_blockUser: {
    '403': ['SUPER_ADMIN_REQUIRED'],
    '404': ['USER_NOT_FOUND'],
  },
  ClubMarketplaceFeeController_get: {
    '403': ['CLUB_ADMIN_REQUIRED'],
    '404': ['CLUB_NOT_FOUND'],
    '409': ['INVALID_EXTERNAL_AMOUNT', 'INVALID_MARKETPLACE_FEE_BPS'],
  },
  MercadoPagoPaymentsController_webhook: {
    '401': ['INVALID_MERCADO_PAGO_SIGNATURE', 'MERCADO_PAGO_SELLER_REQUIRED'],
    '404': [
      'FEATURED_CAMPAIGN_NOT_FOUND',
      'NOTIFICATION_TEMPLATE_NOT_FOUND',
      'ORDER_PAYMENT_NOT_FOUND',
      'PAYMENT_ATTEMPT_NOT_FOUND',
      'WALLET_TOP_UP_NOT_FOUND',
    ],
    '409': [
      'MERCADO_PAGO_ATTEMPT_REQUIRED',
      'MERCADO_PAGO_PAYMENT_MISMATCH',
      'PAYMENT_NOT_REFUNDABLE',
      'PRODUCT_OVERSOLD',
      'RESERVATION_EXPIRED',
      'TICKET_OVERSOLD',
    ],
  },
  FeaturedCampaignsController_getManagement: {
    '403': ['FEATURED_CAMPAIGN_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND'],
  },
  FeaturedCampaignsController_createCheckout: {
    '403': ['FEATURED_CAMPAIGN_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'FEATURED_EVENT_NOT_FOUND'],
    '409': [
      'FEATURED_CAMPAIGN_ALREADY_EXISTS',
      'FEATURED_CAMPAIGN_SETTINGS_REQUIRED',
      'FEATURED_CAMPAIGN_TOTAL_INVALID',
      'FEATURED_CLUB_NOT_ACTIVE',
      'IDEMPOTENCY_KEY_CONFLICT',
    ],
  },
  FeaturedCampaignsController_getPayment: {
    '403': ['FEATURED_CAMPAIGN_FORBIDDEN'],
    '404': [
      'CLUB_NOT_FOUND',
      'FEATURED_CAMPAIGN_NOT_FOUND',
      'NOTIFICATION_TEMPLATE_NOT_FOUND',
      'ORDER_PAYMENT_NOT_FOUND',
      'PAYMENT_ATTEMPT_NOT_FOUND',
      'WALLET_TOP_UP_NOT_FOUND',
    ],
    '409': [
      'MERCADO_PAGO_ATTEMPT_REQUIRED',
      'MERCADO_PAGO_PAYMENT_MISMATCH',
      'PAYMENT_NOT_REFUNDABLE',
      'PRODUCT_OVERSOLD',
      'RESERVATION_EXPIRED',
      'TICKET_OVERSOLD',
    ],
  },
  FeaturedCampaignPaymentsController_getPayment: {
    '403': ['FEATURED_CAMPAIGN_FORBIDDEN'],
    '404': [
      'CLUB_NOT_FOUND',
      'FEATURED_CAMPAIGN_NOT_FOUND',
      'NOTIFICATION_TEMPLATE_NOT_FOUND',
      'ORDER_PAYMENT_NOT_FOUND',
      'PAYMENT_ATTEMPT_NOT_FOUND',
      'WALLET_TOP_UP_NOT_FOUND',
    ],
    '409': [
      'MERCADO_PAGO_ATTEMPT_REQUIRED',
      'MERCADO_PAGO_PAYMENT_MISMATCH',
      'PAYMENT_NOT_REFUNDABLE',
      'PRODUCT_OVERSOLD',
      'RESERVATION_EXPIRED',
      'TICKET_OVERSOLD',
    ],
  },
  ClubProductsController_createProduct: {
    '400': ['PRODUCT_IMAGE_INPUT_CONFLICT', 'UPLOAD_EXPIRED'],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'UPLOAD_NOT_FOUND'],
    '409': ['UPLOAD_ALREADY_USED', 'UPLOAD_NOT_TEMPORARY'],
  },
  ClubProductsController_listProducts: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND'],
  },
  ClubProductsController_getProduct: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'PRODUCT_NOT_FOUND'],
  },
  ClubProductsController_updateProduct: {
    '400': ['PRODUCT_IMAGE_INPUT_CONFLICT', 'UPLOAD_EXPIRED'],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'PRODUCT_NOT_FOUND', 'UPLOAD_NOT_FOUND'],
    '409': ['UPLOAD_ALREADY_USED', 'UPLOAD_NOT_TEMPORARY'],
  },
  ClubProductsController_activateProduct: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'PRODUCT_NOT_FOUND'],
  },
  ClubProductsController_deactivateProduct: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'PRODUCT_NOT_FOUND'],
  },
  ClubProductsController_deleteProduct: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'PRODUCT_NOT_FOUND'],
  },
  ClubPromotionsController_createPromotion: {
    '400': [
      'PROMOTION_DATE_RANGE_INVALID',
      'PROMOTION_DISCOUNT_AMOUNT_INVALID',
      'PROMOTION_DISCOUNT_PERCENTAGE_INVALID',
      'PROMOTION_FINAL_PRICE_REQUIRED',
      'PROMOTION_IMAGE_INPUT_CONFLICT',
      'PROMOTION_ITEMS_REQUIRED',
      'PROMOTION_ITEM_PRODUCT_INVALID',
      'PROMOTION_ITEM_TICKET_INVALID',
      'UPLOAD_EXPIRED',
    ],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': [
      'CLUB_NOT_FOUND',
      'EVENT_NOT_FOUND',
      'PRODUCT_NOT_FOUND',
      'TICKET_TYPE_NOT_FOUND',
      'UPLOAD_NOT_FOUND',
    ],
    '409': ['UPLOAD_ALREADY_USED', 'UPLOAD_NOT_TEMPORARY'],
  },
  ClubPromotionsController_listPromotions: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND'],
  },
  ClubPromotionsController_getPromotion: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'PROMOTION_NOT_FOUND'],
  },
  ClubPromotionsController_updatePromotion: {
    '400': [
      'PROMOTION_DATE_RANGE_INVALID',
      'PROMOTION_DISCOUNT_AMOUNT_INVALID',
      'PROMOTION_DISCOUNT_PERCENTAGE_INVALID',
      'PROMOTION_FINAL_PRICE_REQUIRED',
      'PROMOTION_IMAGE_INPUT_CONFLICT',
      'PROMOTION_ITEMS_REQUIRED',
      'PROMOTION_ITEM_PRODUCT_INVALID',
      'PROMOTION_ITEM_TICKET_INVALID',
      'UPLOAD_EXPIRED',
    ],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': [
      'CLUB_NOT_FOUND',
      'EVENT_NOT_FOUND',
      'PRODUCT_NOT_FOUND',
      'PROMOTION_NOT_FOUND',
      'TICKET_TYPE_NOT_FOUND',
      'UPLOAD_NOT_FOUND',
    ],
    '409': ['UPLOAD_ALREADY_USED', 'UPLOAD_NOT_TEMPORARY'],
  },
  ClubPromotionsController_activatePromotion: {
    '400': ['PROMOTION_EXPIRED'],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'PROMOTION_NOT_FOUND'],
  },
  ClubPromotionsController_deactivatePromotion: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'PROMOTION_NOT_FOUND'],
  },
  ClubPromotionsController_deletePromotion: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'PROMOTION_NOT_FOUND'],
  },
  ClubTicketsController_createClubTicketType: {
    '400': ['TICKET_SALE_RANGE_INVALID'],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND'],
  },
  ClubTicketsController_listClubTicketTypes: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND'],
  },
  ClubTicketsController_updateTicketType: {
    '400': ['TICKET_QUANTITY_BELOW_SOLD', 'TICKET_SALE_RANGE_INVALID'],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'TICKET_TYPE_NOT_FOUND'],
  },
  ClubTicketsController_deactivateTicketType: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'TICKET_TYPE_NOT_FOUND'],
  },
  ClubTicketsController_activateTicketType: {
    '400': ['TICKET_SALE_ENDED'],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'TICKET_TYPE_NOT_FOUND'],
  },
  ClubTicketsController_deleteTicketType: {
    '400': ['TICKET_TYPE_DELETE_NOT_ALLOWED'],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'TICKET_TYPE_NOT_FOUND'],
  },
  EventTicketsController_createEventTicketType: {
    '400': ['TICKET_SALE_RANGE_INVALID'],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND'],
  },
  EventTicketsController_listEventTicketTypes: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND'],
  },
  EventTicketsController_updateEventTicketType: {
    '400': ['TICKET_QUANTITY_BELOW_SOLD', 'TICKET_SALE_RANGE_INVALID'],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND', 'TICKET_TYPE_NOT_FOUND'],
  },
  EventTicketsController_deactivateEventTicketType: {
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND', 'TICKET_TYPE_NOT_FOUND'],
  },
  EventTicketsController_activateEventTicketType: {
    '400': ['TICKET_SALE_ENDED'],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND', 'TICKET_TYPE_NOT_FOUND'],
  },
  EventTicketsController_deleteEventTicketType: {
    '400': ['TICKET_TYPE_DELETE_NOT_ALLOWED'],
    '403': ['CLUB_MANAGE_FORBIDDEN'],
    '404': ['CLUB_NOT_FOUND', 'EVENT_NOT_FOUND', 'TICKET_TYPE_NOT_FOUND'],
  },
  UsersController_searchUsers: {
    '403': ['USER_SEARCH_FORBIDDEN'],
  },
  UsersController_updateMyProfile: {
    '400': ['INVALID_FULL_NAME', 'INVALID_PROFILE_IMAGE_MUTATION', 'UPLOAD_EXPIRED'],
    '404': ['UPLOAD_NOT_FOUND', 'USER_NOT_FOUND'],
    '409': ['EMAIL_ALREADY_REGISTERED', 'UPLOAD_ALREADY_USED', 'UPLOAD_NOT_TEMPORARY'],
  },
  AdminBusinessAccessController_get: {
    '404': ['BUSINESS_ACCESS_REQUEST_NOT_FOUND'],
  },
  AdminBusinessAccessController_startReview: {
    '404': ['BUSINESS_ACCESS_REQUEST_NOT_FOUND'],
    '409': ['BUSINESS_ACCESS_REQUEST_NOT_REVIEWABLE'],
  },
  AdminBusinessAccessController_approve: {
    '404': ['BUSINESS_ACCESS_REQUEST_NOT_FOUND', 'NOTIFICATION_TEMPLATE_NOT_FOUND'],
    '409': ['BUSINESS_ACCESS_REQUEST_NOT_APPROVABLE', 'REQUESTED_CLUB_REQUIRED'],
  },
  AdminBusinessAccessController_reject: {
    '404': ['BUSINESS_ACCESS_REQUEST_NOT_FOUND', 'NOTIFICATION_TEMPLATE_NOT_FOUND'],
    '409': ['BUSINESS_ACCESS_REQUEST_NOT_REJECTABLE'],
  },
  BusinessAccessController_create: {
    '400': [
      'BUSINESS_ACCESS_REVIEW_CONSENT_REQUIRED',
      'REQUESTED_CLUB_NOT_ALLOWED',
      'REQUESTED_CLUB_REQUIRED',
    ],
    '404': ['CLUB_NOT_FOUND'],
    '409': ['BUSINESS_ACCESS_ALREADY_GRANTED', 'BUSINESS_ACCESS_REQUEST_ACTIVE'],
  },
  BusinessAccessController_get: {
    '404': ['BUSINESS_ACCESS_REQUEST_NOT_FOUND'],
  },
  BusinessAccessController_cancel: {
    '404': ['BUSINESS_ACCESS_REQUEST_NOT_FOUND'],
    '409': ['BUSINESS_ACCESS_REQUEST_NOT_CANCELLABLE'],
  },
  AuditController_search: {
    '403': ['SUPER_ADMIN_REQUIRED'],
  },
  AuditController_policy: {
    '403': ['SUPER_ADMIN_REQUIRED'],
  },
  AuditController_updatePolicy: {
    '403': ['SUPER_ADMIN_REQUIRED'],
  },
  AuditController_verify: {
    '403': ['SUPER_ADMIN_REQUIRED'],
  },
  PlatformController_getDashboard: {
    '403': ['SUPER_ADMIN_REQUIRED'],
  },
  PlatformController_getSettings: {
    '403': ['SUPER_ADMIN_REQUIRED'],
  },
  PlatformController_listUsers: {
    '403': ['SUPER_ADMIN_REQUIRED'],
  },
};
