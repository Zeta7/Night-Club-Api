# Roles y Permisos

# Resumen

La plataforma tendra roles globales y permisos operativos por club. El objetivo es mantener roles simples en el MVP, pero permitir permisos mas granulares para trabajadores.

## Roles base

- SUPER_ADMIN.
- ADMIN.
- WORKER.
- CUSTOMER.

## Super Admin

Responsable de la plataforma.

Puede:

- Activar usuarios.
- Desactivar usuarios.
- Cambiar rol de Cliente a Administrador.
- Activar clubes.
- Desactivar clubes.
- Ver dashboard global.
- Configurar parametros globales.
- Revisar operaciones criticas.

No puede, como responsabilidad operativa normal:

- Administrar eventos de un club.
- Administrar productos de un club.
- Administrar promociones de un club.
- Operar como trabajador del club sin asignacion explicita.

## Administrador

Responsable de uno o varios clubes.

Puede:

- Crear club.
- Configurar club.
- Crear eventos.
- Editar eventos.
- Configurar aforo.
- Crear entradas.
- Crear productos.
- Crear promociones.
- Registrar trabajadores.
- Asignar permisos a trabajadores.
- Ver dashboard del club.
- Solicitar retiros.

Debe tener relacion explicita con el club que administra.

## Trabajador

Usuario operativo con permisos configurables por club.

Permisos sugeridos:

- VALIDATE_TICKETS.
- VALIDATE_PRODUCTS.
- VALIDATE_PROMOTIONS.
- VIEW_CAPACITY.
- MANAGE_CAPACITY.
- VIEW_DASHBOARD.
- VIEW_EVENT_ATTENDANCE.

Perfiles comunes:

- Portero: VALIDATE_TICKETS.
- Barra: VALIDATE_PRODUCTS, VALIDATE_PROMOTIONS.
- Supervisor: VIEW_DASHBOARD, VIEW_CAPACITY, MANAGE_CAPACITY.

## Cliente

Usuario comprador.

Puede:

- Buscar eventos.
- Ver detalle de eventos.
- Comprar entradas.
- Comprar productos.
- Comprar promociones.
- Usar wallet.
- Ver historial.
- Descargar o mostrar QR.
- Consultar tickets y consumos.

## Matriz inicial

| Accion | SUPER_ADMIN | ADMIN | WORKER | CUSTOMER |
| --- | --- | --- | --- | --- |
| Activar usuario | Si | No | No | No |
| Cambiar rol | Si | No | No | No |
| Crear club | No | Si | No | No |
| Activar/desactivar club | Si | No | No | No |
| Crear evento | No | Si | No | No |
| Comprar entrada | No | No | No | Si |
| Validar ticket | No | No | Segun permiso | No |
| Validar producto | No | No | Segun permiso | No |
| Ver dashboard global | Si | No | No | No |
| Ver dashboard de club | No | Si | Segun permiso | No |
| Solicitar retiro | No | Si | No | No |

## Reglas de autorizacion

- La autenticacion identifica al usuario.
- El rol define capacidades generales.
- La relacion con `clubId` define alcance operativo.
- Los permisos del trabajador definen acciones especificas.
- Toda accion sensible debe registrar audit log.

