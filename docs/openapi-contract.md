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
