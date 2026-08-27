# Plan de implementación: documentación Swagger/OpenAPI

## Propósito

Este documento dirige una implementación completa de la documentación REST expuesta por Swagger para Beerry API.

El resultado debe corregir exclusivamente el contrato OpenAPI. El comportamiento HTTP actual de la aplicación debe permanecer intacto.

Este plan está diseñado para ejecutarse como un objetivo duradero de Codex mediante `/goal`.

## Comando recomendado

Desde la raíz del repositorio:

```text
/goal Implementa completamente docs/12-openapi-documentation-implementation-plan.md. Limita los cambios a la documentación Swagger/OpenAPI y a la configuración mínima necesaria para generarla. No añadas ni modifiques pruebas automatizadas, suites Jest, pruebas HTTP, snapshots, comandos de test o controles de CI. Trabaja por checkpoints, ejecuta las verificaciones documentales indicadas y detente sólo cuando todos los criterios de terminado estén satisfechos. Si encuentras un problema funcional fuera de alcance, documenta fielmente el runtime actual, regístralo como seguimiento y continúa; declara bloqueo únicamente si una ambigüedad no permite producir documentación veraz sin una decisión del usuario.
```

No establezcas un presupuesto de tokens salvo que exista una razón operativa concreta. La condición de parada debe ser el cumplimiento verificable del contrato, no el consumo de un presupuesto.

## Objetivo

Convertir el documento OpenAPI generado por NestJS en un contrato completo, preciso y verificable para las 148 operaciones REST publicadas actualmente.

Al terminar, una persona o herramienta debe poder conocer desde `/api/docs-json`, sin leer los controladores o servicios:

- qué operaciones existen;
- qué autenticación, rol y permisos necesita cada operación;
- qué parámetros, filtros y cuerpos acepta;
- qué restricciones y formatos tiene cada campo;
- qué status, media type y payload devuelve cada resultado exitoso;
- qué errores reales puede devolver cada operación;
- cómo funcionan los casos especiales de uploads, Flow, CSV y SSE.

## Condición de parada

