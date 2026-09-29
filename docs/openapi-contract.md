# Contrato HTTP y SDK

Las respuestas públicas se declaran en los archivos `*.response.dto.ts` de cada
módulo. Cada controlador especifica el tipo de retorno y el mismo DTO en
`@ApiResponse`. TypeScript comprueba la implementación; Swagger de Nest construye
los componentes OpenAPI a partir de esos DTOs. No hay un generador propio de tipos.

## Mantener un contrato

- Define una clase por estructura pública y reutilízala cuando represente el mismo
  concepto. No exportes modelos de Prisma como contrato HTTP.
- Una propiedad opcional (`?`) puede omitirse. Una propiedad nullable (`| null`)
  debe declarar `nullable: true`. No son equivalentes.
- Documenta importes en céntimos, cantidades y contadores como `integer`; precios
  con decimales como `number`; fechas como `string` con formato `date-time`.
- Reutiliza los enums de Prisma cuando representan el mismo estado. Usa
  `enumName` para obtener un único enum nombrado en el SDK.
- Convierte JSON persistido de estructura conocida a campos concretos antes de
  devolverlo. Los lectores de perfil de club y de instantáneas de compra manejan
  los datos históricos sin inventar fechas ni confiar en casts.
- Reserva `JsonValue` para contenido variable: metadatos de auditoría y contables,
  datos de proveedores, notificaciones y valores de configuración. El verificador
  mantiene una lista explícita de esos campos.
- Documenta los errores públicos al cambiar su comportamiento; sus códigos se
  mantienen en `openapi.error-codes.ts`.
- Escribe resúmenes, descripciones y ejemplos en `@ApiOperation`, `@ApiParam` y
  `@ApiProperty`. El procesamiento de OpenAPI no los inventa a partir de nombres
  ni deduce permisos de los nombres de controladores.
- Trata JSON externo como `unknown` hasta comprobar su estructura. Los puertos
  de pagos y notificaciones aceptan `JsonObject`, que limita los metadatos a
  valores JSON, sin conversiones forzadas al persistirlos.
- Mantén `strict` completo y `noUncheckedIndexedAccess`: una propiedad de clase
  debe inicializarse y un acceso por índice puede no encontrar un valor.

## Inicio: disponibilidad y causas vacías

`GET /clubs/customer/home` entrega vistas previas limitadas y `counts` con los
totales del catálogo cercano antes de aplicar los límites de Inicio. El total de
Eventos incluye pospuestos aunque no estén en la vista previa.
`emptyReasons` entrega códigos por sección: `NO_ACTIVE_CLUBS_IN_SCOPE`,
`PAYMENTS_UNAVAILABLE`, `NO_VISIBLE_EVENTS` y `NO_ACTIVE_PROMOTIONS`. Un valor
`null` indica que la sección tiene resultados.

Cada Local de Inicio y su detalle expone `commerceStatus` (`AVAILABLE` o
`PAYMENTS_UNAVAILABLE`) y `emptyReason` (`PAYMENTS_UNAVAILABLE`,
`NO_EVENTS_OR_OFFERS` o `null`). El Local activo sin pagos vigentes conserva
dirección, contacto y horario, pero su contenido comercial no se publica.
`emptyReasons` reemplaza el copy anterior de `emptyState`. Entradas y Productos
no son secciones superiores de Inicio; siguen disponibles dentro de los detalles.
Los campos de Inicio no contienen copy de interfaz.

`GET /clubs/customer/catalog/events`, `/clubs/customer/catalog/clubs` y
`/clubs/customer/catalog/promotions` continúan el mismo ámbito administrativo y
orden de Inicio. Aceptan `district`, `province`, `department`, `limit` (1–30) y
`cursor`. Cada respuesta contiene `items`, `total`, `location` y `nextCursor`.
El cursor fija la hora de clasificación y el último ID; caduca a los 10 minutos
y solo puede usarse con la misma categoría y ubicación. Los Eventos pospuestos
aparecen al final del catálogo de Eventos con estado y `timing` `POSTPONED`.
Cada Promoción entrega `items` con tipo, nombre y cantidad. No se publica ahorro
ni precio de referencia porque el modelo actual no guarda esos hechos como
declaraciones independientes de los precios de componentes.

## Tipos de negocio y alcance de ofertas


