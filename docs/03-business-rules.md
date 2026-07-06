# Reglas del Negocio

# Principios

Las reglas de negocio deben ser explicitas, testeables y estar protegidas desde el dominio, no solo desde controladores o UI.

## Usuarios y roles

- El registro de usuarios se realiza con numero de telefono y password.
- El numero de telefono es obligatorio y debe confirmarse mediante codigo enviado al usuario.
- El correo electronico es opcional.
- Si el usuario registra correo, debe almacenarse como dato de contacto secundario.
- Un telefono no confirmado no debe operar como usuario activo completo, salvo excepciones administrativas definidas.
- Un usuario puede tener un rol principal dentro de la plataforma.
- Un usuario Administrador puede administrar uno o varios clubes.
- Un usuario Trabajador pertenece operativamente a uno o varios clubes segun asignacion.
- El Super Admin administra la plataforma, no la operacion interna de eventos, productos ni promociones.
- El Cliente puede comprar y consultar su wallet, tickets e historial.

## Clubes

- Un club debe pertenecer a la plataforma y tener estado.
- Un club inactivo no puede publicar nuevos eventos ni vender items.
- Un club puede tener multiples administradores.
- Un club puede tener multiples trabajadores con permisos configurables.
- Toda entidad operativa del club debe incluir `clubId`.
- El registro y edicion de negocio deben usar el mismo perfil publico estructurado: tipo de negocio, imagen de portada, imagen de perfil, direccion segmentada, contacto, redes sociales y horario semanal.
- El horario semanal debe conservar los 7 dias para hidratar correctamente la vista de edicion. Un dia cerrado puede conservar horas sugeridas o enviarlas vacias segun la UI.
- El tipo de negocio se guarda segun el valor recibido (`discoteca`, `club`, `karaoke`, etc.); no debe normalizarse silenciosamente a `club`.
- El club no debe duplicar datos del perfil en columnas planas. Direccion, contacto, redes y horario se guardan en JSON estructurado; las imagenes del negocio se guardan como portada y perfil.

## Eventos

Estados permitidos:

- DRAFT.
- PUBLISHED.
- SALE_ACTIVE.
- SOLD_OUT.
- IN_PROGRESS.
- FINISHED.
- CANCELLED.
- POSTPONED.

Reglas:

- Un evento pertenece a un club.
- Solo eventos publicados o con venta activa pueden mostrarse al cliente.
- Solo eventos con venta activa pueden recibir compras.
- Un evento cancelado no debe permitir ventas ni validaciones nuevas.
- Un evento finalizado no debe permitir nuevas validaciones de entrada.
- La capacidad maxima del evento debe respetarse durante compra y validacion.

## Entradas y tickets

- Una entrada define un tipo vendible para un evento.
- Un ticket representa exactamente una persona.
- Cada ticket tiene un codigo unico.
- Cada ticket tiene un QR unico.
- Una orden puede generar multiples tickets.
- Nunca debe existir un QR para multiples personas.
- Un ticket usado no puede volver a validarse.
- La validacion debe ser atomica usando lock distribuido.

## Productos y promociones

- Un producto puede estar asociado a un club y opcionalmente a eventos.
- Una promocion puede agrupar productos, descuentos o beneficios.
- Productos y promociones comprados deben generar derechos de consumo validables.
- Un derecho de consumo usado no puede volver a validarse.
- La validacion de productos y promociones debe respetar permisos del trabajador.

## Carrito y ordenes

- El carrito puede contener entradas, productos y promociones.
- Una orden debe conservar los precios al momento de compra.
- Una orden pendiente no debe generar tickets definitivos.
- Una orden pagada debe generar tickets y movimientos de wallet.
- Una orden fallida no debe generar derechos de acceso ni consumo.
- Las operaciones de pago deben ser idempotentes.

## Pagos

- Culqi sera el unico proveedor de pagos del MVP.
- La plataforma debe registrar intentos de pago.
- Una orden solo pasa a pagada despues de confirmacion valida.
- Webhooks de pago deben validar firma o mecanismo equivalente ofrecido por el proveedor.
- Los webhooks deben ser idempotentes.

## Wallet

- Nunca se modifica un saldo directamente.
- Todo cambio economico genera un movimiento.
- El saldo se calcula desde movimientos confirmados.
- Los movimientos deben ser inmutables.
- Para corregir un movimiento se debe crear un movimiento compensatorio.
- Los retiros deben descontar o reservar saldo mediante movimientos.

## Validacion QR

Flujo obligatorio:

1. Escanear QR.
2. Validar firma.
3. Obtener lock Redis.
4. Buscar ticket o derecho de consumo.
5. Validar estado.
6. Validar club.
7. Validar evento si corresponde.
8. Validar permisos del trabajador.
9. Validar aforo si corresponde.
10. Actualizar estado.
11. Guardar en PostgreSQL.
12. Registrar audit log.
13. Responder.

Tiempo objetivo: 200 a 300 ms.

## Audit log

Debe registrarse toda accion importante:

- Login.
- Cambio de rol.
- Creacion o edicion de evento.
- Cambio de precio.
- Validacion de ticket.
- Entrega de producto.
- Solicitud de retiro.
- Aprobacion o rechazo de retiro.
- Desactivacion de club.

El audit log debe ser transversal e inmutable para operaciones criticas.
