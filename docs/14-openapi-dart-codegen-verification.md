# Verificación OpenAPI para codegen Dart

## Estado

- Fecha: 2026-09-01.
- Alcance: documentación OpenAPI únicamente.
- Documento local aceptado: `dist/openapi.json`.
- SHA-256 local: `672A581CCC10F9D7D3F2E927E2D0059E2099C740A3B11E403F33B0C54A1C5A2A`.

## Contraste local y desplegado

| Métrica                           | Local aceptado | Snapshot desplegada 2026-08-31 |
| --------------------------------- | -------------: | -----------------------------: |
| Paths                             |            124 |                            124 |
| Operaciones                       |            148 |                            148 |
| `operationId` únicos              |            148 |                            148 |
| Schemas                           |            207 |                            212 |
| Schemas JSON de respuesta         |            144 |                  no verificado |
| Request schemas cerrados y vacíos |              0 |                             27 |
| `servers`                         |      `/api/v1` |                        ausente |
| Paths con `/api/v1` embebido      |              0 |                            124 |

El documento desplegado medido tenía SHA-256
`A084C2209B6DAE2240EDF0058BD4AC40C8A63593DC827DB64679EC50BFF3C113`.
El drift confirma que el problema de los 27 requests vacíos pertenece al
artefacto desplegado y no al build limpio actual.

Los cinco schemas omitidos del documento final eran componentes sin referencias:
`Pagination` y las respuestas genéricas sustituidas por CSV, SSE o HTML para
Capacity, Commerce y Flow. Las 148 operaciones continúan presentes; el generador
mantiene 144 schemas JSON de respuesta y omite esos cuatro transportes no JSON en
su origen.

## Gates ejecutados

- `pnpm docs:build`: correcto.
- `pnpm docs:check`: correcto; 124 paths, 148 operaciones, 148 IDs únicos, 207
  schemas y cero referencias rotas. El gate cubre los 144 schemas JSON de
  respuesta, rechaza `JsonValue` fuera de la allowlist revisada o con nulabilidad
  distinta de la forma aceptada, exige que los objetos sean cerrados o mapas con
  valor tipado, rechaza marcadores internos y variantes `oneOf` que no sean
  demostrablemente disjuntas.
- El documento conserva ocho `oneOf` y cuatro `anyOf` en respuestas raíz. Entre
  ellos están las ramas reales de Dashboard, Customer Home, Admin Events,
  carrito y `simulatePayment`; `hasClub` y `hasResults` permanecen como booleanos
  literales por rama.
- El build TypeScript incluido en ambos comandos es correcto. El lint dirigido no
  inicia: la instalación resuelve ESLint 10.8.0, pero el repositorio conserva
  `.eslintrc.js` y no contiene el `eslint.config.*` requerido por esa versión.
- OpenAPI Generator `7.25.0`, imagen oficial fijada por digest
  `sha256:2ab0a9680222de65dc9d3baf861aa02b99e1b80c211d8221ebf3ae8f8a102524`:
  validación correcta, sin issues.
- Generación completa `dart-dio`/`built_value`: correcta, sin filtros de APIs.
  OpenAPI Generator emitió un warning `ModelUtils` al resolver el nombre de un
  schema inline, pero completó el package y no produjo errores de validación ni
  compilación.
- `dart pub get`: correcto.
- `dart run build_runner build`: correcto; 728 outputs.
- `dart analyze --no-fatal-warnings`: cero errores y 98 warnings generados por
  las plantillas `dart-dio`, principalmente imports sin uso en APIs y wrappers
  de uniones.
- Deserialización temporal de trece fixtures sanitizados: doce correctos. Pasan
  Notifications, Wallet, Referrals, Dashboard, Explore, detalle Customer,
  detalle de evento, Admin Events, carrito, `simulatePayment`, tickets y
  consumibles.
- El fixture vacío de Customer Home expone una limitación de OpenAPI Generator:
  el serializer `one_of` prueba ambas clases y no usa el literal
  `hasResults: false`/`true` para seleccionar una. El OpenAPI sí contiene las dos
  ramas disjuntas y el gate las comprueba; la adaptación determinista corresponde
  al pipeline Mobile y no autoriza estrechar el contrato Backend.

Los warnings y la ambigüedad de Customer Home no se ocultaron modificando el
package generado ni estrechando el contrato. El SDK completo genera, compila y no
contiene errores de análisis; Customer Home queda como incidencia explícita para
la fase Mobile posterior.

## Límites externos

El repositorio no contiene Dockerfile, workflow, buildspec ni otra definición del
mecanismo que publica `/api/docs-json`. No se publicó ni se modificó el documento
live. La equivalencia post-deploy y la entrega de una snapshot descargada desde
la URL live permanecen pendientes de ese owner externo.

## Hallazgo funcional fuera de alcance

`GET /wallets/withdrawals` usa actualmente relaciones Prisma completas para
`club` y `requestedBy`. La relación `requestedBy` incluye `passwordHash` en el
payload real. El schema documenta esa salida para no ocultar el contrato actual,
pero corregir la exposición requiere un cambio funcional separado: seleccionar
y serializar explícitamente sólo los campos públicos del usuario. Este trabajo no
modificó el servicio, autenticación, autorización ni RBAC.