Los requests de creación y edición de locales y sus respuestas públicas comparten
el componente OpenAPI `BusinessType`. Sus valores son `club`, `discoteca`,
`karaoke`, `bar`, `restobar` y `lounge`. La definición vive en
`src/modules/clubs/domain/business-type.ts`; los DTOs validan las entradas con
`IsEnum` y Swagger reutiliza el componente mediante `enumName`.

`OfferScope`, definido en `src/shared/domain/offer-scope.ts`, representa el
alcance de promociones y tipos de entrada: `club` o `event`. Todas las respuestas
que exponen este campo usan el mismo enum, incluidas las de Customer.

**Cambio de contrato:** el alcance de las promociones en Inicio, Explorar,
detalle de local y detalle de evento Customer pasa de `CLUB`/`EVENT` a
`club`/`event`. El campo geográfico `scope: PERU` de Explorar representa otro
concepto y conserva su valor.

Al regenerar el SDK de Mobile, usar los enums generados en los consumidores y
formularios. Las comparaciones de alcance deben usar el enum en lugar de strings
o conversiones de mayúsculas. No duplicar los enums ni modificar código generado.

No se modifican columnas ni se necesita una migración de base de datos.
`Club.type` sigue almacenado como texto; al construir una respuesta se comprueba
que pertenece a `BusinessType`. Un valor persistido desconocido produce un error;
no se convierte silenciosamente a `club` ni se publica como un enum válido.

Verificación local del 2026-09-26: `pnpm docs:build` regeneró
`dist/openapi.json` y validó 166 paths, 193 operaciones, 404 schemas y cero
referencias rotas. Los siete campos `type` de requests/respuestas de locales
referencian `BusinessType`; los cinco campos de alcance de ofertas referencian
`OfferScope`. Pasaron las 192 pruebas unitarias existentes. `dist/` es un
artefacto de build ignorado por Git; se regenera desde los DTOs, no se versiona.
Esta verificación no confirma el despliegue ni regenera el SDK de Mobile.

## Notificaciones: páginas y entrega por dispositivo

`GET /me/notifications` acepta `cursor` opaco y `limit` entero entre 1 y 100
(100 por defecto para conservar el tamaño de página de clientes anteriores).
La respuesta conserva `items` y `unreadCount` y añade `nextCursor`: un string
para continuar o `null` al finalizar. El total no leído sigue siendo global para
el usuario, aunque se apliquen filtros o se pidan páginas posteriores.

Las páginas ordenan por `createdAt DESC, id DESC`. El cursor conserva ambos
valores; insertar avisos nuevos o eliminar el aviso del cursor no desplaza la
continuación. El cliente debe omitir el cursor al actualizar o cambiar categoría
/ estado de lectura. Todas las páginas aplican ownership y visibilidad IN_APP.
Los cursores inválidos devuelven `INVALID_NOTIFICATION_CURSOR`; los límites
inválidos se rechazan por validación y por `INVALID_NOTIFICATION_LIMIT` en el
servicio. Mobile usa páginas de 30 y el SDK regenerado, sin mapeos JSON manuales.

El dispatcher envía lotes de hasta 500 dispositivos y guarda los tokens pendientes
y el número de éxitos en `NotificationDelivery.providerData` después de cada
lote. Los reintentos conservan ese progreso y excluyen dispositivos deshabilitados
o que ahora pertenecen a otro usuario. Un claim renovable y el número de intento
protegen las escrituras frente a workers concurrentes. No se añade una migración.
FCM no ofrece atomicidad con PostgreSQL: una caída entre la aceptación del mensaje
y el commit de su resultado puede repetir esa entrega; los éxitos ya persistidos
no se vuelven a enviar.

OpenAPI regenerado y validado el 2026-09-29: 169 paths, 196 operaciones, 416 schemas
y cero referencias rotas. `dist/openapi.json` permanece como artefacto ignorado;
las fuentes del contrato y esta documentación sí se versionan.

## Verificación

```powershell
pnpm docs:build
pnpm test:unit -- --runInBand
```

`docs:build` regenera Prisma, compila Nest y escribe `dist/openapi.json` sin abrir
un servidor ni conectarse a una base de datos. Verifica las rutas, referencias,
tipos de respuesta y coincidencia entre validación y documentación de requests.
`docs:check` ejecuta la misma verificación desde las fuentes actuales.

