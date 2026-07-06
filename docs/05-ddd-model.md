# Modelo DDD

# Enfoque

NightClub Platform se construira como monolito modular con DDD y arquitectura hexagonal. Cada modulo debe encapsular su dominio, reglas, casos de uso y contratos hacia infraestructura.

## Bounded contexts propuestos

- Identity.
- Platform.
- Organization.
- Club.
- Event.
- Catalog.
- Commerce.
- Payment.
- Wallet.
- QR Validation.
- Notification.
- Reporting.
- Audit.
- Shared.

## Identity

Responsable de usuarios, autenticacion, sesiones, refresh tokens y roles base.

Entidades:

- User.
- Session.
- RefreshToken.

Value Objects:

- PhoneNumber.
- OptionalEmail.
- PasswordHash.
- UserStatus.
- PhoneVerificationCode.

Casos de uso:

- RegisterUser.
- ConfirmPhoneNumber.
- ResendPhoneConfirmationCode.
- LoginUser.
- RefreshSession.
- ChangeUserRole.
- ActivateUser.
- DeactivateUser.

## Platform

Responsable de configuracion global de la plataforma, comisiones y controles administrativos.

Entidades:

- PlatformSettings.
- CommissionPolicy.

Casos de uso:

- UpdatePlatformSettings.
- ConfigureCommission.
- ViewGlobalDashboard.

## Organization

Preparado para evolucion futura. En MVP puede ser minimo o incluso conceptual, pero debe reservarse el espacio para agrupar clubes.

Entidades futuras:

- Organization.
- OrganizationMember.

Relacion futura:

- Organization contiene Clubes.

## Club

Responsable de establecimientos, administradores, trabajadores y permisos por club.

Entidades:

- Club.
- ClubAdmin.
- ClubWorker.
- WorkerPermission.

Value Objects:

- ClubStatus.
- ClubProfile.
- Address.
- ContactInfo.
- SocialMediaLink.
- WeeklySchedule.

Casos de uso:

- CreateClub.
- UpdateClub.
- ActivateClub.
- DeactivateClub.
- AssignAdminToClub.
- RegisterWorker.
- UpdateWorkerPermissions.

## Event

Responsable de eventos, estados, aforo, entradas y disponibilidad.

Entidades:

- Event.
- TicketType.
- CapacityControl.

Value Objects:

- EventStatus.
- EventSchedule.
- Capacity.
- Price.

Casos de uso:

- CreateEvent.
- PublishEvent.
- StartSale.
- UpdateCapacity.
- FinishEvent.
- CancelEvent.

## Catalog

Responsable de productos y promociones vendibles.

Entidades:

- Product.
- Promotion.
- PromotionItem.

Value Objects:

- ProductStatus.
- PromotionRules.
- Money.

Casos de uso:

- CreateProduct.
- UpdateProduct.
- CreatePromotion.
- ActivatePromotion.
- DeactivatePromotion.

## Commerce

Responsable de carrito, ordenes, items comprados, tickets generados y derechos de consumo.

Entidades:

- Cart.
- CartItem.
- Order.
- OrderItem.
- Ticket.
- ConsumableRight.

Value Objects:

- OrderStatus.
- TicketStatus.
- QRPayload.
- UniqueCode.

Casos de uso:

- AddItemToCart.
- CheckoutCart.
- ConfirmOrderPayment.
- GenerateTickets.
- GenerateConsumableRights.

## Payment

Responsable de integracion con Culqi, intentos de pago, confirmaciones y webhooks.

Entidades:

- PaymentIntent.
- PaymentTransaction.
- PaymentWebhookEvent.

Value Objects:

- PaymentStatus.
- ProviderReference.

Puertos:

- PaymentGatewayPort.

Adaptadores:

- CulqiPaymentGateway.

## Wallet

Responsable de movimientos, balances calculados y retiros.

Entidades:

- Wallet.
- WalletMovement.
- WithdrawalRequest.

Value Objects:

- WalletType.
- MovementType.
- Money.
- WithdrawalStatus.

Casos de uso:

- RegisterSaleMovement.
- RegisterCommissionMovement.
- CalculateBalance.
- RequestWithdrawal.
- ApproveWithdrawal.
- RejectWithdrawal.
- MarkWithdrawalAsPaid.

## QR Validation

Responsable de validar tickets y derechos de consumo con seguridad y concurrencia.

Servicios de dominio:

- QRSignatureVerifier.
- TicketValidationService.
- ConsumableValidationService.
- CapacityValidationService.

Puertos:

- DistributedLockPort.
- TicketRepository.
- AuditLogPort.

Casos de uso:

- ValidateTicketQR.
- ValidateProductQR.
- ValidatePromotionQR.

## Audit

Modulo transversal para trazabilidad.

Entidades:

- AuditLogEntry.

Value Objects:

- AuditAction.
- Actor.
- TargetResource.

Casos de uso:

- RegisterAuditLog.
- QueryAuditLogs.

## Shared kernel

Debe mantenerse pequeno. Puede contener:

- Money.
- EntityId.
- DateRange.
- DomainEvent.
- Result.
- Pagination.
- Base errors.

No debe convertirse en un deposito de logica de negocio de todos los modulos.
