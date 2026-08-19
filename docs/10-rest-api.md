# API REST

# Convenciones

Version base:

```text
/api/v1
```

Formato de respuesta sugerido:

```json
{
  "data": {},
  "meta": {},
  "error": null
}
```

Formato de error sugerido:

```json
{
  "data": null,
  "meta": {},
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": []
  }
}
```

## Auth

### POST /auth/register

Registra un cliente usando numero de telefono y password. El correo es opcional.

Body sugerido:

```json
{
  "phoneCountryCode": "+51",
  "phoneNumber": "999999999",
  "password": "secret",
  "fullName": "Nombre Apellido",
  "email": "cliente@example.com"
}
```

Resultado:

- Crea el usuario en estado pendiente de confirmacion telefonica.
- Genera un codigo de confirmacion.
- Envia el codigo al telefono.

### POST /auth/confirm-phone

Confirma el numero de telefono con el codigo enviado durante el registro.

Body sugerido:

```json
{
  "phoneCountryCode": "+51",
  "phoneNumber": "999999999",
  "code": "123456"
}
```

### POST /auth/resend-phone-code

Reenvia el codigo de confirmacion telefonica respetando limites de seguridad.

### POST /auth/login

Inicia sesion usando numero de telefono y password.

Body sugerido:

```json
{
  "phoneCountryCode": "+51",
  "phoneNumber": "999999999",
  "password": "secret"
}
```

### POST /auth/refresh

Renueva access token.

Body sugerido:

```json
{
  "refreshToken": "..."
}
```

### POST /auth/logout

Cierra sesion o invalida refresh token.

Body sugerido:

```json
{
  "refreshToken": "..."
}
```

### GET /auth/me

Devuelve el usuario autenticado.

Regla de seguridad:

- Esta ruta siempre debe responder con el usuario del access token actual.
- Nunca debe aceptar un `userId` externo ni reutilizar datos de otra sesion cacheada.

### PATCH /users/me

Actualiza el perfil del usuario autenticado.

Body sugerido:

```json
{
  "fullName": "Edson Meza",
  "email": "admin@beerry.app",
  "imageUploadId": "uuid-del-upload"
}
```

Regla de seguridad:

- Solo puede editar el usuario autenticado de la sesion actual.
- Ningun cambio de perfil puede aplicarse sobre otro `userId`.

### POST /auth/password-reset/request

Solicita un codigo telefonico para recuperar contrasena.

Body sugerido:

```json
{
  "phoneCountryCode": "+51",
  "phoneNumber": "999999999"
}
```

### POST /auth/password-reset/confirm

Valida el codigo de recuperacion y establece una nueva contrasena.

Body sugerido:

```json
{
  "phoneCountryCode": "+51",
  "phoneNumber": "999999999",
  "code": "123456",
  "newPassword": "NuevaContrasena123"
}
```

## Platform

### GET /platform/dashboard

Dashboard global para Super Admin.

### PATCH /platform/settings

Actualiza configuracion global.

### PATCH /platform/users/{userId}/role

Cambia rol de usuario.

### PATCH /platform/users/{userId}/activate

Activa usuario.

### PATCH /platform/users/{userId}/deactivate

Desactiva usuario.

## Clubs

### POST /clubs

Crea un club. Roles permitidos: `ADMIN`, `SUPER_ADMIN`.

Request de Registrar Negocio. Este mismo contrato debe reutilizarse para editar el negocio desde mobile:

```json
{
  "coverImage": "",
  "profileImage": "",
  "name": "",
  "description": "",
  "type": "club",
  "address": {
    "direccion": "",
    "distrito": "",
    "provincia": "",
    "departamento": "",
    "pais": "Perú"
  },
  "contact": {
    "phone": "",
    "email": ""
  },
  "socialMedia": [
    {
      "type": "tiktok",
      "url": "https://tiktok.com/@edson"
    },
    {
      "type": "instagram",
      "url": "https://instagram.com/edson_joan"
    }
  ],
  "schedule": [
    {
      "day": "monday",
      "isOpen": false,
      "openTime": "22:00",
      "closeTime": "07:00"
    },
    {
      "day": "tuesday",
      "isOpen": false,
      "openTime": "22:00",
      "closeTime": "07:00"
    },
    {
      "day": "wednesday",
      "isOpen": false,
      "openTime": "22:00",
      "closeTime": "07:00"
    },
    {
      "day": "thursday",
      "isOpen": false,
      "openTime": "22:00",
      "closeTime": "07:00"
    },
    {
      "day": "friday",
      "isOpen": true,
      "openTime": "22:00",
      "closeTime": "07:00"
    },
    {
      "day": "saturday",
      "isOpen": true,
      "openTime": "22:00",
      "closeTime": "07:00"
    },
    {
      "day": "sunday",
      "isOpen": false,
      "openTime": "",
      "closeTime": ""
    }
  ]
}
```

