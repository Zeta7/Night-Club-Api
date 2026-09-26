# NightClub Platform Backend

API backend para NightClub Platform.

## Stack

- NestJS
- TypeScript
- PostgreSQL
- Prisma
- Redis
- BullMQ

## Modulos iniciales

Las primeras areas implementadas son `Identity` y `Notification`.

Identity incluye:

- Inicio de sesion con telefono y contrasena.
- Registro con telefono y contrasena.
- Codigo de confirmacion telefonica durante el registro.
- Correo opcional.
- Emision de `accessToken` y `refreshToken` con JWT.
- Rotacion de refresh token en `/auth/refresh`.
- Revocacion de sesion en `/auth/logout`.
- Recuperacion de contrasena con codigo telefonico.

Notification incluye:

- Puerto `PhoneMessageSender`.
- Servicio `NotificationService`.
- Implementacion de desarrollo `DevPhoneMessageSender`.
- Implementacion real `TwilioPhoneMessageSender`.

En desarrollo, el codigo de confirmacion se escribe en logs. Para enviar SMS reales con Twilio, configura:

```text
PHONE_MESSAGE_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_API_KEY=...
TWILIO_API_SECRET=...
TWILIO_PHONE_NUMBER=...
```

## Setup

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm prisma:migrate
pnpm start:dev
```

La ruta base de la API es:

```text
/api/v1
```

Swagger UI esta disponible en:

```text
/api/docs
```

## Contrato OpenAPI

Ejecuta `pnpm docs:build` para regenerar el contrato y `pnpm docs:check` para
comprobarlo. El despliegue exige este control y las pruebas de contrato.

En los DTOs, `@IsInteger()` valida y documenta enteros. `@OptionalField()`
permite omitir un campo; aceptar `null` requiere `nullable: true`, un tipo
Swagger explícito y `| null` en TypeScript. Las actualizaciones usan
`PartialType(CreateDto, { skipNullProperties: false })`: omitir conserva y
`null` borra sólo los campos anulables. Los objetos y listas enviados reemplazan
el valor completo de esa propiedad.

Las respuestas se infieren de los retornos TypeScript y de los tipos generados
por Prisma. No se mantienen schemas paralelos por endpoint ni se deducen tipos
por nombres de campos. La generación falla ante retornos con `any`, `unknown`
o listas vacías sin tipo. Los campos que sólo devuelven `null` deben declarar
su tipo completo. Los JSON abiertos se permiten únicamente en las rutas
revisadas por el control de contrato.

Los enteros de Prisma conservan su tipo; un número calculado que deba publicarse
como entero debe declararlo mediante `/** @integer */` en su propiedad de retorno.
Las variantes de objeto se publican como un modelo con campos opcionales para
las propiedades ausentes en alguna rama. `docs:check` valida además OpenAPI 3.0,
referencias, enums, nulabilidad y la correspondencia con los validadores de los DTOs.
