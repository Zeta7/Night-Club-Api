# Plan mínimo de documentación OpenAPI para el SDK Dart

## Estado

- Repositorio: `Zeta7/Night-Club-Api`.
- Revisión: 2026-08-31.
- Alcance: documentación Swagger/OpenAPI únicamente.
- Consumidor inicial: `Night-Club-Mobile` mediante OpenAPI Generator `dart-dio`.

## 1. La idea en palabras simples

El backend ya decide cómo funciona la API. Este trabajo no cambia esa API.

El objetivo es que `/api/docs-json` describa fielmente lo que el backend ya
recibe y devuelve. Flutter podrá generar desde ese documento métodos, requests y
responses tipados sin copiar contratos a mano.

    Backend real -> OpenAPI fiel -> SDK Dart generado -> repositories Flutter

OpenAPI es una descripción del backend, no una razón para modificarlo.

## 2. Regla absoluta de alcance

La implementación y el comportamiento observable de `Night-Club-Api` son la
fuente de verdad. Ante una diferencia, se corrige la documentación.

### Permitido

- configuración de Swagger/OpenAPI;
- scripts que generan o validan el documento;
- schemas y overrides usados exclusivamente para documentación;
- decoradores de `@nestjs/swagger` que no cambian el runtime;
- ejemplos, descripciones, tags, seguridad y media types documentados;
- publicación y verificación de `/api/docs-json`.

### Prohibido

- cambiar rutas, métodos HTTP, status codes o headers reales;
- cambiar request bodies o response payloads;
- modificar validación, transformación o serialización;
- modificar cuerpos o comportamiento de controllers, services, application,
  domain, Prisma o migrations;
- cambiar autenticación, autorización o RBAC;
- añadir discriminadores o campos que el runtime no emite;
- “arreglar” una operación para satisfacer al generador Dart.

Si un contrato real no puede describirse de forma fiel y compatible con el
generador, se registra el bloqueo. Resolverlo funcionalmente pertenece a otra
iniciativa y no queda autorizado por este plan.

## 3. Contraste con el backend real

### 3.1 GitHub y checkout local

La revisión mediante el plugin de GitHub encontró:

- `main` remoto: commit `c96373782a85ca22e70f976dcbedb5fc680f2f96`;
- ese merge contiene el árbol
  `68f4780a7cb8f10b7f6e071fda063cd051373935`;
- el checkout local auditado está en `fbb7dc598d7ca4b52865c11a8eaa50ca6f9bdfec`;
- su árbol es exactamente el mismo `68f4780...`.

Por tanto, el código local auditado representa el `main` remoto actual, aunque
las referencias `origin/*` del checkout local estén desactualizadas.

La infraestructura documental ya existe:

| Responsabilidad | Archivo real |
|---|---|
| Plugin Swagger de Nest | `nest-cli.json` |
| Generación del JSON | `src/generate-openapi.ts` |
| Construcción y publicación | `src/shared/presentation/openapi/openapi.document.ts` |
| Normalización del documento | `src/shared/presentation/openapi/openapi.enhancer.ts` |
| Inferencia de responses | `scripts/generate-openapi-response-schemas.cjs` |
| Schemas generados | `src/shared/presentation/openapi/openapi.response-schemas.ts` |
| Comandos actuales | `docs:schemas` y `docs:generate` en `package.json` |

No se creará un segundo sistema documental paralelo. El plugin existente se
reutiliza y sólo se modifica si un gate demuestra que es necesario.

### 3.2 Estado observado

El documento desplegado fue comprobado nuevamente el 2026-08-31:

| Métrica | `/api/docs-json` desplegado |
|---|---:|
| Paths | 124 |
| Operaciones | 148 |
| Schemas | 212 |
| `servers` | 0 |
| Schemas request cerrados y vacíos | 27 |
| Operaciones afectadas por esos requests | 30 |

Todos los paths desplegados empiezan con `/api/v1/`.

Además existe `GET /api/v1/media/*path`, un passthrough wildcard excluido de
Swagger mediante `@ApiExcludeController` y registrado en
`OPENAPI_EXCLUDED_OPERATION_ALLOWLIST`. El SDK cubre las 148 operaciones
publicadas; este único caso permanece como exclusión documental explícita porque
no es una operación REST convencional.