Campos:

- `type`: `club`, `discoteca`, `karaoke`, `bar`, `restobar` o `lounge`.
- `socialMedia.type`: `tiktok`, `instagram`, `facebook` o `web`.
- `schedule`: debe representar los 7 dias (`monday` a `sunday`) para que la vista de edicion pueda hidratar el formulario completo.
- `openTime` y `closeTime`: formato `HH:mm`; pueden ir vacios cuando `isOpen=false`, como domingo en el ejemplo.
- `type` se guarda con el valor recibido. Si mobile envia `discoteca`, el club debe quedar como `discoteca`, no como `club`.
- El backend guarda direccion, contacto, redes y horario solo como perfil estructurado. No hay columnas directas de club para `slug`, `phone`, `email`, `address` ni `imageUrl`.

Respuesta: devuelve `club` con la misma estructura principal (`coverImage`, `profileImage`, `name`, `description`, `type`, `address`, `contact`, `socialMedia`, `schedule`) para que la pantalla pueda usarse tambien como edicion.

### GET /clubs

Lista clubes visibles segun rol.

### GET /clubs/{clubId}

Obtiene detalle de club.

### GET /clubs/customer/clubs/{clubId}

Obtiene para un cliente autenticado el detalle de un club activo sin aplicar el filtro
de su ubicacion actual. Devuelve el negocio junto con sus eventos, entradas,
promociones y productos visibles. Este endpoint se usa al abrir desde Explorar una
discoteca encontrada en cualquier ciudad del Peru.

### PATCH /clubs/{clubId}

Actualiza club. Usa el mismo contrato estructurado de `POST /clubs`; al editar desde mobile se recomienda enviar el formulario completo.

### PATCH /clubs/{clubId}/activate

Activa club.

### PATCH /clubs/{clubId}/deactivate

Desactiva club.

## Club Workers

### POST /clubs/{clubId}/workers

Registra trabajador.

Body sugerido:

```json
{
  "userId": "uuid",
  "roleLabel": "Barra 1",
  "permissions": ["VALIDATE_PRODUCTS"]
}
```

### GET /clubs/{clubId}/workers

Lista trabajadores.

### PATCH /clubs/{clubId}/workers/{workerId}

Actualiza trabajador.

Body sugerido:

```json
{
  "status": "ACTIVE",
  "roleLabel": "Portero"
}
```

### PUT /clubs/{clubId}/workers/{workerId}/permissions

Reemplaza permisos del trabajador.

## Users

### GET /users/search?query={texto}

Busca usuarios por nombre, telefono o email para seleccionarlos sin ingresar manualmente su ID.

Resultado:

- Devuelve hasta 10 usuarios coincidentes.
- ADMIN recibe usuarios activos para operaciones de club.
- SUPER_ADMIN puede buscar usuarios de la plataforma.

## Events

### POST /clubs/{clubId}/events

Crea evento.

### GET /clubs/{clubId}/events

Lista eventos del club.

### GET /events

Lista eventos publicos.

### GET /events/{eventId}

Obtiene detalle publico de evento.

### PATCH /clubs/{clubId}/events/{eventId}

Actualiza evento.

### PATCH /clubs/{clubId}/events/{eventId}/publish

Publica evento.

### PATCH /clubs/{clubId}/events/{eventId}/start-sale

Activa venta.

### PATCH /clubs/{clubId}/events/{eventId}/cancel

Cancela evento.

### PATCH /clubs/{clubId}/events/{eventId}/reactivate

Reactiva un evento cancelado y lo devuelve a estado publicado.