El SDK de Mobile se regenera con su herramienta `tool/openapi.dart`, usando el
JSON local como entrada. Los archivos generados no se editan manualmente.

## Migración de septiembre de 2026

Los modelos del SDK cambian de nombre al usar DTOs compartidos. Los perfiles de
club (`address`, `contact`, `socialMedia`, `schedule`, incluidas sus variantes
`*Json`) ahora tienen campos definidos. `eventSnapshot` conserva sólo la
información histórica disponible; sus fechas y nombre son opcionales.

Los consumidores deben adaptar estos cambios de estructura al regenerar el SDK:

- Consumibles: `rights` y `deliveries` reemplazan la lista heterogénea `items`.
- Devoluciones de eventos: `jobs` contiene sólo trabajos; las solicitudes sin
  asignar se publican como `unallocatedRefunds`, con su estado real.
- Simulación de pagos: `order` y `topUp` contienen la respuesta correspondiente;
  el otro campo es `null`. Los movimientos de billetera usan la misma separación
  dentro de `related`.
- Dashboards: las listas vacías y los objetos ausentes (`null`) se declaran
  explícitamente. Ya no dependen de propiedades opcionales según la rama.
- Se elimina `generatedCount` del checkout: nunca representó un conteo real de
  derechos generados. `total` y el saldo disponible de crédito son decimales;
  los campos `*Cents` siguen siendo enteros.
- Los estados de promociones usan `PromotionStatus`, los permisos
  `WorkerPermission`, y los días y redes sociales tienen enums compartidos.
- La validación manual y la detección de códigos comparten
  `CodeValidationResponseDto`; la reversión usa el enum `RedeemableStatus`.

Los perfiles históricos se normalizan a los campos documentados; los elementos
de redes sociales y horarios con tipos o días desconocidos se descartan de la
respuesta. Los datos persistidos no se sobrescriben al leerlos.

La migración `20260926000100_type_event_resolution_states` convierte cuatro
columnas de texto en enums con los mismos valores que sus restricciones CHECK
anteriores. Debe aplicarse antes de desplegar el backend actualizado. No modifica
las decisiones ni las transiciones de cancelaciones y devoluciones.

## Notificaciones: bandejas por modo

`NotificationAudience` contiene `CUSTOMER` (compras, pagos, QR y solicitudes
personales) y `OPERATIONS` (ventas recibidas por trabajadores con VIEW_SALES,
retiros y revisiones administrativas). Cada `NotificationDto.audience` es
obligatorio y persistido según su productor; cambiar el rol o modo de la cuenta
no mueve sus avisos de una bandeja a otra. Las respuestas a solicitudes comerciales
se fijan en CUSTOMER para Cliente/Trabajador y OPERATIONS para Admin/SuperAdmin
al emitirse, según la experiencia disponible del destinatario. Admin/SuperAdmin
abre su propia solicitud en `/admin/profile/business-access`; Cliente/Trabajador
conserva `/profile/business-access`. La categoría no determina la bandeja:
EVENT y ORDER pueden aparecer en ambos contextos.

`GET /me/notifications` admite `audience` opcional. El servidor filtra antes
de paginar y vincula el cursor a ese audience. Cambiar de modo requiere reiniciar
el cursor. Un cursor histórico sin audience solo es válido al omitir el filtro.
`unreadCount` cuenta los avisos visibles no leídos del audience seleccionado,
o todos si se omite. `unreadCounts` (`NotificationUnreadCountsDto`) siempre
entrega `customer` y `operations` globales para el usuario, sin filtros de
categoría o estado de lectura.

`POST /me/notifications/read-all?audience=...` afecta solo a los avisos visibles
de esa bandeja; omitir audience conserva la lectura global anterior.
`PATCH /me/notifications/:notificationId/read` mantiene la comprobación de
propiedad individual. El filtro de bandeja no concede permisos sobre compras,
ventas, locales ni revisiones: esos endpoints conservan su autorización.

La migración `20260929000100_notification_audience` clasifica los avisos existentes
por plantillas, metadata de revisión y destinos conocidos; conserva IDs, contenido
y estado leído. Repara los eventos de compradores que el despachador antiguo
había dirigido al modo administrativo por el rol de la cuenta. Firebase transporta
`audience` como campo reservado que metadata no puede sobrescribir.
