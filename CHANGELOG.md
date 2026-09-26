# Changelog

## Unreleased

- Limpieza del tipado de pagos, OAuth, QR, auditoría y notificaciones: JSON
  comprobado en los límites, metadatos serializables y eliminación de conversiones
  forzadas. Firebase devuelve únicamente tokens inválidos presentes en el lote.
- Swagger conserva la documentación declarada en los controladores y DTOs; se
  eliminan ejemplos, permisos y textos inferidos por nombres. Las operaciones
  de validación de códigos comparten su DTO de respuesta.
- Contratos HTTP explícitos por módulo, comprobados por TypeScript y publicados
  mediante Swagger de Nest. Se elimina el generador propio de respuestas.
- Perfiles de club e instantáneas de eventos con estructuras concretas para el
  SDK; enums compartidos, distinción entre céntimos enteros e importes decimales,
  y nulabilidad corregida.
- Respuestas de compras, recargas, consumibles y devoluciones con estructuras
  concretas; se eliminan las mezclas de variantes con campos opcionales. Cambios
  de consumo documentados en `docs/openapi-contract.md`.
- Comprobación estricta de accesos por índice y enums de Prisma para los estados
  de cancelaciones y devoluciones ya restringidos por PostgreSQL. Requiere la
  migración `20260926000100_type_event_resolution_states` y regenerar el SDK.
