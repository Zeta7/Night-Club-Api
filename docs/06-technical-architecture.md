# Arquitectura Tecnica

# Resumen

La arquitectura propuesta es un monolito modular en NestJS con TypeScript, aplicando DDD y arquitectura hexagonal. El sistema debe ser simple para el MVP, pero preparado para crecer sin una reescritura importante.

## Stack

- Backend: NestJS.
- Lenguaje: TypeScript.
- Base de datos: PostgreSQL.
- ORM: Prisma.
- Cache y locks: Redis.
- Jobs asincronos: BullMQ.
- Pagos: Culqi.
- Notificaciones: Firebase Cloud Messaging.
- Observabilidad: Sentry, Prometheus y Grafana.
- Frontend web: React, Vite, TypeScript, TailwindCSS.
- Mobile: Flutter.

## Estilo arquitectonico

- Monolito modular.
- DDD por modulos.
- Arquitectura hexagonal.
- Casos de uso como capa de aplicacion.
- Dominio sin dependencia de frameworks.
- Infraestructura aislada mediante adaptadores.

## Estructura backend propuesta

```text
src/
  main.ts
  app.module.ts
  config/
  modules/
    identity/
      domain/
      application/
      infrastructure/
      presentation/
    club/
      domain/
      application/
      infrastructure/
      presentation/
    event/
    catalog/
    commerce/
    payment/
    wallet/
    qr-validation/
    notification/
    reporting/
    audit/
  shared/
    domain/
    application/
    infrastructure/
prisma/
docs/
```

## Capas por modulo

### Domain

Contiene:

- Entidades.
- Value Objects.
- Servicios de dominio.
- Reglas de negocio.
- Eventos de dominio.
- Interfaces de repositorio cuando aplique.

No debe depender de NestJS, Prisma, Redis ni librerias de infraestructura.

### Application

Contiene:

- Casos de uso.
- DTOs internos.
- Puertos.
- Orquestacion de reglas.
- Transacciones.

Debe coordinar dominio e infraestructura mediante interfaces.

### Infrastructure

Contiene:

- Repositorios Prisma.
- Adaptadores Redis.
- Adaptadores BullMQ.
- Adaptador Culqi.
- Adaptador Firebase.
- Implementaciones de puertos.

### Presentation

Contiene:

- Controllers REST.
- Guards.
- Pipes.
- DTOs HTTP.
- Serializadores.

## Base de datos

PostgreSQL sera la fuente de verdad. Prisma se usara como ORM.

Reglas:

- Usar UUID como identificador principal.
- Incluir timestamps.
- Incluir `clubId` en entidades operativas del negocio.
- Evitar borrado fisico en entidades sensibles.
- Usar estados explicitos.
- Modelar movimientos economicos como registros inmutables.

## Redis

Redis se usara para:

- Distributed locks.
- Cache.
- Control de concurrencia.
- Apoyo al control de aforo.
- Sesiones o refresh token metadata si aplica.

## BullMQ

BullMQ se usara para trabajos asincronos:

- Envio de correos.
- Notificaciones push.
- Generacion de QR si se delega fuera del flujo principal.
- Reportes.
- Procesamiento diferido de eventos no criticos.

## API

La API inicial sera REST.

Convenciones:

- Versionado desde el inicio: `/api/v1`.
- DTOs separados por request y response.
- Validacion con class-validator o alternativa equivalente.
- Errores estandarizados.
- Paginacion consistente.
- Filtros explicitos.

## Transacciones

Deben usarse transacciones para:

- Confirmacion de orden pagada.
- Generacion de tickets.
- Registro de movimientos de wallet.
- Validacion de QR.
- Solicitudes y aprobaciones de retiro.

## Observabilidad

Debe incluir:

- Logs estructurados.
- Correlation ID por request.
- Captura de errores con Sentry.
- Metricas de latencia, errores y throughput.
- Metricas especificas de validacion QR.

