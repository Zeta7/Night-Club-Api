# Vigencia de eventos y catálogo

## Reglas operativas

El estado persistido expresa una decisión administrativa; la disponibilidad
también depende del reloj. `effectiveEventStatus` devuelve FINISHED cuando un
evento PUBLISHED, SALE_ACTIVE, SOLD_OUT o IN_PROGRESS alcanza `endsAt`. Conserva
DRAFT, CANCELLED y POSTPONED. La hora de fin es exclusiva: `endsAt <= now` ya no
permite venta ni canje. No se depende de un cron para ocultar contenido vencido.

`currentEventsWhere` filtra por estado público y fin futuro antes de paginar o
contar. Resumen, listados públicos y operaciones aplican esa condición. Las
promociones activas deben cumplir además sus fechas y la vigencia del evento
asociado. Una promoción o entrada puede conservar su configuración ACTIVE sin
estar disponible; no se altera ese flag durante una lectura.

Carrito y checkout comparten `eventAllowsSales`: SALE_ACTIVE o IN_PROGRESS y
fin futuro. El canje conserva sus requisitos independientes, incluido el inicio
de vigencia del QR; se comprueba el evento nuevamente en la transacción. Activar
una entrada o promoción vencida, o ligada a un evento terminado/cancelado, falla
con un error explícito. La preparación para eventos futuros sin publicar sigue
permitida. Editar cupo conserva INACTIVE; editar una sola fecha conserva y valida
el otro extremo. No se permite postergar un evento ya terminado.

## Publicación y Mercado Pago

Toda la oferta Customer del local, incluidos los eventos gratuitos o informativos,
requiere local ACTIVE y conexión `mercado_pago` CONNECTED con token vigente.
`paymentReadyClubWhere` es compartido por descubrimiento y publicación. Publicar
o activar venta sin esos requisitos devuelve `EVENT_PAYMENTS_NOT_READY`.

Publicar incorpora el evento al catálogo; activar venta es una transición separada.
Desconectar Mercado Pago oculta la oferta y bloquea nuevas compras, sin borrar los
derechos ya adquiridos. Cancelación, reprogramación y devoluciones mantienen sus
operaciones y protecciones transaccionales existentes.

## Contrato y entrega

Se conservan rutas, DTO, campos, enums y estados configurados de entradas y
promociones. Los estados derivados usan los valores existentes. No hay migración
Prisma ni necesidad de regenerar el SDK por estos cambios. Sí se debe ejecutar
`pnpm docs:build` para actualizar Swagger con los nuevos códigos de error;
la comparación de esquemas confirma que no cambian los modelos de respuesta.
El usuario realizará esa regeneración manualmente. La app usa las fechas
tipadas del evento y de sus ofertas para mantener filtros, etiquetas y QR alineados.

La corrección requiere desplegar el backend. No se ejecutan actualizaciones
masivas de datos históricos ni se extiende la vigencia de compras emitidas.
Las pruebas de `test/unit/events` y `test/unit/commerce` cubren consultas, fechas,
activación, publicación, carrito, checkout y protección de transiciones.

Validación local: TypeScript sin errores y 128 pruebas unitarias aprobadas
(`pnpm exec jest test/unit --runInBand --silent`). La comprobación de Swagger
detecta únicamente diferencias en códigos de error, sin cambios en esquemas de
respuesta. No se probaron pagos ni canjes contra servicios reales.
