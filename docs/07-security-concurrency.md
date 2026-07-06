# Seguridad y Alta Concurrencia

# Objetivo

La plataforma debe proteger identidad, pagos, QR, wallets y operaciones administrativas. Tambien debe soportar picos de concurrencia durante ventas y validaciones de ingreso.

## Seguridad base

Medidas iniciales:

- JWT para access tokens.
- Refresh tokens.
- Hash seguro de passwords.
- Confirmacion de telefono mediante codigo al registrarse.
- Rate limiting.
- Helmet.
- CORS configurado por entorno.
- Validacion de input.
- Guards por rol y permisos.
- Audit log en acciones sensibles.

## Autenticacion

El sistema usara:

- Numero de telefono y password como credenciales principales.
- Correo electronico opcional como dato de contacto secundario.
- Codigo de confirmacion enviado al telefono durante el registro.
- Access token de corta duracion.
- Refresh token de mayor duracion.
- Revocacion o invalidacion de refresh tokens.
- Rotacion de refresh tokens si se decide en implementacion.

Un usuario no debe considerarse completamente activo para operar hasta confirmar su numero de telefono, salvo reglas administrativas explicitas.

## Confirmacion de telefono

El registro debe generar un codigo de confirmacion de un solo uso.

Reglas:

- El codigo debe tener expiracion.
- El codigo no debe guardarse en texto plano.
- Debe limitarse la cantidad de reenvios.
- Debe limitarse la cantidad de intentos fallidos.
- Al confirmar el telefono, el usuario pasa a estado verificado.
- El login puede bloquearse o restringirse si el telefono no esta confirmado, segun la regla final del producto.

## Autorizacion

La autorizacion debe validar:

- Usuario autenticado.
- Rol global.
- Relacion con `clubId`.
- Permiso especifico cuando sea trabajador.
- Estado de usuario y club.

## QR firmados

Los QR deben contener un payload minimo y firmado.

Payload sugerido:

- ticketId o consumableRightId.
- clubId.
- eventId cuando aplique.
- type.
- issuedAt.
- nonce o codigo unico.

El backend debe validar la firma antes de consultar o mutar estado.

## Validacion QR concurrente

Riesgo principal: doble validacion del mismo QR.

Mitigacion:

- Validar firma.
- Usar Redis lock por ticket o derecho de consumo.
- Releer estado desde PostgreSQL dentro del flujo.
- Actualizar estado de forma transaccional.
- Registrar audit log.
- Liberar lock al finalizar.

Clave de lock sugerida:

```text
lock:qr-validation:{resourceType}:{resourceId}
```

## Control de aforo

Riesgo principal: superar capacidad por validaciones simultaneas.

Mitigacion:

- Capacidad maxima por evento.
- Contador validado por evento.
- Lock o estrategia atomica para incremento.
- Persistencia en PostgreSQL como fuente de verdad.
- Redis como apoyo de velocidad, no como unica fuente final.

## Idempotencia

Deben ser idempotentes:

- Confirmaciones de pago.
- Webhooks de Culqi.
- Generacion de tickets por orden.
- Movimientos de wallet por orden.
- Validaciones QR ante reintentos controlados.

## Pagos

Medidas:

- Registrar intentos de pago.
- Validar webhooks.
- No confiar en datos enviados por cliente para marcar una orden como pagada.
- Confirmar el pago con Culqi cuando aplique.
- Guardar provider references.
- Proteger contra doble procesamiento de webhook.

## Wallet

Medidas:

- Movimientos inmutables.
- Saldos calculados.
- Transacciones para movimientos relacionados.
- Audit log para retiros.
- Estados explicitos.
- Correcciones mediante movimientos compensatorios.

## Rate limiting

Aplicar limites a:

- Login.
- Registro.
- Refresh token.
- Checkout.
- Validacion QR.
- Webhooks si corresponde con estrategia compatible.

## Auditoria

Cada accion sensible debe registrar:

- Actor.
- Accion.
- Recurso afectado.
- Fecha.
- IP o metadata disponible.
- Resultado.
- Club relacionado si aplica.

## Objetivos de rendimiento

- Validacion QR: 200 a 300 ms.
- API stateless para escalar horizontalmente.
- Redis para locks y cache.
- BullMQ para procesamiento no critico fuera del request.
