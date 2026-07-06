# Decisiones Tecnicas

# Objetivo

Este documento define las tecnologias principales de NightClub Platform y explica por que se usaran. La meta es evitar decisiones improvisadas durante el desarrollo y mantener una arquitectura simple, escalable y mantenible.

## Resumen del stack

| Area | Tecnologia | Decision |
| --- | --- | --- |
| Backend | NestJS + TypeScript | Aprobado para MVP |
| Package manager | pnpm | Aprobado para MVP |
| Arquitectura backend | Monolito modular + DDD + Hexagonal | Aprobado para MVP |
| API | REST | Aprobado para MVP |
| Base de datos | PostgreSQL | Aprobado para MVP |
| ORM | Prisma | Aprobado para MVP |
| Cache y locks | Redis | Aprobado para MVP |
| Jobs asincronos | BullMQ | Aprobado para MVP |
| Pagos | Culqi | Aprobado para MVP |
| Web Admin | React + Vite + TypeScript + TailwindCSS | Aprobado para MVP |
| Mobile | Flutter | Aprobado para MVP |
| Notificaciones | Firebase Cloud Messaging | Aprobado para MVP |
| Infraestructura | AWS | Aprobado para MVP |
| Observabilidad | Sentry + Prometheus + Grafana | Aprobado progresivo |

## Backend: NestJS + TypeScript

NestJS sera el framework principal del backend.

Motivos:

- Encaja bien con arquitectura modular.
- Tiene buena integracion con TypeScript.
- Facilita separar modulos por dominio.
- Soporta guards, interceptors, pipes, decorators y dependency injection.
- Es adecuado para APIs REST, colas, Redis, autenticacion y pruebas.
- Permite crecer sin convertir el proyecto temprano en microservicios.

Alternativas descartadas:

- Express puro: demasiado flexible, pero exige definir mucha estructura manual.
- Fastify puro: muy rapido, pero menos estructurado para un equipo que necesita modularidad fuerte.
- Laravel: productivo, pero el stack elegido prioriza TypeScript extremo a extremo.

Decision:

- Usar NestJS como backend principal.
- Mantener TypeScript en todo el backend.

## Package manager: pnpm

pnpm sera el gestor de paquetes del monorepo.

Motivos:

- Instalaciones mas rapidas y eficientes.
- Lockfile unico para el workspace.
- Mejor manejo de dependencias compartidas en monorepos.
- Evita continuar usando `npm` como flujo principal del proyecto.

Decision:

- Usar `pnpm` para instalar dependencias y ejecutar scripts.
- Mantener `packageManager` definido en `package.json`.
- Usar `pnpm-workspace.yaml` para agrupar `backend`, `frontend-web` y `frontend-mobile`.

## Arquitectura: monolito modular

El MVP se construira como monolito modular.

Motivos:

- Menor complejidad operativa que microservicios.
- Un solo despliegue inicial.
- Transacciones mas simples.
- Facilita iterar rapido.
- Permite separar dominios internamente.
- Puede evolucionar luego hacia servicios separados si algun modulo lo justifica.

Modulos iniciales:

- Identity.
- Platform.
- Organization.
- Club.
- Event.
- Catalog.
- Commerce.
- Payment.
- Wallet.
- QR Validation.
- Notification.
- Reporting.
- Audit.
- Shared.

Alternativa descartada:

- Microservicios desde el inicio. No se usaran en el MVP porque agregan complejidad de despliegue, observabilidad, comunicacion, consistencia distribuida y operacion.

Decision:

- Usar monolito modular para el MVP.
- Separar modulos con limites claros desde el codigo.

## DDD y arquitectura hexagonal

Se usara DDD y arquitectura hexagonal de forma pragmatica.

Motivos:

- El negocio tiene reglas importantes: tickets, QR, aforo, wallets, pagos, retiros y auditoria.
- Las reglas deben vivir en el dominio, no solo en controladores.
- El dominio no debe depender directamente de Prisma, Redis, Culqi o Firebase.
- Facilita pruebas unitarias de reglas criticas.
- Reduce el riesgo de acoplar todo el sistema al framework.

Decision:

- Cada modulo relevante tendra capas `domain`, `application`, `infrastructure` y `presentation`.
- El dominio no importara dependencias de NestJS ni Prisma.
- Las integraciones externas se manejaran como adaptadores.

## API: REST

La API inicial sera REST versionada.

Motivos:

- Simple de implementar y consumir.
- Compatible con web y mobile.
- Facil de documentar.
- Suficiente para el MVP.

Alternativas descartadas:

- GraphQL: potente, pero innecesario para el MVP y agrega complejidad.
- gRPC: util para comunicacion interna entre servicios, pero no es necesario en un monolito inicial.

Decision:

- Usar REST bajo `/api/v1`.
- Mantener contratos claros con DTOs de request y response.
- Mantener codigos tecnicos de error en ingles, por ejemplo `VALIDATION_ERROR` o `UNAUTHORIZED`.
- Retornar mensajes, descripciones y detalles visibles para el usuario en español.
- Escribir documentacion Swagger y comentarios de codigo en español.

## Base de datos: PostgreSQL

PostgreSQL sera la fuente principal de verdad.

Motivos:

- Excelente para datos transaccionales.
- Adecuado para ordenes, pagos, tickets, wallets y auditoria.
- Buen soporte para constraints, indices, transacciones y relaciones.
- Robusto para SaaS multi-tenant con shared database.

Alternativas descartadas:

- MySQL: viable, pero PostgreSQL ofrece mejor potencia general para este tipo de modelo.
- MongoDB: no es ideal como base principal para pagos, wallets y relaciones transaccionales.

Decision:

- Usar PostgreSQL para persistencia principal.
- Usar shared database con `clubId` en entidades de negocio.