El `dist/openapi.json` generado localmente desde el código auditado conserva
124 paths, 148 operaciones y 212 schemas, pero no contiene los 27 request
schemas vacíos. La primera hipótesis a comprobar es una publicación documental
obsoleta o un build no reproducible; no se añadirán decoradores a 27 DTOs sin
comprobar esto primero.

El documento local todavía contiene responses degradadas a `JsonValue` y
composiciones ambiguas producidas por el generador documental. Esas formas son
válidas como aproximación genérica, pero `dart-dio` no puede convertir algunas
de ellas en modelos Dart compilables.

## 4. Resultado esperado

Al finalizar habrá:

1. un comando reproducible para construir el OpenAPI desde cero;
2. un comando que valide el contrato documental sin ejecutar operaciones de
   negocio;
3. un `/api/docs-json` que describa las 148 operaciones publicadas y declare la
   única exclusión wildcard conocida;
4. requests, parámetros, seguridad y responses fieles al runtime existente;
5. una snapshot que genere y compile el SDK `dart-dio` completo;
6. evidencia de que el diff backend fue exclusivamente documental.

## 5. Decisiones mínimas

### 5.1 Conservar la infraestructura actual

Se reutilizan el plugin, el generador y el enhancer existentes. No se introduce
otro framework, una capa de mappers ni una arquitectura nueva de response DTOs.

Cuando la inferencia automática sea suficiente, se conserva. Cuando no lo sea,
se añade el override documental más pequeño posible en la capa OpenAPI actual.

### 5.2 URL canónica

El documento representará el runtime así:

```yaml
servers:
  - url: /api/v1
paths:
  /auth/login:
  /clubs/{clubId}:
```

Para lograrlo, la generación documental ignorará el global prefix al construir
`paths`. El runtime mantiene `app.setGlobalPrefix('api/v1')` sin cambios.

Esto evita que cada consumidor tenga que reescribir paths o arriesgar una URL
con `/api/v1` duplicado.

### 5.3 Schemas fieles, no artificialmente estrictos

- Una estructura estable se documenta como objeto o array con sus campos
  reales, required, nullability, formatos y enums reales.
- Un objeto/mapa verdaderamente abierto se documenta como `object` con
  `additionalProperties`; no se inventa un DTO cerrado.
- Si el runtime permite también arrays, escalares o distintas formas JSON, el
  schema conserva exactamente esas posibilidades. Si `dart-dio` no puede
  consumirlas, se aplica el bloqueo de alcance; nunca se estrecha a mapa.
- `oneOf` se usa sólo si las variantes reales ya pueden distinguirse.
- Si las variantes reales se solapan, se documenta un schema común o un objeto
  abierto fiel. No se cambia el payload para crear un discriminator.
- `JsonValue` no se usa como response raíz cuando el runtime sí tiene una forma
  conocida.

### 5.4 Contrato completo

El gate cubre las 148 operaciones publicadas y verifica la exclusión wildcard,
no únicamente las 96 consumidas hoy por Flutter. El inventario se deriva del
JSON; no se mantendrá una segunda lista manual de 148 filas.

### 5.5 Dos comandos para el mantenedor

La implementación expondrá sólo:

```powershell
pnpm docs:build
pnpm docs:check
```

- `docs:build`: define una `DATABASE_URL` local ficticia sólo para el proceso si
  falta, ejecuta `prisma:generate`, limpia metadata incremental, regenera
  schemas, compila y produce `dist/openapi.json`.
- `docs:check`: ejecuta la misma cadena en modo verificación, falla si
  `openapi.response-schemas.ts` está desactualizado y valida estructura,
  referencias y reglas de este plan sin reescribir archivos versionados.

Los pasos internos quedan encapsulados; el desarrollador no debe recordar una
secuencia larga.

## 6. Archivos autorizados

El diff de implementación se limita a:

