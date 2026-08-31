# Verificación OpenAPI para codegen Dart

## Estado

- Fecha: 2026-08-31.
- Alcance: documentación OpenAPI únicamente.
- Documento local aceptado: `dist/openapi.json`.
- SHA-256 local: `0CC9AA54E5397DD28875AD5B65E46784811ACAD0A0B9C2C038886F503D2B2282`.

## Contraste local y desplegado

| Métrica                           | Local aceptado | Desplegado antes de publicar |
| --------------------------------- | -------------: | ---------------------------: |
| Paths                             |            124 |                          124 |
| Operaciones                       |            148 |                          148 |
| `operationId` únicos              |            148 |                          148 |
| Schemas                           |            207 |                          212 |
| Request schemas cerrados y vacíos |              0 |                           27 |
| `servers`                         |      `/api/v1` |                      ausente |
| Paths con `/api/v1` embebido      |              0 |                          124 |

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
  schemas, cero referencias rotas, cero responses raíz `JsonValue` y cero unions
  raíz no consumibles.
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
- `dart run build_runner build --delete-conflicting-outputs`: correcto; 684
  outputs. La versión actual de `build_runner` avisa que ese flag ya fue retirado
  y lo ignora.
- `dart analyze`: cero errores, 46 warnings generados por las plantillas
  `dart-dio` (45 imports sin uso y un parámetro interno sin uso); por ello retorna
  código 1. `dart analyze --no-fatal-warnings` retorna código 0.
- Deserialización temporal de nueve fixtures sanitizados: correcta para los
  perfiles financieros, las cinco transiciones de retiro, la solicitud de retiro,
  el dashboard admin vacío y el carrito vacío.

Los warnings del analizador no se suprimieron modificando el package generado ni
estrechando el contrato. El código generado compila y no contiene errores de
análisis.

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
