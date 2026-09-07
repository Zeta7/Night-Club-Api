# Migración incremental a Mercado Pago

## Arquitectura y convivencia

Mercado Pago es la única pasarela operativa para órdenes y recargas. Las órdenes usan la cuenta OAuth del negocio; las recargas usan la cuenta de plataforma y comisión marketplace cero. El simulador se admite únicamente fuera de producción. El código y los identificadores históricos de Flow permanecen en el repositorio y la base, pero su controlador no se registra y la configuración no permite crear pagos nuevos con Flow.

Mercado Pago se integra como marketplace 1:1: cada orden pertenece a un solo negocio, la preferencia se crea con el `access_token` OAuth cifrado de ese vendedor y `marketplace_fee` envía la comisión de Beerry. Beerry no custodia el total de la venta. El ledger es informativo.

## Migración de base de datos

Aplicar manualmente, antes de activar endpoints o checkout Mercado Pago:

```text
prisma/migrations/20260906120000_add_business_access_and_mercado_pago/migration.sql
```

La migración es aditiva: agrega solicitudes comerciales, conexión OAuth, estados/columnas financieras e índices. No modifica migraciones históricas ni elimina datos de Flow.

## Contratos API

Solicitudes del usuario:

- `POST /business-access-requests`
- `GET /business-access-requests/mine`
- `GET /business-access-requests/:id`
- `POST /business-access-requests/:id/cancel`

Revisión de plataforma (solo `SUPER_ADMIN`):

- `GET /admin/business-access-requests`
- `GET /admin/business-access-requests/:id`
- `POST /admin/business-access-requests/:id/start-review`
- `POST /admin/business-access-requests/:id/approve`
- `POST /admin/business-access-requests/:id/reject`

Comisiones:

- `GET|PATCH /admin/platform/marketplace-fee`
- `GET /clubs/:clubId/marketplace-fee`
- `PATCH|DELETE /admin/clubs/:clubId/marketplace-fee`

Conexión del vendedor:

- `GET /clubs/:clubId/payments/mercado-pago`
- `POST /clubs/:clubId/payments/mercado-pago/connect`
- `POST /clubs/:clubId/payments/mercado-pago/disconnect`
- `GET /payments/mercado-pago/oauth/callback` (público)

Pago y devolución:

- `POST /cart/checkout` con `paymentMethod=MERCADO_PAGO`
- `POST /payments/mercado-pago/webhook` (público, firmado)
- `GET /payments/mercado-pago/return` (público; nunca confirma el pago)
- `POST /clubs/:clubId/orders/:orderId/refund-requests`
- `POST /admin/refund-requests/:refundRequestId/process` (solo `SUPER_ADMIN`)

## OAuth

El backend comprueba que el actor administre el negocio, genera nonce aleatorio, conserva solo su hash y entrega un `state` firmado y con vencimiento. El callback consume ese estado una sola vez, intercambia el código, cifra tokens con AES-256-GCM y asocia el vendedor al negocio. Una cuenta Mercado Pago no puede conectarse simultáneamente a más de un negocio. La respuesta vuelve a Flutter sin credenciales y la app refresca el estado desde la API.

## Compra y confirmación

El backend vuelve a validar que todo el carrito pertenezca al mismo negocio, calcula montos desde sus propios registros y bloquea pagos mixtos Mercado Pago/billetera promocional. Guarda el snapshot financiero antes de crear la preferencia. El webhook valida HMAC, usa solamente el ID notificado, consulta `/v1/payments/{id}` con el token del vendedor y compara intento, orden, negocio, moneda, monto, vendedor y comisión. Solo un resultado autoritativo `APPROVED` confirma reservas y emite derechos. Los eventos usan una restricción única para ser idempotentes.

El retorno de navegador contiene únicamente `provider`, `attemptId`, `operationType` y `operationId` en `beerry://payments/result`; Flutter consulta el estado al backend.

## Comisión

La resolución es `club.marketplaceFeeBps ?? platform.defaultMarketplaceFeeBps`. `null` conserva la herencia. Para compatibilidad, si aún no existe el campo nuevo se lee `commissionPercentage` y se convierte a puntos base. La modificación nueva elimina ese valor legado.

La comisión se calcula exclusivamente sobre el monto externo:

```text
feeCents = floor((customerFundedCents * feeBps + 5000) / 10000)
```

Esto implementa redondeo half-up con enteros. El snapshot guarda bruto, monto externo, bps, comisión, neto esperado, origen, moneda, negocio y vendedor; cambios posteriores no alteran pagos históricos.

## Estados y devoluciones

Estados neutrales: `APPROVED`, `PENDING`, `REJECTED`, `CANCELLED`, `EXPIRED`, `REFUND_PENDING`, `REFUNDED`, `PARTIALLY_REFUNDED` y `CHARGEBACK`. Flutter acepta temporalmente tanto `CHARGEBACK` como el histórico `CHARGEDBACK`.

Procesar una solicitud envía el reembolso con una clave idempotente y guarda el ID externo, pero mantiene `PROCESSING`. Solo la consulta autoritativa/webhook completa el proceso. Los parciales acumulan el monto confirmado, calculan la reversión proporcional de comisión sobre el total acumulado y revierten únicamente el delta nuevo. No revocan recursos de forma indiscriminada; una devolución total o contracargo revoca solo recursos todavía disponibles. Una solicitud activa por orden evita envíos duplicados.

## Variables de entorno

- `ORDER_PAYMENT_PROVIDER=mercado_pago` (`simulated` solamente fuera de producción)
- `WALLET_TOP_UP_PAYMENT_PROVIDER=mercado_pago` (`simulated` solamente fuera de producción)
- `MARKETPLACE_FEE_MAX_BPS`
- `MERCADO_PAGO_CLIENT_ID`
- `MERCADO_PAGO_CLIENT_SECRET`
- `MERCADO_PAGO_REDIRECT_URI`
- `MERCADO_PAGO_RETURN_URL`
- `MERCADO_PAGO_NOTIFICATION_URL`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `MERCADO_PAGO_OAUTH_STATE_SECRET`
- `SELLER_CREDENTIALS_ENCRYPTION_KEY`
- `MERCADO_PAGO_USE_SANDBOX_CHECKOUT`

`MERCADO_PAGO_PLATFORM_ACCESS_TOKEN` es obligatorio para crear y consultar recargas. Nunca se usa para órdenes de negocios ni se devuelve a Flutter.

## Prueba sandbox y activación gradual

1. Aplicar la migración y desplegar inicialmente con los proveedores actuales.
2. Configurar secretos y URLs HTTPS públicas; registrar en Mercado Pago el callback y webhook exactos.
3. Definir la comisión global.
4. Aprobar un administrador de negocio y conectar una cuenta vendedora de prueba.
5. En desarrollo puede usarse temporalmente `simulated`; validar solicitud/OAuth y luego probar compra y recarga sandbox con Mercado Pago.
6. Verificar firma, duplicados, monto, moneda, vendedor, comisión, retorno y polling.
7. Probar devolución total y parcial, incluida la repetición de la misma petición idempotente.
8. Configurar `ORDER_PAYMENT_PROVIDER=mercado_pago` y `WALLET_TOP_UP_PAYMENT_PROVIDER=mercado_pago`.
9. Monitorear pagos pendientes, errores OAuth, webhooks y conciliación antes de ampliar la activación.

No habilitar pagos reales hasta confirmar en sandbox las capacidades y medios de pago efectivamente disponibles para las cuentas peruanas participantes.
