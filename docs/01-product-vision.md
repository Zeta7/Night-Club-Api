# Vision del Producto

# NightClub Platform

NightClub Platform es una plataforma SaaS para la gestion de establecimientos de entretenimiento nocturno. Su objetivo es centralizar la operacion comercial, administrativa y de acceso de clubes, discotecas, bares, karaokes, lounges, rooftops, beach clubs y otros negocios que venden entradas, productos, promociones y experiencias asociadas a eventos.

La plataforma nace enfocada en discotecas, pero debe construirse como una base extensible para multiples tipos de establecimientos.

## Problema

Los establecimientos nocturnos suelen operar con herramientas fragmentadas:

- Venta de entradas por canales externos o manuales.
- Control de acceso con listas, capturas, codigos no seguros o validaciones lentas.
- Venta de productos y promociones desconectada de la experiencia del cliente.
- Reportes manuales o incompletos.
- Dificultad para controlar aforo en tiempo real.
- Falta de trazabilidad sobre cambios, validaciones, retiros y operaciones economicas.

Esto genera friccion para el cliente, perdida de control para el negocio y poca capacidad de escalar operaciones.

## Propuesta de valor

NightClub Platform permitira a los establecimientos:

- Publicar y administrar eventos.
- Vender entradas digitales.
- Vender productos y promociones asociados a eventos o clubes.
- Procesar pagos mediante Culqi.
- Generar tickets con QR unico por persona.
- Validar tickets, productos y promociones en tiempo real.
- Controlar aforo.
- Consultar dashboards operativos y economicos.
- Administrar wallets de cliente, club y plataforma.
- Solicitar y gestionar retiros.
- Registrar acciones importantes mediante audit log.

## Usuarios principales

- Cliente final: compra entradas, productos y promociones; usa wallet; descarga QR; consulta historial.
- Administrador de club: configura clubes, eventos, entradas, productos, promociones, trabajadores y retiros.
- Trabajador: valida tickets, productos o promociones segun permisos.
- Super Admin: administra la plataforma, usuarios, clubes, configuracion global y dashboard global.

## Principios del producto

- Cada ticket representa una sola persona.
- Cada QR debe ser unico, firmado y verificable.
- Las operaciones economicas deben ser trazables mediante movimientos.
- Los saldos no se editan directamente.
- La validacion debe ser rapida, segura e idempotente.
- El MVP debe ser simple, pero no debe cerrar el camino a crecimiento futuro.

## Alcance del MVP

El MVP debe cubrir:

- Registro e inicio de sesion.
- Administracion de clubes.
- Administracion de eventos.
- Venta de entradas, productos y promociones.
- Carrito de compras.
- Pago con Culqi.
- Generacion de ordenes, tickets y QR.
- Wallet cliente, club y plataforma.
- Validacion QR.
- Control de aforo.
- Solicitud de retiros.
- Dashboard inicial.
- Audit log.
- Redis para concurrencia y locks.

## Fuera del MVP

Quedan para futuras versiones:

- Membresias de clientes.
- Packs de entradas.
- Programas de fidelizacion.
- Cashback.
- Sistema social.
- Reservas.
- Recomendaciones con IA.
- Suscripciones Premium para clubes.