El objetivo termina únicamente cuando se cumplen todos los criterios documentales de la sección [Definition of Done](#definition-of-done), los comandos de verificación aplicables finalizan correctamente y el informe final incluye las métricas antes/después.

Si corregir un problema exige cambiar comportamiento, el agente debe documentar fielmente el runtime actual, registrar un hallazgo funcional fuera de alcance y continuar. Un hallazgo fuera de alcance no impide completar este objetivo cuando Swagger describe con precisión el comportamiento existente.

Sólo existe un bloqueo documental cuando, después de inspeccionar el código que implementa el flujo, el contrato real sigue siendo ambiguo y escoger una representación requeriría una decisión del usuario. Ese bloqueo debe afectar únicamente a las operaciones ambiguas; el agente debe completar primero todo el trabajo independiente.

## Alcance autorizado

Se permiten cambios en:

- configuración y construcción del documento Swagger/OpenAPI;
- decoradores de `@nestjs/swagger` en controladores y DTOs;
- clases de presentación creadas exclusivamente como schemas de documentación;
- tipos de retorno TypeScript cuando no alteren el JavaScript emitido ni la serialización;
- utilidades y decoradores reutilizables de documentación;
- configuración del plugin de compilación de Swagger;
- un mecanismo mínimo de generación local del documento, sólo si es necesario para revisar el resultado;
- este documento, únicamente para mantener un registro breve del progreso.

Los cambios deben permanecer dentro de la documentación Swagger/OpenAPI y de la configuración mínima necesaria para generarla.

## Fuera de alcance

Quedan fuera de alcance:

- cambios en rutas, verbos, guards o autorización;
- cambios en roles, permisos u ownership;
- cambios en status codes reales;
- cambios en payloads de request o response;
- introducir un envelope de éxito nuevo;
- cambios en validaciones runtime de `class-validator`;
- cambios en servicios, reglas de negocio, Prisma, migraciones o base de datos;
- cambios en proveedores externos, pagos, S3, notificaciones o colas;
- despliegues y configuración de AWS;
- añadir o modificar pruebas automatizadas de cualquier tipo;
- suites Jest o Supertest, pruebas HTTP, snapshots y fixtures de prueba;
- comandos `test:openapi`, integración con CI o dependencias dedicadas a testing del contrato;
- pruebas visuales o interactivas de Swagger UI;
- rediseño, CSS o personalización visual de Swagger UI;
- actualización general de `docs/10-rest-api.md`, README u otra documentación narrativa;
- refactors no necesarios para generar OpenAPI.

## Fuentes de verdad

Usar las fuentes en este orden:

1. Controladores, guards y decoradores de NestJS para rutas y seguridad.
2. DTOs y `ValidationPipe` para solicitudes y restricciones.
3. Servicios, helpers y adaptadores para determinar respuestas y errores reales.
4. Documento OpenAPI generado localmente para comprobar el resultado.
5. JSON desplegado como línea base externa, no como sustituto del código local.

Referencias actuales:

- Swagger UI: `https://3najfmih66.execute-api.sa-east-1.amazonaws.com/api/docs#/`
- JSON: `https://3najfmih66.execute-api.sa-east-1.amazonaws.com/api/docs-json`
- YAML: `https://3najfmih66.execute-api.sa-east-1.amazonaws.com/api/docs-yaml`
- Configuración actual: `src/main.ts`
- Error común: `src/shared/presentation/api-exception.ts`
- Error de validación: `src/shared/presentation/validation-exception.factory.ts`

## Línea base auditada

Auditoría tomada el 27 de agosto de 2026:

| Métrica | Estado inicial |
|---|---:|
| Controladores | 22 |
| Operaciones declaradas en código | 149 |
| Operaciones intencionalmente excluidas | 1 |
| Operaciones OpenAPI esperadas | 148 |
| Paths publicados | 124 |
| Operaciones publicadas | 148 |
| Schemas publicados | 58 |
| Operaciones sin `summary` | 79 |
| Operaciones sin `description` | 96 |
| Declaraciones de response | 149 |
| Responses con `content` y schema | 0 |
| Schemas vacíos | 27 |
| Request bodies visibles | 58 |
| Bodies del código | 60 |
| Bodies con contrato utilizable | 28 |
| Parámetros visibles | 158 |
| Parámetros query omitidos | 35 en 6 operaciones |
| Parámetros sin descripción | 157 |
| Parámetros sin ejemplo | 153 |
| Operaciones protegidas | 134 |
| Operaciones protegidas con bearer correcto | 93 |
| Discrepancias de seguridad | 42 |

La paridad de inventario ya está confirmada: no faltan operaciones en el JSON y no sobran operaciones. El problema es la profundidad y exactitud contractual.

La única exclusión intencional es `GET /api/v1/media/*path`, implementada con `@ApiExcludeController`. Debe permanecer excluida y quedar registrada en una allowlist documental revisable.

## Principios obligatorios

### Documentar el runtime actual

Swagger debe describir lo que la API hace hoy. No debe presentar contratos aspiracionales.

En particular:

- las respuestas exitosas actuales son objetos directos y no usan el envelope sugerido por `docs/10-rest-api.md`;
- los errores creados mediante los helpers compartidos sí usan `{ data, meta, error }`;
- los status codes documentados deben coincidir con los status emitidos actualmente;
- una limitación de negocio sólo debe documentarse si el código realmente la aplica.

### Mantener separadas estructura y semántica

El plugin de Swagger debe encargarse de la estructura inferible: propiedades, opcionalidad, tipos y restricciones de `class-validator` compatibles.

Los decoradores o comentarios explícitos deben aportar la semántica que el compilador no puede inferir:

- propósito de la operación;
- significado del campo;
- unidades y ejemplos;
- autenticación, roles, permisos y ownership;
- respuestas y errores alcanzables;
- media types y headers especiales.

### Evitar datos sensibles

Los ejemplos no deben contener:

- JWT o refresh tokens reales;
- credenciales o claves externas;
- teléfonos, correos o nombres reales;
- URLs firmadas reales;
- identificadores de producción.

Usar UUIDs, teléfonos, emails y tokens inequívocamente ficticios.

### Mantener cambios revisables

Trabajar por checkpoints. Cada checkpoint debe:

1. dejar el documento generable;
2. mantener build y lint en verde;
3. revisar el fragmento correspondiente del JSON generado;
4. registrar brevemente lo completado antes de pasar al siguiente checkpoint.

## Decisiones técnicas

### Generación del documento OpenAPI

La documentación revisada debe provenir de la misma configuración que usa la aplicación mediante `DocumentBuilder`, `SwaggerModule.createDocument` y `SwaggerModule.setup`.

No es obligatorio extraer una fábrica ni introducir una nueva abstracción. Hacerlo sólo si resulta indispensable para generar el JSON local sin duplicar la configuración; esa extracción no debe alterar el arranque ni el comportamiento runtime.

Mantener las rutas públicas existentes:

- UI: `/api/docs`
- JSON: `/api/docs-json`
- YAML: `/api/docs-yaml`

Declarar explícitamente las rutas JSON/YAML si eso evita depender de defaults implícitos, sin cambiar las URLs actuales.

### Plugin de Swagger

Activar `@nestjs/swagger/plugin` en `nest-cli.json` con estas decisiones:

- `classValidatorShim: true`;
- `introspectComments: false` inicialmente;
- sufijos DTO predeterminados, salvo que una clase usada por el contrato quede fuera;
- conservar los mapped types importados desde `@nestjs/swagger`.

La semántica debe continuar siendo explícita. No convertir todo el proyecto a JSDoc como parte de esta tarea.

Revisar el JSON generado desde el build que utiliza esta configuración, de modo que la metadata observada sea la que publicará la aplicación.

### OpenAPI y operación IDs

Mantener OpenAPI `3.0.0` durante esta implementación. Una migración de versión sería una tarea separada.

Los 148 `operationId` publicados actualmente forman parte de la línea base y deben conservarse exactamente, porque un cambio puede romper clientes generados.

Los `operationId` deben ser:

- presentes;
- únicos;
- deterministas;
- idénticos a la línea base, salvo autorización explícita para un cambio contractual.

Capturar el mapa inicial de método, path y `operationId`. Puede conservarse la fábrica predeterminada o declararse el ID explícitamente, pero el documento final debe mantener el mismo mapa. Comparar el inventario inicial y final para detectar duplicados, desapariciones y renombres accidentales.

### Response DTOs documentales

Crear clases de response en la capa de presentación cuando no exista un tipo nominal reutilizable.

Estas clases:

- describen el payload actual;
- no activan serialización global;
- no filtran ni transforman respuestas runtime;
- no importan entidades Prisma completas sin revisar exposición de campos;
- pueden reutilizar modelos anidados comunes;
- distinguen respuestas con formas diferentes aunque ambas sean paginadas.

No crear un wrapper genérico que falsifique las diferencias entre usuarios, auditoría y referidos.

### Errores comunes

Crear schemas documentales compartidos para:

- error API común;
- detalle de validación `{ field, messages[] }`;
- `VALIDATION_ERROR`;
- autenticación y autorización;
- ejemplos de errores de dominio.

Usar decoradores reutilizables pequeños para reducir duplicación, por ejemplo:

- parámetro UUID;
- bearer y errores `401`/`403`;
- error de validación `400`;
- respuesta paginada cuando la forma sea realmente compartida;
- respuestas comunes por status.

Evitar un mega-decorador que oculte contratos distintos o documente errores que una operación no puede producir.

## Convención editorial

### Tags

Todas las operaciones deben usar `@ApiTags` explícito a nivel de controlador o método.

Definir los tags en `DocumentBuilder` con descripción y orden coherente. La taxonomía inicial debe cubrir los 21 grupos publicados actualmente:

- Health
- Auth
- Notification
- Platform
- Audit
- Clubs
- Club Workers
- Events
- Admin Events
- Club Events
- Capacity
- Club Products
- Club Promotions
- Club Tickets
- Event Tickets
- Uploads
- Users
- Wallets
- Commerce
- Flow Payments
- Referrals

Normalizar `FlowPayments` a un nombre legible sin alterar rutas ni operation IDs.

### Summary

Cada operación debe tener un summary breve, accionable y único:

- comenzar con un verbo en infinitivo;
- describir una sola acción;
- evitar roles y detalles de implementación entre paréntesis;
- evitar repetir literalmente la ruta.

Ejemplo:

```text
Obtener el perfil del usuario autenticado
```

### Description

Cada operación debe explicar, en este orden:

1. propósito y resultado;
2. autenticación requerida o carácter público;
3. roles, permisos y ownership aplicables;
4. efectos laterales, idempotencia o límites importantes;
5. particularidades del flujo cuando existan.

La descripción debe ser precisa y usar español con acentos. Los nombres técnicos, enums y códigos conservan su spelling real.

### Parámetros

Cada parámetro path, query o header debe indicar:

- descripción;
- obligatoriedad real;
- tipo y formato;
- enum si aplica;
- default si aplica;
- mínimo, máximo o patrón si aplica;
- ejemplo válido.

Los IDs UUID deben publicar `format: uuid`. Fechas ISO deben usar el formato OpenAPI que corresponda al valor real. Importes deben indicar si están expresados en céntimos.

### Request bodies

Cada body debe indicar:

- media type real;
- schema no vacío;
- campos required correctos;
- restricciones coherentes con `class-validator`;
- descripción de campos no obvios;
- ejemplo completo válido para flujos relevantes.

Los DTO de request deben reflejar el `ValidationPipe` global con whitelist y rechazo de propiedades desconocidas. Representar `additionalProperties: false` en los schemas de request donde OpenAPI lo permita sin falsificar objetos deliberadamente dinámicos.

### Responses

Cada operación debe documentar:

- status exitoso real;
- media type real;
- schema completo;
- descripción no vacía;
- ejemplo para flujos relevantes;
- headers contractuales cuando existan.

Una response JSON no puede quedar sólo con `description`. Las respuestas CSV, HTML y SSE deben declarar su media type en lugar de simular JSON.

### Errores

Documentar únicamente errores realmente alcanzables:

- `400` para validación y reglas de entrada;
- `401` en operaciones con bearer;
- `403` cuando existan restricciones de rol, permiso u ownership;
- `404` cuando el recurso consultado pueda no existir;
- `409` para conflictos de estado, concurrencia o idempotencia;
- `503` cuando un proveedor requerido pueda no estar disponible.

Por cada operación, documentar exhaustivamente los status de error y los códigos de dominio externamente visibles que sean alcanzables desde su flujo. Usar un ejemplo de payload representativo por status; los ejemplos pueden ser representativos, pero la lista de status y códigos no debe omitir casos estables conocidos.

Reutilizar un catálogo o decorador compartido cuando varias operaciones tengan exactamente los mismos códigos. Evitar copiar listas extensas cuando un `$ref` o una descripción compartida mantenga la misma información con una sola fuente de verdad.

## Brechas que deben corregirse

### Schemas vacíos

Los siguientes 27 schemas están vacíos en la línea base y deben quedar completos:

- `UpdateNotificationPreferenceDto`
- `RegisterDeviceDto`
- `UpdateAuditPolicyDto`
- `StartWorkerShiftDto`
- `SyncWorkerShiftDto`
- `CloseWorkerShiftDto`
- `AuthorizeWorkerDeviceDto`
- `UpdateClubOperationalProfileDto`
- `UpdateCapacitySettingsDto`
- `RegisterCapacityExitDto`
- `CorrectCapacityDto`
- `UpsertFinancialProfileDto`
- `CreateWithdrawalDto`
- `ReviewWithdrawalDto`
- `PayWithdrawalDto`
- `FailWithdrawalDto`
- `CheckoutDto`
- `AddCartItemDto`
- `UpdateCartItemDto`
- `WalletTopUpDto`
- `RequestRefundDto`
- `SimulatePaymentDto`
- `ValidateCodeDto`
- `ReverseRedemptionDto`
- `AssociateReferralDto`
- `TransferCreditDto`
- `UpdateReferralSettingsDto`

Revisar también `UpdateClubWorkerDto`, actualmente parcial: deben aparecer `assignedDoor`, `assignedZone` y `assignedPoint` además de los campos ya visibles.

### Queries omitidas

Seis operaciones pierden 35 parámetros en total:

| Operación o grupo | Parámetros esperados |
|---|---|
| Usuarios de plataforma | `query`, `role`, `status`, `page`, `pageSize` |
| Auditoría | `clubId`, `actorUserId`, `action`, `resourceType`, `resourceId`, `severity`, `correlationId`, `from`, `to`, `page`, `pageSize` |
| Órdenes de club | `from`, `to`, `eventId`, `productId`, `status`, `search` |
| Exportación de órdenes | `from`, `to`, `eventId`, `productId`, `status`, `search` |
| Notificaciones | `unreadOnly`, `category`, `readStatus` |
| Referidos administrativos | `status`, `search`, `page`, `pageSize` |

Comprobar defaults y transformaciones reales. En particular, verificar el comportamiento de strings booleanos como `unreadOnly=false` antes de describirlo.

### Seguridad

La matriz esperada tiene 134 operaciones bearer y 14 operaciones sin access token.

Corregir las 41 operaciones protegidas que hoy carecen de seguridad OpenAPI:

- Audit: 4
- Capacity: 6
- Commerce: 24
- Notification: 7

Corregir el caso inverso de `POST /auth/logout`: utiliza refresh token en el body y no `AccessTokenGuard`, por lo que no debe publicar un requisito bearer inexistente.

Mantener una allowlist explícita y revisable de operaciones sin access token:

- Health: 1
- Auth: 8, incluyendo logout por refresh token
- Events públicos: 2
- Flow callbacks/return: 3

El total y la lista deben comprobarse sobre el JSON final. Si el código contradice esta matriz, resolverlo desde los guards actuales y registrar la razón en el informe final; no cambiar los guards.

### Paginación y listados acotados

Documentar separadamente estas respuestas paginadas:

- usuarios de plataforma: `message`, `users`, `pagination`;
- auditoría: `items`, `pagination`;
- referidos: `items`, `summary`, `pagination`.

El objeto pagination actual contiene:

- `page`;
- `pageSize`;
- `total`;
- `totalPages`.

No presentar como paginados los listados que sólo tienen un límite interno, como notificaciones, historial de capacidad o retiros. Documentar su límite si es parte estable del comportamiento.

### Uploads

Documentar el flujo real completo:

1. solicitar URL firmada;
2. hacer `PUT` directamente a S3 usando el `Content-Type` indicado;
3. confirmar mediante `POST /uploads/{uploadId}/confirm`.

Contrato actual que debe reflejar Swagger:

- tipos permitidos: JPEG, PNG y WebP;
- máximo: 10 MB;
- duración de URL firmada: 300 segundos;
- NestJS no recibe el binario;
- la respuesta real usa `objectKey` y los demás campos devueltos por el servicio actual.

No copiar el contrato obsoleto de `docs/10-rest-api.md`, que menciona 5 MB y campos diferentes.

### Formatos especiales

Documentar explícitamente:

| Operación | Contrato especial |
|---|---|
| Exportación de órdenes | `text/csv`, `Content-Disposition` |
| Stream de capacidad | `text/event-stream` |
| Flow return GET/POST | `text/html`, `Cache-Control` |
| Flow confirmation | body form-urlencoded con `token` |
| Flow return POST | body form-urlencoded con `token` opcional según runtime |
| Media redirect | excluido mediante allowlist |

Los dos bodies Flow que faltan en la línea base deben aparecer en OpenAPI. Después de corregirlos deben existir 60 operaciones con body documentado.

## Matriz de implementación por dominio

Cada fila es un checkpoint completo. No dejar un dominio con bodies corregidos pero responses o seguridad pendientes.

| Orden | Dominio | Operaciones | Trabajo mínimo |
|---:|---|---:|---|
| 1 | Infraestructura OpenAPI | — | configuración, plugin, generación e inventario inicial |
| 2 | Health y Auth | 10 | referencia editorial, tokens, usuario, errores de sesión y logout |
| 3 | Commerce y Flow | 27 | carrito, checkout, pagos, órdenes, QR, CSV, HTML y form body |
| 4 | Wallets | 13 | saldos, conciliación, perfiles financieros, top-ups y retiros |
| 5 | Uploads y Users | 4 | flujo S3, confirmación, búsqueda y perfil |
| 6 | Platform y Audit | 12 | filtros, paginación, roles, settings y error schemas |
| 7 | Events y Capacity | 17 | eventos públicos/privados, estados, aforo y SSE |
| 8 | Notification y Referrals | 14 | preferencias, devices, filtros, settings y transferencias |
| 9 | Clubs y Workers | 25 | perfil estructurado, operación, permisos, turnos y devices |
| 10 | Tickets, Products y Promotions | 26 | catálogos, estados, inventario, items y enums |
| 11 | Barrido final | 148 | paridad, consistencia editorial, lint y métricas |

## Fases de ejecución

### Fase 0 — Preservar la línea base

Acciones:

1. Generar el documento local actual sin cambiar el comportamiento.
2. Normalizarlo para análisis determinista.
3. Confirmar 148 operaciones visibles y la exclusión de media.
4. Crear un inventario de método, path, operation ID, tag y seguridad.
5. Registrar las métricas iniciales en el informe de progreso.

Criterio de salida:

- el agente puede generar el OpenAPI localmente;
- el inventario local contiene exactamente 148 operaciones;
- la única exclusión aceptada está en una allowlist explícita;
- la línea base queda guardada como referencia de trabajo sin convertirla en un snapshot de prueba versionado.

### Fase 1 — Preparar metadata y generación

Acciones:

1. Activar el plugin Swagger para el build.
2. Confirmar que el build generado contiene la metadata esperada.
3. Preparar la forma mínima de obtener `/api/docs-json` localmente.
4. Evitar duplicar la configuración Swagger sólo para realizar la revisión.
5. Confirmar inventario, unicidad y preservación exacta del mapa inicial de operation IDs.

Criterio de salida:

- el JSON revisado proviene de la configuración documental usada por la aplicación;
- el build contiene la metadata aportada por el plugin;
- existe un procedimiento reproducible para generar el documento;
- no se ha modificado ninguna respuesta o regla runtime.

### Fase 2 — Crear contratos compartidos

Acciones:

1. Definir modelos de error y detalle de validación.
2. Definir piezas comunes de paginación sin forzar wrappers iguales.
3. Crear decoradores pequeños para parámetros y errores recurrentes.
4. Definir tags y convención editorial global.
5. Aplicar y revisar los helpers sobre Health y Auth como referencia.

Criterio de salida:

- Health y Auth cumplen todas las reglas finales;
- los helpers producen schemas con `$ref` válidos;
- ningún helper agrega errores o seguridad falsos;
- el patrón puede copiarse a los demás dominios sin duplicar schemas manuales.

### Fase 3 — Corregir requests, queries y seguridad

Acciones:

1. Completar los 27 schemas vacíos.
2. Completar el DTO parcial de workers.
3. Exponer los 35 parámetros query omitidos.
4. Documentar los dos cuerpos de Flow ausentes.
5. Corregir las 42 discrepancias de seguridad.
6. Completar formatos, enums, defaults y restricciones.

Criterio de salida:

- existen 60 operaciones con body documentado;
- ningún request schema referenciado está vacío;
- todas las queries aceptadas aparecen en OpenAPI;
- hay exactamente 134 operaciones bearer y 14 sin access token;
- ejemplos y restricciones coinciden con validación runtime.

### Fase 4 — Tipar responses y errores por dominio

Acciones:

1. Seguir el orden de la matriz de implementación.
2. Inspeccionar el servicio, sus helpers y sus adaptadores antes de crear cada response DTO.
3. Añadir status, media type, schema, descripción y ejemplos relevantes.
4. Añadir sólo errores alcanzables por la operación.
5. Comprobar que ninguna clase documental altera serialización.

Criterio de salida de cada dominio:

- todas sus operaciones tienen éxito tipado;
- ninguna response documentada contradice el runtime;
- errores, seguridad, roles y ownership están descritos;
- summaries y descriptions cumplen la convención;
- el fragmento generado para ese dominio cumple los criterios documentales.

Criterio de salida de la fase:

- las 148 operaciones tienen al menos una response exitosa completamente tipada;
- todas las declaraciones de response tienen descripción no vacía;
- los errores comunes usan componentes reutilizables;
- los modelos de response coinciden fielmente con el runtime y no inventan campos internos;
- si el runtime ya expone un campo sensible o interno, el schema no lo oculta silenciosamente: usa ejemplos ficticios o redactados y registra un hallazgo funcional/de seguridad fuera de alcance.

### Fase 5 — Corregir protocolos especiales

Acciones:

1. Documentar CSV y headers de descarga.
2. Documentar SSE.
3. Documentar HTML de retorno Flow.
4. Documentar form-urlencoded de Flow.
5. Contrastar el contrato de uploads con controladores y servicio, y revisar su representación en el JSON.
6. Confirmar la exclusión del redirect de media.

Criterio de salida:

- cada operación especial publica el media type real;
- ninguna de ellas publica falsamente `application/json` como única respuesta;
- headers y cuerpos contractuales aparecen en el JSON;
- la allowlist de media sigue siendo la única exclusión.

### Fase 6 — Auditar el documento generado

Generar el JSON final y revisarlo directamente. Se pueden usar comandos de análisis desechables para contar operaciones, recorrer schemas o localizar campos ausentes, pero no convertirlos en una suite de pruebas ni añadir infraestructura de testing al repositorio.

Lista de revisión bloqueante:

1. exactamente 148 operaciones, salvo cambio de rutas autorizado fuera de este objetivo;
2. operation IDs presentes, únicos e idénticos a la línea base;
3. un tag explícito, summary y description por operación;
4. cero schemas de request vacíos;
5. cero `$ref` sin resolver;
6. todas las queries y paths con tipo y descripción;
7. toda response exitosa con schema o contrato de media no JSON explícito;
8. toda response con descripción;
9. seguridad igual a la allowlist pública;
10. `401` para bearer y `403` donde existan restricciones reales;
11. media types especiales correctos;
12. ejemplos compatibles con el schema cuando sea técnicamente viable;
13. enums, defaults y constraints principales representados;
14. request schemas cerrados de acuerdo con whitelist, salvo excepciones justificadas;
15. media redirect como única operación excluida.

Criterio de salida:

- cada punto queda confirmado sobre el JSON final y resumido mediante métricas;
- cualquier diferencia frente al inventario inicial está explicada;
- no se esconden faltantes mediante listas de excepciones amplias;
- no se añadieron pruebas, snapshots ni controles de CI.

### Fase 7 — Barrido y cierre

Acciones:

1. Ejecutar todos los comandos de verificación.
2. Regenerar métricas finales.
3. Revisar manualmente el JSON como estructura, sin comprobación UI interactiva.
4. Confirmar que el diff sólo contiene documentación y la configuración mínima para generarla.
5. Preparar informe final con archivos, decisiones, comandos y cualquier bloqueo.

Criterio de salida:

- se cumple por completo la Definition of Done;
- no quedan cambios funcionales o no relacionados;
- el informe final permite comparar la línea base con el resultado.

## Estrategia de verificación documental

### Revisión principal: documento generado

La unidad principal de revisión es el `OpenAPIObject` producido por la configuración usada en runtime.

Revisar:

- paths y métodos;
- operation IDs;
- tags y textos;
- parámetros;
- request bodies;
- security;
- responses y content types;
- components y referencias;
- ejemplos y restricciones principales.

### Revisión estructural

Parsear el JSON generado y recorrer su estructura con herramientas ya disponibles o comandos temporales de sólo lectura. No añadir un framework, una dependencia o un linter dedicado únicamente para esta tarea.

La revisión debe detectar:

- JSON no parseable o ausencia de campos obligatorios de OpenAPI 3.0;
- `$ref` roto;
- schemas vacíos;
- tipos o media types ausentes;
- operation IDs duplicados;
- contradicciones de seguridad conocidas.

### Comparación con el código

Para los puntos que el JSON no puede demostrar por sí solo, comparar directamente con controladores, DTOs, guards, servicios, helpers y adaptadores. No ejecutar solicitudes HTTP para inferir el contrato. Si el código no permite determinar una forma con certeza, registrar la ambigüedad siguiendo la condición de parada.

## Generación local

Debe quedar documentado un procedimiento reproducible para obtener el JSON OpenAPI local. No es obligatorio añadir un script permanente a `package.json`; si se añade uno por necesidad operativa, su única responsabilidad será generar el documento y tendrá un nombre sencillo como `docs:generate`.

No versionar el JSON generado salvo que el repositorio ya siga esa práctica o exista una necesidad documental concreta. No añadir comandos de comprobación, suites, snapshots, dependencias de testing ni pasos de CI.

## Verificación final

Ejecutar, como mínimo:

```text
pnpm lint
pnpm build
```

Después del build:

1. generar el JSON OpenAPI local mediante el procedimiento definido;
2. parsearlo y completar la lista de revisión de la Fase 6;
3. comparar las métricas finales con la línea base;
4. inspeccionar el diff para confirmar que no existen cambios funcionales.

El JSON desplegado puede estar en otra revisión. Usarlo sólo como comparación informativa al final, nunca como condición de éxito del trabajo local.

## Definition of Done

### Inventario

- [ ] El documento contiene exactamente las 148 operaciones actuales.
- [ ] No existen rutas sobrantes ni faltantes.
- [ ] `GET /api/v1/media/*path` es la única exclusión y está en una allowlist explícita.
- [ ] Todos los operation IDs están presentes, son únicos y conservan exactamente el mapa de la línea base.

### Operaciones

- [ ] Las 148 operaciones tienen tag explícito.
- [ ] Las 148 operaciones tienen summary conforme a la convención.
- [ ] Las 148 operaciones tienen description suficiente.
- [ ] La documentación de acceso distingue público, bearer, roles, permisos y ownership.

### Requests

- [ ] Las 60 operaciones con body tienen request body visible y correcto.
- [ ] No queda ningún schema de request vacío.
- [ ] `UpdateClubWorkerDto` contiene todos sus campos aceptados.
- [ ] Los 35 parámetros query omitidos están documentados.
- [ ] Todo parámetro path y query tiene descripción, tipo, required/default y ejemplo aplicables.
- [ ] UUID, fechas, emails, URLs, enums, importes y límites tienen metadata machine-readable.
- [ ] Los schemas de request reflejan el rechazo de propiedades desconocidas, con excepciones justificadas.

### Seguridad completada

- [ ] Las 134 operaciones protegidas declaran bearer.
- [ ] Las 14 operaciones sin access token no declaran bearer.
- [ ] Logout se documenta mediante refresh token, sin requisito bearer inexistente.
- [ ] Las operaciones bearer documentan `401`.
- [ ] Las restricciones reales de rol, permiso u ownership documentan `403`.

### Responses completadas

- [ ] Las 148 operaciones tienen una response exitosa con status real.
- [ ] Todas las responses tienen descripción no vacía.
- [ ] Todas las responses JSON tienen `content` y schema.
- [ ] CSV, HTML y SSE publican su media type real.
- [ ] Los headers contractuales aparecen donde corresponden.
- [ ] Las respuestas paginadas reflejan sus tres formas reales.
- [ ] Los modelos coinciden con el runtime y no contienen valores secretos en ejemplos.
- [ ] Todo campo sensible o interno que ya exponga el runtime está reflejado sin valores reales y registrado como hallazgo fuera de alcance; no se ocultó para hacer parecer seguro el contrato.

### Errores completados

- [ ] Existe un schema reutilizable del error API real.
- [ ] Existe un schema del detalle de validación.
- [ ] Los errores documentados son alcanzables y usan status/códigos reales.
- [ ] No se presenta el envelope de éxito aspiracional como contrato actual.

### Casos especiales

- [ ] Flow confirmation y return POST documentan sus bodies form-urlencoded.
- [ ] Flow return documenta HTML y headers de caché.
- [ ] Capacity stream documenta SSE.
- [ ] Orders export documenta CSV y descarga.
- [ ] Uploads documenta S3 directo, confirmación, MIME, 10 MB y 300 segundos.

### Verificación documental

- [ ] El JSON revisado proviene de la configuración Swagger usada por la aplicación.
- [ ] El plugin Swagger se aplica al build y su metadata aparece en el documento generado.
- [ ] Existe un procedimiento reproducible para generar el documento local.
- [ ] La lista de revisión de la Fase 6 fue completada sobre el JSON final.
- [ ] `pnpm lint` y `pnpm build` pasan, salvo limitaciones informadas del entorno.
- [ ] No se añadieron ni modificaron pruebas, snapshots, dependencias de testing o controles de CI.

### Alcance

- [ ] El diff no cambia comportamiento de negocio ni contrato HTTP runtime.
- [ ] No hay cambios en Prisma, migraciones o servicios ajenos a documentación.
- [ ] No se incluyeron cambios visuales o pruebas interactivas de Swagger UI.
- [ ] El informe final incluye métricas antes/después, archivos y verificaciones.

## Formato del informe final del objetivo

El agente debe entregar:

1. resumen de lo implementado;
2. tabla antes/después con las métricas de la línea base;
3. lista de archivos añadidos o modificados por área;
4. comandos ejecutados y resultado;
5. decisiones de modelado relevantes;
6. diferencias entre código local y JSON desplegado, si aún existen;
7. comprobaciones documentales no realizadas y motivo, si las hubiera;
8. hallazgos funcionales fuera de alcance y bloqueos documentales reales, distinguidos explícitamente;
9. confirmación explícita de que no se realizó comprobación UI interactiva.

## Registro breve de checkpoints

El agente puede actualizar únicamente esta sección durante la ejecución:

- [x] Fase 0 — Línea base (148 operaciones, 124 paths y 148 operation IDs únicos preservados en inventario temporal no versionado)
- [x] Fase 1 — Metadata y generación (plugin activo; `pnpm docs:generate` produce `dist/openapi.json` desde la configuración runtime y preserva los 148 operation IDs)
- [x] Fase 2 — Contratos compartidos (errores, validación, paginación, tags y referencia Health/Auth)
- [x] Fase 3 — Requests, queries y seguridad (60 bodies, 35 queries recuperadas y matriz 134/14)
- [x] Fase 4 — Responses y errores (148 schemas nominales inferidos del runtime y catálogo de códigos alcanzables)
- [x] Fase 5 — Protocolos especiales (CSV, SSE, HTML, form-urlencoded y flujo S3)
- [x] Fase 6 — Auditoría del JSON generado (cero refs rotos, schemas vacíos, metadata o contratos exitosos faltantes)
- [x] Fase 7 — Barrido y cierre (build y generación reproducible correctos; auditoría recursiva y doble revisión sin bloqueantes; lint limitado por ESLint 10 con configuración legacy)