- `docs/**`;
- `nest-cli.json`;
- scripts `docs:*` de `package.json`;
- `scripts/*openapi*`;
- `src/generate-openapi.ts`;
- `src/shared/presentation/openapi/**`;
- imports y decoradores de `@nestjs/swagger` en controllers o DTOs, únicamente
  si la metadata no puede expresarse en la capa OpenAPI compartida.

No se modifica ninguna propiedad, validador, transform, cuerpo de controller,
service, repository, schema Prisma o migration.

## 7. Plan de ejecución

### Fase 0 — Fijar la línea base

1. Confirmar branch, commit y estado de trabajo.
2. Preservar cambios ajenos.
3. Descargar `/api/docs-json` y guardar hash y métricas.
4. Generar el artefacto local desde cero y guardar las mismas métricas.
5. Derivar automáticamente el inventario de operationIds y schemas.
6. Verificar que `GET /api/v1/media/*path` es la única exclusión allowlisted.
7. Identificar el owner, comando y artefacto del mecanismo externo que publica
   la documentación.

Cierre:

- las 148 operaciones tienen operationId único;
- la exclusión wildcard está justificada y no oculta otras operaciones;
- el drift local/desplegado está medido;
- ninguna acción de esta fase cambia runtime.

El repositorio no versiona actualmente Dockerfile, workflow, buildspec ni otra
definición de despliegue. Si no se obtiene acceso al mecanismo externo, puede
aceptarse el artefacto local, pero no se declara verificado el deploy ni se
actualiza Mobile desde la URL live.

### Fase 1 — Hacer reproducible la documentación

1. Crear `docs:build` con este orden interno:
   - definir una URL PostgreSQL local ficticia y no sensible únicamente cuando
     falte `DATABASE_URL`, sin escribir `.env` ni abrir una conexión;
   - `prisma:generate`;
   - `tsc -b tsconfig.build.json --clean`;
   - `docs:schemas`;
   - `build`;
   - `docs:generate`.
2. Conservar `docs:schemas` y `docs:generate` como pasos internos.
3. Añadir a `docs:schemas` un modo `--check` que compare y falle sin reescribir
   `openapi.response-schemas.ts`.
4. Crear `docs:check` con esa cadena y una validación pequeña del JSON generado.
5. Ejecutar el proceso dos veces durante la implementación y confirmar que el
   segundo resultado no cambia.
6. Volver a medir los 27 schemas vacíos en el artefacto local. Si desaparecen,
   tratar el problema desplegado como drift documental y publicar una sola vez
   en la Fase 4.

Sólo si un schema continúa vacío después del build limpio se añadirá metadata
Swagger explícita. No se tocarán validadores ni transforms.

Cierre:

- una sola orden produce el documento completo;
- 0 referencias rotas;
- 0 request bodies accidentalmente vacíos;
- resultado determinista.

### Fase 2 — Alinear metadata con el runtime existente

1. Publicar `servers: /api/v1` y paths sin el global prefix.
2. Documentar todos los parámetros que ya aceptan los controllers y query DTOs.
3. Corregir required, tipos, enums, formatos y defaults sólo en Swagger.
4. Verificar seguridad pública/protegida contra guards y decorators reales.
5. Verificar media types especiales: JSON, CSV, SSE, HTML,
   `application/x-www-form-urlencoded` y uploads.
6. Actualizar allowlists documentales que dependan del path canónico.

Si aparece un problema funcional durante la auditoría, se registra fuera de este
plan y no se corrige aquí.

Cierre:

- OpenAPI describe lo que el backend ya acepta y entrega;
- `/api/v1` se compone exactamente una vez;
- no hay cambio funcional en el diff.

### Fase 3 — Hacer los schemas consumibles por Dart

1. Derivar la lista de responses que alcanzan `JsonValue`, `oneOf`, `anyOf` o
   aliases genéricos.
2. Contrastar cada caso con el tipo fuente y una respuesta representativa ya
   existente, sin ejecutar mutaciones.
3. Mejorar la inferencia documental cuando la estructura sea estable.
4. Añadir overrides OpenAPI sólo para los casos que la inferencia no resuelva.
5. Representar objetos abiertos como mapas y conservar arrays, escalares o
   unions cuando el runtime realmente los permite.
