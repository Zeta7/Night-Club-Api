# Changelog

## Unreleased

- 2026-09-29 — Auditoría de notificaciones completada: el centro ofrece páginas
  por cursor con orden estable y filtros por usuario; Firebase divide los envíos
  en lotes de 500 y persiste resultados por dispositivo para reintentar solamente
  pendientes. Conserva ownership, deshabilita tokens inválidos y protege claims
  concurrentes. Se añaden integraciones PostgreSQL para paginación, avisos de
  evento, outbox y recuperación de entregas. API #16, coordinación Mobile #16.

- 2026-09-29 — Notificaciones: los pagos rechazados o vencidos abren su compra;
  QR disponibles abre el inventario de esa orden; los avisos de eventos enlazan
  una orden propia, el evento del negocio o el historial de QR de sus titulares.
  La lectura masiva afecta solo al centro
  visible y los errores del despachador periódico quedan registrados. Firebase
  conserva los identificadores de navegación, omite lotes totalmente inválidos
  y reintenta fallos completos aunque incluyan un token inválido. API #16,
  coordinación Mobile #16.

- 2026-09-27 — Explorar acepta una consulta sin `q` para el catálogo nacional y
  expone páginas acotadas de 30 Locales, Eventos, Promociones y Productos por
  categoría con `nextPage`. Conserva la búsqueda de al menos dos caracteres y
  no aplica la ubicación del cliente. El DTO y el servicio compilan; la prueba
  focalizada del contrato pasó. API #15, coordinación Mobile #15.

- 2026-09-27 — Inicio: catálogos cercanos paginados de Eventos, Locales y
  Promociones con ámbito administrativo, orden autoritativo y cursor estable;
  Eventos pospuestos visibles en el catálogo. Las Promociones exponen tipo,
  nombre y cantidad de cada componente sin inferir ahorro ni referencia. Inicio
  retira Entradas, Productos y copy transitorios. API #14, especificación Mobile #8.

- 2026-09-26 — Inicio: Destacados tipados y autocontenidos con elegibilidad de Local
  y Evento, deduplicación por destino y selección nacional o administrativa. La
  API ordena Eventos, Locales y Promociones con horario de Lima, entrega vistas
  previas de 3/3/6 y totales completos, y agrega disponibilidad de Entradas por
  Evento. API #13, especificación Mobile #8. El SDK Mobile debe regenerarse.

- 2026-09-26 — Inicio: contrato base de contenido cercano con coincidencia administrativa,
  Locales activos visibles aunque no puedan vender, disponibilidad comercial,
  cantidades y causas vacías estructuradas. Se mantienen temporalmente los campos
  antiguos de Mobile; el SDK debe regenerarse desde OpenAPI en el trabajo Mobile.
  API #12, especificación Mobile #8. Validación: TypeScript, 263 pruebas de 40
  suites con PostgreSQL temporal, build y generación OpenAPI.

- Recargas abandonadas con vencimiento efectivo de 30 minutos: revisión al iniciar
  API y cada minuto, recuperación de registros antiguos sin fecha y cierre de
  intento y recarga en una transacción. Las consultas de detalle reconcilian
  Mercado Pago por ID de pago o referencia del intento y no devuelven enlaces
  vencidos. Las nuevas preferencias llevan el mismo plazo; una aprobación tardía
  verificada acredita saldo y ledger una sola vez, incluso con callbacks
  concurrentes. No requiere migración ni cambios del SDK. API #11, Mobile #10.

- Enums compartidos `BusinessType` y `OfferScope` en requests y respuestas HTTP.
  El alcance de promociones Customer cambia de `CLUB`/`EVENT` a `club`/`event`,
  igual que promociones y entradas operativas. Requiere regenerar el SDK.

- Títulos descriptivos y alcance de acceso explícito en todos los endpoints
  publicados en Swagger, con los roles CUSTOMER, WORKER, ADMIN y SUPER_ADMIN,
  o PUBLIC cuando no se requiere sesión. Se aclaran permisos de trabajadores,
  acceso a recursos propios y requisitos de autenticación.
- Limpieza del tipado de pagos, OAuth, QR, auditoría y notificaciones: JSON
  comprobado en los límites, metadatos serializables y eliminación de conversiones
  forzadas. Firebase devuelve únicamente tokens inválidos presentes en el lote.
- Swagger conserva la documentación declarada en los controladores y DTOs; se
  eliminan ejemplos, permisos y textos inferidos por nombres. Las operaciones
  de validación de códigos comparten su DTO de respuesta.
- Contratos HTTP explícitos por módulo, comprobados por TypeScript y publicados
  mediante Swagger de Nest. Se elimina el generador propio de respuestas.
- Perfiles de club e instantáneas de eventos con estructuras concretas para el
  SDK; enums compartidos, distinción entre céntimos enteros e importes decimales,
  y nulabilidad corregida.
- Respuestas de compras, recargas, consumibles y devoluciones con estructuras
  concretas; se eliminan las mezclas de variantes con campos opcionales. Cambios
  de consumo documentados en `docs/openapi-contract.md`.
- Comprobación estricta de accesos por índice y enums de Prisma para los estados
  de cancelaciones y devoluciones ya restringidos por PostgreSQL. Requiere la
  migración `20260926000100_type_event_resolution_states` y regenerar el SDK.