## ORM: Prisma

Prisma sera el ORM del backend.

Motivos:

- Buen tipado con TypeScript.
- Migraciones claras.
- Modelo de datos legible.
- Productividad alta para el MVP.
- Buen ecosistema con NestJS.

Riesgos:

- Hay que cuidar queries complejas y performance.
- No toda regla de dominio debe depender del modelo Prisma.

Decision:

- Usar Prisma en infraestructura.
- No exponer Prisma directamente al dominio.

## Cache, locks y concurrencia: Redis

Redis se usara para cache, locks distribuidos y control de concurrencia.

Motivos:

- Validacion QR necesita evitar doble uso.
- Control de aforo requiere operaciones rapidas y seguras.
- La app debe poder escalar horizontalmente.
- BullMQ tambien depende de Redis.

Usos principales:

- Distributed locks para tickets y consumibles.
- Cache de datos de lectura frecuente.
- Rate limiting.
- Soporte para BullMQ.
- Apoyo al control de aforo.

Decision:

- Usar Redis desde el MVP.
- PostgreSQL seguira siendo la fuente final de verdad.

## Jobs asincronos: BullMQ

BullMQ se usara para tareas en segundo plano.

Motivos:

- Evita bloquear requests con tareas lentas.
- Funciona bien con Redis.
- Se integra bien con NestJS.

Casos de uso:

- Envio de notificaciones.
- Correos.
- Procesamiento de reportes.
- Tareas posteriores a pago.
- Generacion diferida de recursos no criticos.

Decision:

- Usar BullMQ para trabajos asincronos.
- No usar colas para operaciones que deban ser transaccionales e inmediatas.

## Pagos: Culqi

Culqi sera el unico proveedor de pagos del MVP.

Motivos:

- Adecuado para Peru.
- Soporta tarjetas y metodos locales como Yape y Plin segun disponibilidad del proveedor.
- Evita integrar multiples pasarelas desde el inicio.

Decision:

- Integrar Culqi como provider unico.
- Diseñar un puerto `PaymentGatewayPort` para no acoplar el dominio a Culqi.

## Web Admin: React + Vite + TypeScript + TailwindCSS

El panel web se construira con React.

Motivos:

- Buen ecosistema para dashboards.
- Vite ofrece desarrollo rapido.
- TypeScript mantiene contratos seguros.
- TailwindCSS permite construir interfaces consistentes con velocidad.

Uso principal:

- Panel de administradores.
- Dashboard de club.
- Dashboard de plataforma.
- Gestion de eventos, productos, promociones y trabajadores.

Decision:

- Usar React con Vite para web.
- Usar TailwindCSS para estilos.

## Mobile: Flutter

La app mobile se construira con Flutter.

Motivos:

- Una sola base para Android e iOS.
- Buen rendimiento.
- Buen soporte para camara y QR.
- Adecuado para clientes y trabajadores validadores.

Uso principal:

- Cliente final.
- Wallet.
- Tickets QR.
- Historial.
- Validacion QR para trabajadores.

Decision:

- Usar Flutter para mobile.
- Priorizar Android si el lanzamiento inicial necesita una plataforma primero.

## Notificaciones: Firebase Cloud Messaging

FCM se usara para notificaciones push.

Motivos:

- Estándar en mobile.
- Compatible con Android e iOS.
- Buena integracion con Flutter.
- Suficiente para MVP.

Casos de uso:

- Confirmacion de compra.
- Recordatorios de evento.
- Cambios de estado.
- Notificaciones operativas.

Decision:

- Usar Firebase Cloud Messaging para push notifications.

## Infraestructura: AWS

AWS sera el proveedor de infraestructura.

Motivos:

- Servicios maduros.
- Escalabilidad.
- RDS para PostgreSQL.
- ElastiCache para Redis.
- S3 y CloudFront para archivos.
- Posibilidad de evolucionar hacia ECS o arquitectura mas avanzada.

Infra inicial:

- EC2 para backend.
- RDS PostgreSQL.
- ElastiCache Redis.
- S3.
- CloudFront.

Decision:

- Usar AWS.
- Empezar simple con EC2 y evolucionar segun necesidad.

## Observabilidad

Se usara observabilidad progresiva.

Herramientas:

- Sentry para errores.
- Prometheus para metricas.
- Grafana para visualizacion.

Motivos:

- El sistema tendra flujos criticos de pagos y validacion QR.
- Es necesario detectar errores, latencia y cuellos de botella.

Metricas importantes:

- Latencia de validacion QR.
- Errores de pago.
- Webhooks procesados.
- Jobs fallidos.
- Uso de Redis.
- Tiempo de respuesta API.

Decision:

- Incluir Sentry desde etapas tempranas.
- Incorporar Prometheus y Grafana cuando el despliegue lo justifique.

## Decisiones pendientes

- Servicio exacto para envio de SMS o WhatsApp del codigo de confirmacion.
- Politica final para usuarios con telefono no confirmado.
- Si el checkout MVP permitira items de un solo club o multiples clubes.
- Politica de devoluciones y cancelaciones.
- Porcentaje inicial de comision de plataforma.
- Si el primer despliegue sera EC2 directo, Docker en EC2 o ECS.

## Orden recomendado de implementacion

1. Configurar proyecto NestJS.
2. Configurar Prisma y PostgreSQL.
3. Implementar Identity/Auth con telefono, password y confirmacion.
4. Implementar roles y guards.
5. Implementar Club.
6. Implementar Event.
7. Implementar Catalog.
8. Implementar Commerce y Orders.
9. Integrar Culqi.
10. Implementar Wallet.
11. Implementar QR Validation con Redis locks.
12. Implementar Audit Log.
13. Implementar dashboards iniciales.
14. Crear web admin.
15. Crear app Flutter.
