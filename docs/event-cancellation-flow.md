# Resolución de eventos y devoluciones

## Reglas implementadas

- Cancelar detiene ventas y cancela derechos disponibles. No equivale a devolver dinero.
- Cancelación definitiva con devolución aceptada: REFUND_REQUESTED / PENDING_BEERRY. Solo Beerry puede autorizar el procesamiento.
- Cancelación con negativa: REFUND_DECLINED / CONTACT_REQUIRED. Beerry recibe el caso para contactar al negocio; no se mueve dinero.
- Cancelación con reemplazo: REPLACEMENT / REPLACEMENT_PROPOSED. No genera aprobación general de reembolso. El negocio configura equivalencias de entradas/promociones a otro evento futuro del mismo establecimiento.
- El comprador acepta expresamente equivalencia y fechas. Se reservan cupos y emiten QR nuevos; los anteriores siguen cancelados. No hay nuevo cobro ni duplicación al reintentar.
- Si rechaza el reemplazo, solicita devolución por línea: primero responde el negocio y luego Beerry. Solo AUTHORIZED habilita ejecución. No aplica a una simple postergación.
- El negocio puede rectificar su negativa o retirar el reemplazo y solicitar devoluciones. Las compras ya trasladadas pertenecen al evento nuevo y no entran en el lote anterior.
- Postergar suspende ventas/canjes conservando compras. Confirmar fechas ajusta vigencias transaccionalmente y vuelve a PUBLISHED, sin activar ventas automáticamente.
- Compras con usos requieren revisión manual de importe y motivo.

## Ejecución financiera

EventRefundWorker descubre autorizaciones por línea en lotes de 100 y procesa hasta 5 trabajos cada 10 segundos. PostgreSQL conserva identidad única, arrendamiento y reintentos limitados. Otra devolución abierta del mismo pedido hace esperar. Cada solicitud conserva importe e idempotency key.

- Mercado Pago: SDK, identificador real del pago, nunca el de preferencia, y consulta del reembolso específico. Una redirección o autorización administrativa no confirma dinero devuelto.
- Billetera: devolución parcial por línea con ajuste acumulado proporcional e idempotente. Recargas vuelven como recargas. Recompensas conservan lote y **vencimiento original**; vencidas o revocadas no vuelven al saldo disponible ni se convierten en dinero retirable.
- Pagos aprobados tarde se registran. Reserva vencida o stock insuficiente: sin QR, con caso de conciliación manual. Cancelación con reserva vigente: derechos emitidos cancelados.
- Agotar reintentos, usos o inconsistencia financiera genera revisión manual. Un envío existente no puede cambiar de importe ni rechazarse sin conciliarlo.
- La bandeja devuelve hasta 100 trabajos y 50 solicitudes sin asignación. No es un reporte histórico completo.

## App y notificaciones

Negocio: decisión al cancelar, resolución, equivalencias, solicitudes individuales y seguimiento.
Beerry: aprobación/rechazo con motivo y excepciones; acceso sin club propio.
Comprador: aviso público en movimiento, aceptación del reemplazo y solicitud por rechazo, sin notas internas.
Avisos se entregan por inbox y cola push respetando preferencias. Push requiere configuración y dispositivo registrado.

## Migraciones y activación manual

El agente no ejecutó estas migraciones. Aplicar en orden las pendientes:

1. 20260909000100_event_cancellation_decision
2. 20260909000200_order_event_snapshot
3. 20260909000300_event_buyer_refund_review
4. 20260909000400_event_resolution_execution

Generar Prisma y desplegar backend/mobile compatibles. Probar sobre staging primero.
Si ya se aplicó alguna versión anterior, no editar su historial: comparar y preparar migración adicional.

Mantener EVENT_REFUNDS_ENABLED=false durante actualización. Después de revisar autorizaciones existentes y validar staging, activar EVENT_REFUNDS_ENABLED=true y reiniciar. La activación procesa casos autorizados existentes. La bandera también gobierna liberación periódica de cupos de propuestas cerradas; desactivada puede conservar cupos retenidos.

## Aceptación pendiente de entorno antes de producción

- Dos compradores: aceptación/rechazo del reemplazo, QR antiguo/nuevo, cupos y doble aprobación.
- Repetir aceptación/webhook y reiniciar worker: sin duplicar saldo, dinero ni derechos.
- Cancelación simultánea con aprobación de pago; reservas vigentes y vencidas.
- Uso parcial: revisión manual, otras líneas no reembolsadas utilizables.
- Billetera mixta y devolución en partes: lotes vigentes/vencidos y contabilidad.
- Mercado Pago de prueba: reembolso específico y comisión, saldo insuficiente del vendedor y credenciales no disponibles.
- Inbox, permisos y push en dispositivos de los tres roles.
- Saldos pendientes del negocio antes/después. Si ya se liquidó, conciliar la deuda sin ocultarla como saldo cero.

Compilación y tests con mocks no certifican concurrencia PostgreSQL, migraciones, push ni liquidación real. Compras históricas sin referencia demostrable al evento requieren conciliación manual; no se reconstruyen con el catálogo actual.
