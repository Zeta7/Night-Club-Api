# Modelo de Negocio

# Resumen

NightClub Platform operara bajo un modelo SaaS orientado a establecimientos de entretenimiento nocturno. La plataforma generara ingresos principalmente mediante comisiones por venta y, en etapas futuras, mediante planes de suscripcion para clubes.

## Segmentos de clientes

Los clientes comerciales principales son:

- Discotecas.
- Bares.
- Karaokes.
- Lounges.
- Rooftops.
- Beach clubs.
- Restobares.
- Organizadores de eventos asociados a establecimientos.

Los usuarios finales son personas que compran entradas, productos, promociones y experiencias.

## Fuente de ingresos MVP

La fuente principal de ingresos en el MVP sera:

- Comision por venta procesada dentro de la plataforma.

La comision puede aplicarse sobre:

- Entradas.
- Productos.
- Promociones.
- Combos.
- Otros items vendibles que se agreguen en el futuro.

## Fuente de ingresos futura

En futuras versiones se podran incorporar:

- Suscripciones Premium para clubes.
- Funcionalidades avanzadas de reporting.
- Herramientas de marketing.
- Promocion destacada de eventos.
- Membresias para clientes.
- Programas de fidelizacion.
- Comisiones diferenciadas por volumen.

## Flujo economico general

1. El cliente agrega items al carrito.
2. El cliente paga mediante Culqi.
3. La plataforma confirma el pago.
4. Se genera una orden pagada.
5. Se generan tickets o derechos de consumo.
6. Se registran movimientos en wallet.
7. Se asigna el ingreso correspondiente al club.
8. Se calcula la comision de plataforma.
9. El club solicita retiro de saldo disponible.
10. La plataforma aprueba o rechaza el retiro.

## Wallets del negocio

El modelo considera tres tipos de wallet:

- Wallet Cliente: recargas, compras, devoluciones e historial.
- Wallet Club: ventas, balance disponible, balance retenido y retiros.
- Wallet Plataforma: custodia, comisiones y transferencias.

Todo cambio economico debe representarse como un movimiento. Ningun saldo debe modificarse manualmente sin movimiento asociado.

## Politica de comisiones

Para el MVP, la comision debe modelarse como una configuracion de plataforma. Debe permitir evolucionar hacia:

- Comision global.
- Comision por club.
- Comision por tipo de item.
- Comision por evento.
- Comision promocional temporal.

## Retiros

Los clubes podran solicitar retiros desde su wallet. El retiro debe tener estados claros:

- PENDING.
- APPROVED.
- REJECTED.
- PAID.
- CANCELLED.

Cada solicitud y cambio de estado debe registrarse en audit log.

## Riesgos del modelo

- Disputas de pago.
- Contracargos.
- Cancelacion de eventos.
- Errores de validacion.
- Intentos de doble uso de QR.
- Diferencias entre saldo calculado y saldo esperado.

Estos riesgos deben mitigarse con trazabilidad, audit log, estados explicitos, locks de Redis e idempotencia.