6. Mantener nombres de campos, required y nullability observados.

No se crean mappers de runtime ni se cambian retornos de services.

Cierre:

- ninguna response estable completa termina como `JsonValue`;
- no hay unions que `dart-dio` no pueda deserializar de forma inequívoca;
- cualquier JSON abierto conserva todas las formas admitidas por el runtime;
- los 148 contratos siguen presentes.

### Fase 4 — Gate, publicación y entrega a Mobile

1. Ejecutar `pnpm docs:check`.
2. Validar el JSON con OpenAPI Generator `7.25.0`, la configuración
   `dart-dio`/`built_value` fijada en el plan Mobile y la imagen Docker fijada por
   digest.
3. Generar las 148 operaciones con `dart-dio` sin filtros.
4. Ejecutar en el package temporal:
   - `dart pub get`;
   - `dart run build_runner build --delete-conflicting-outputs`;
   - `dart analyze`.
5. Deserializar fixtures sanitizados sólo para los schemas que antes eran
   dinámicos o ambiguos.
6. Revisar que el diff backend respete la lista de archivos autorizados.
7. Publicar la documentación sólo mediante el mecanismo externo identificado y
   con autoridad confirmada en la Fase 0.
8. Descargar nuevamente `/api/docs-json` y comparar estructura y hash con el
   artefacto aceptado.
9. Entregar esa snapshot a `Night-Club-Mobile`.

Cierre:

- SDK completo generado y analizado sin errores;
- documento desplegado y artefacto aceptado son equivalentes;
- 0 cambios de comportamiento backend.

Si el mecanismo externo no está disponible, el artefacto local puede quedar
aceptado, pero esta fase y el handoff live permanecen bloqueados.

## 8. Verificación sin sobreingeniería

### Obligatoria

- `pnpm docs:build`;
- `pnpm docs:check`;
- build/lint dirigido si los archivos TypeScript lo requieren;
- OpenAPI Generator validate;
- generación y análisis del package Dart;
- `git diff --check` y revisión de paths modificados.

### No necesaria para este alcance

- pruebas funcionales nuevas del backend;
- pruebas de services o repositories no modificados;
- ejecutar operaciones mutantes desde Swagger UI;
- una nueva plataforma CI;
- snapshots duplicadas fuera del artefacto aceptado.

Se añade una prueba nueva únicamente si una regla del validador documental no
puede comprobarse con `docs:check`.

## 9. Secuencia de commits recomendada

1. `chore(openapi): make documentation build reproducible`
2. `docs(openapi): align metadata with the existing API`
3. `docs(openapi): publish dart-compatible response schemas`

Los commits sólo contienen archivos autorizados. No hay commits `feat`, `fix` o
`refactor` de comportamiento.

## 10. Definition of Done

- [ ] El backend real continuó siendo la fuente de verdad.
- [ ] El diff es exclusivamente documental.
- [ ] Las 148 operaciones publicadas tienen operationId único.
- [ ] La única exclusión es `GET /api/v1/media/*path` y está documentada.
- [ ] Todos los request bodies reflejan sus DTOs y validadores actuales.
- [ ] Parámetros, seguridad y media types coinciden con el runtime.
- [ ] Paths y `servers` componen `/api/v1` una sola vez.
- [ ] Responses estables tienen schemas tipados.
- [ ] JSON realmente abierto conserva todas las formas admitidas por el runtime.
- [ ] OpenAPI Generator valida el documento.
- [ ] `dart-dio` genera el SDK completo y Dart lo analiza sin errores.
- [ ] `/api/docs-json` desplegado coincide con el artefacto aceptado.
- [ ] Mobile recibe una snapshot RAW verificada y sin edición manual.

## 11. Fuera de alcance

- corregir bugs funcionales descubiertos durante la auditoría;
- cambiar contratos reales para facilitar codegen;
- crear nuevas features o endpoints;
- modificar base de datos, auth o RBAC;
- integrar el SDK dentro de Flutter;
- automatizar CI o despliegue más allá del mecanismo documental existente.