### PATCH /clubs/{clubId}/events/{eventId}/finish

Finaliza evento.

## Uploads

### POST /uploads/presigned-url

Genera una URL firmada temporal para subir una imagen directamente a S3.

Body sugerido:

```json
{
  "resourceType": "CLUB",
  "resourceId": "club-id",
  "fileName": "cover.png",
  "contentType": "image/png",
  "sizeBytes": 1048576
}
```

Resultado:

- Devuelve `uploadUrl` para subir con metodo PUT.
- Devuelve `publicUrl` para guardar luego en el campo de imagen correspondiente. En clubes se usa `coverImage` o `profileImage`; en eventos se usa `imageUrl`.
- Devuelve `key` del objeto en S3.
- Permite imagenes `image/jpeg`, `image/png` e `image/webp` de hasta 5 MB.

## Ticket Types

### POST /clubs/{clubId}/events/{eventId}/ticket-types

Crea tipo de entrada.

### GET /events/{eventId}/ticket-types

Lista tipos de entrada visibles para compra.

### PATCH /clubs/{clubId}/events/{eventId}/ticket-types/{ticketTypeId}

Actualiza tipo de entrada.

## Catalog

### POST /clubs/{clubId}/products

Crea producto.

### GET /clubs/{clubId}/products

Lista productos.

### PATCH /clubs/{clubId}/products/{productId}

Actualiza producto.

### POST /clubs/{clubId}/promotions

Crea promocion.

### GET /clubs/{clubId}/promotions

Lista promociones.

### PATCH /clubs/{clubId}/promotions/{promotionId}

Actualiza promocion.

## Cart

### GET /cart

Obtiene carrito activo del cliente.

### POST /cart/items

Agrega item al carrito.

### PATCH /cart/items/{cartItemId}

Actualiza cantidad.

### DELETE /cart/items/{cartItemId}

Elimina item.

### POST /cart/checkout

Crea orden pendiente desde el carrito.

## Orders

### GET /orders

Lista ordenes del usuario autenticado.

### GET /orders/{orderId}

Obtiene detalle de orden.

### POST /orders/{orderId}/pay

Crea intento de pago con Culqi.

## Payments

### POST /payments/culqi/webhook

Recibe eventos de Culqi.

### GET /payments/{paymentIntentId}

Consulta estado del intento de pago.

## Tickets and Wallet

### GET /me/tickets

Lista tickets del cliente.

### GET /me/consumables

Lista productos y promociones compradas.

### GET /me/wallet

Obtiene wallet del cliente.

### GET /me/wallet/movements

Lista movimientos de wallet del cliente.

## QR Validation

### POST /clubs/{clubId}/validate/ticket

Valida ticket por QR.

### POST /clubs/{clubId}/validate/product

Valida producto comprado.

### POST /clubs/{clubId}/validate/promotion

Valida promocion comprada.

Las respuestas de prevalidacion incluyen nombre, telefono y `attendeeImageUrl`
del comprador. La imagen se entrega como URL legible; si el usuario no tiene
foto, el cliente visual debe usar sus iniciales como respaldo.

## Capacity

### GET /clubs/{clubId}/events/{eventId}/capacity

Consulta aforo.

### PATCH /clubs/{clubId}/events/{eventId}/capacity

Actualiza configuracion de aforo.

## Wallet Club

### GET /clubs/{clubId}/wallet

Obtiene wallet del club.

### GET /clubs/{clubId}/wallet/movements

Lista movimientos del club.

### POST /clubs/{clubId}/withdrawals

Solicita retiro.

### GET /clubs/{clubId}/withdrawals

Lista retiros.

## Withdrawals Platform

### GET /platform/withdrawals

Lista solicitudes de retiro.

### PATCH /platform/withdrawals/{withdrawalId}/approve

Aprueba retiro.

### PATCH /platform/withdrawals/{withdrawalId}/reject

Rechaza retiro.

### PATCH /platform/withdrawals/{withdrawalId}/mark-paid

Marca retiro como pagado.

## Audit

### GET /audit-logs

Consulta logs segun permisos.

Filtros sugeridos:

- actorUserId.
- clubId.
- action.
- resourceType.
- resourceId.
- from.
- to.
