import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CommerceService } from './commerce.service';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { conflict, forbidden } from '../../../shared/presentation/api-exception';
import { EventsService } from '../../events/application/events.service';

@Injectable()
export class EventRefundWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private busy = false;
  private readonly logger = new Logger(EventRefundWorker.name);
  constructor(private readonly prisma: PrismaService, private readonly commerce: CommerceService, private readonly config: ConfigService, private readonly events: EventsService) {}
  onModuleInit() {
    // Explicit activation after migrations and staging verification.
    if (this.config.get('EVENT_REFUNDS_ENABLED') !== 'true') return;
    this.timer = setInterval(() => void this.tick(), 10_000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async discover() {
    // Repeated bounded scan also captures payments approved after authorization.
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "EventRefundJob" (id, "cancellationId", "orderItemId", status, "amountCents", "authorizedBy", "updatedAt")
      SELECT gen_random_uuid()::text, c.id, i.id, 'QUEUED', i."totalCents", COALESCE(b."beerryReviewedBy", c."reviewedByUserId"), NOW()
      FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId" JOIN "EventCancellation" c ON c."eventId" = i."eventId"
      LEFT JOIN "EventBuyerRefundRequest" b ON b."cancellationId" = c.id AND b."orderItemId" = i.id AND b.status = 'AUTHORIZED'
      WHERE o.status IN ('PAID','PARTIALLY_REFUNDED') AND i."totalCents" > 0
        AND ((c.mode = 'REFUND_REQUESTED' AND c.status = 'AUTHORIZED' AND c."reviewedByUserId" IS NOT NULL) OR b."beerryReviewedBy" IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM "EventRefundJob" j WHERE j."cancellationId" = c.id AND j."orderItemId" = i.id)
      ORDER BY i.id LIMIT 100 ON CONFLICT ("cancellationId", "orderItemId") DO NOTHING`);
  }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.discover();
      await this.releaseClosedReplacementCapacity();
      for (let index = 0; index < 5; index++) {
        const token = randomUUID();
        const ids = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          WITH candidate AS (SELECT j.id FROM "EventRefundJob" j
            JOIN "OrderItem" i ON i.id = j."orderItemId"
            WHERE j.status IN ('QUEUED','PROCESSING','WAITING_PROVIDER') AND j."nextRunAt" <= NOW()
              AND (j."refundRequestId" IS NOT NULL OR NOT EXISTS (
                SELECT 1 FROM "RefundRequest" r WHERE r."orderId" = i."orderId"
                  AND r.status IN ('REQUESTED','UNDER_REVIEW','APPROVED','PROCESSING','FAILED')))
            ORDER BY j."nextRunAt", j.id FOR UPDATE OF j SKIP LOCKED LIMIT 1)
          UPDATE "EventRefundJob" j SET status = 'PROCESSING', "leaseToken" = ${token}, attempts = attempts + 1,
            "nextRunAt" = NOW() + INTERVAL '5 minutes', "updatedAt" = NOW() FROM candidate c WHERE j.id = c.id RETURNING j.id`);
        if (!ids.length) break;
        await this.process(ids[0].id, token);
      }
    } catch (error) { this.logger.error(JSON.stringify({ event: 'event_refund.worker.failed', error: error instanceof Error ? error.name : 'unknown' })); }
    finally { this.busy = false; }
  }

  async process(id: string, token: string) {
    const job = await this.prisma.eventRefundJob.findUniqueOrThrow({ where: { id }, include: { orderItem: true } });
    if (job.leaseToken !== token) return;
    const finish = (status: string, error: string | null = null, delaySeconds = 60) => this.prisma.eventRefundJob.updateMany({ where: { id, leaseToken: token }, data: { status, lastError: error, nextRunAt: new Date(Date.now() + delaySeconds * 1000), leaseToken: null } });
    try {
      if (job.attempts > 12) { await finish('MANUAL_REVIEW', 'RETRY_LIMIT_REQUIRES_RECONCILIATION'); return; }
      let requestId = job.refundRequestId;
      if (!requestId) {
        requestId = await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw(Prisma.sql`SELECT id FROM "Order" WHERE id = ${job.orderItem.orderId} FOR UPDATE`);
          const fresh = await tx.eventRefundJob.findUniqueOrThrow({ where: { id } });
          if (fresh.refundRequestId) return fresh.refundRequestId;
          const order = await tx.order.findUniqueOrThrow({ where: { id: job.orderItem.orderId }, include: { paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } } });
          const attempt = order.paymentAttempts[0];
          if (!['PAID','PARTIALLY_REFUNDED'].includes(order.status) || !attempt || job.amountCents > attempt.amountCents - attempt.refundedAmountCents) throw new Error('PAYMENT_REQUIRES_RECONCILIATION');
          const other = await tx.refundRequest.findFirst({ where: { orderId: order.id, status: { in: ['REQUESTED','UNDER_REVIEW','APPROVED','PROCESSING','FAILED'] } } });
          if (other) throw new Error('REFUND_IN_FLIGHT');
          const used = { orderItemId: job.orderItemId, OR: [{ usedAt: { not: null } }, { redemptionCount: { gt: 0 } }] };
          if (!job.manualReviewNote && (await tx.ticket.findFirst({ where: used }) || await tx.consumableRight.findFirst({ where: used }))) throw new Error('USED_PURCHASE_REQUIRES_MANUAL_REVIEW');
          const fee = Math.round((attempt.refundedAmountCents + job.amountCents) * (attempt.marketplaceFeeCents ?? 0) / attempt.amountCents) - Math.round(attempt.refundedAmountCents * (attempt.marketplaceFeeCents ?? 0) / attempt.amountCents);
          const request = await tx.refundRequest.create({ data: { orderId: order.id, clubId: order.clubId, requestedByUserId: job.authorizedBy, reason: 'Devolución de evento autorizada por Beerry', status: 'APPROVED', requestedAmountCents: job.amountCents, approvedAmountCents: job.amountCents, marketplaceFeeRefundedCents: fee, resolutionNote: job.manualReviewNote ?? 'Compra sin usos autorizada por cancelación de evento', reviewedAt: new Date() } });
          await tx.eventRefundJob.update({ where: { id }, data: { refundRequestId: request.id } });
          return request.id;
        });
      }
      const request = await this.prisma.refundRequest.findUniqueOrThrow({ where: { id: requestId } });
      if (request.status === 'COMPLETED') { await this.complete(job.id); await finish('COMPLETED'); return; }
      if (request.externalRefundId) {
        if (await this.commerce.reconcileEventRefund(requestId)) { await this.complete(job.id); await finish('COMPLETED'); }
        else await finish('WAITING_PROVIDER', null, Math.min(3600, 60 * job.attempts));
        return;
      }
      await this.commerce.processRefundRequest({ id: job.authorizedBy, role: UserRole.SUPER_ADMIN }, requestId, job.amountCents, job.manualReviewNote ?? 'Autorizado por Beerry; compra sin usos', true);
      const sent = await this.prisma.refundRequest.findUniqueOrThrow({ where: { id: requestId } });
      if (sent.status === 'COMPLETED') { await this.complete(job.id); await finish('COMPLETED'); }
      else await finish('WAITING_PROVIDER');
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'UNEXPECTED_ERROR';
      const automatic = ['USED_PURCHASE_REQUIRES_MANUAL_REVIEW', 'PAYMENT_REQUIRES_RECONCILIATION'].includes(reason);
      await finish(automatic ? 'MANUAL_REVIEW' : 'QUEUED', automatic ? reason : 'RETRY_OR_PROVIDER_RECONCILIATION', Math.min(3600, 30 * 2 ** Math.min(job.attempts, 6)));
    }
  }

  private async releaseClosedReplacementCapacity() {
    const mappings = await this.prisma.$queryRaw<Array<{ id: string; itemType: string; targetItemId: string }>>(Prisma.sql`
      SELECT m.id, m."itemType", m."targetItemId" FROM "EventReplacementMapping" m
      JOIN "EventCancellation" c ON c.id = m."cancellationId" JOIN "Event" e ON e.id = c."replacementEventId"
      WHERE m."reservedQuantity" > 0 AND (c.status <> 'REPLACEMENT_PROPOSED' OR e.status IN ('CANCELLED','FINISHED') OR e."startsAt" <= NOW()) LIMIT 50`);
    for (const mapping of mappings) await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${mapping.itemType + ':' + mapping.targetItemId}))::text`);
      const current = await tx.eventReplacementMapping.findUniqueOrThrow({ where: { id: mapping.id } });
      if (current.reservedQuantity <= 0) return;
      await tx.eventReplacementMapping.update({ where: { id: mapping.id }, data: { reservedQuantity: 0 } });
      if (mapping.itemType === 'TICKET') await tx.ticketType.update({ where: { id: mapping.targetItemId }, data: { replacementReserved: { decrement: current.reservedQuantity } } });
    });
  }

  private async complete(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const job = await tx.eventRefundJob.findUniqueOrThrow({ where: { id }, include: { orderItem: true } });
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Order" WHERE id = ${job.orderItem.orderId} FOR UPDATE`);
      if (job.status === 'COMPLETED') return;
      const changed = await tx.eventRefundJob.updateMany({ where: { id, status: { not: 'COMPLETED' } }, data: { status: 'COMPLETED' } });
      if (changed.count !== 1) return;
      const mapping = await tx.eventReplacementMapping.findUnique({ where: { cancellationId_itemType_sourceItemId: { cancellationId: job.cancellationId, itemType: job.orderItem.itemType, sourceItemId: job.orderItem.itemId } } });
      if (mapping) {
        await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${job.orderItem.itemType + ':' + mapping.targetItemId}))::text`);
        const released = await tx.eventReplacementMapping.updateMany({ where: { id: mapping.id, reservedQuantity: { gte: job.orderItem.quantity } }, data: { reservedQuantity: { decrement: job.orderItem.quantity } } });
        if (released.count && job.orderItem.itemType === 'TICKET') await tx.ticketType.update({ where: { id: mapping.targetItemId }, data: { replacementReserved: { decrement: job.orderItem.quantity } } });
      }
      const order = await tx.order.findUniqueOrThrow({ where: { id: job.orderItem.orderId } });
      await tx.notification.create({ data: { userId: order.userId, category: 'EVENT', title: 'Devolución confirmada', body: 'La devolución de tu compra afectada fue confirmada. Consulta el detalle de tu movimiento.', data: { orderId: order.id } } });
    });
  }

  async list(user: AuthenticatedUser, clubId?: string, eventId?: string) {
    if (clubId && eventId) await this.events.getBusinessCancellation(user, clubId, eventId);
    else if (user.role !== UserRole.SUPER_ADMIN) throw forbidden('SUPER_ADMIN_REQUIRED', 'Solo Beerry puede revisar devoluciones.');
    const jobs = await this.prisma.eventRefundJob.findMany({ where: clubId && eventId ? { orderItem: { clubId }, cancellation: { eventId } } : {}, take: 100, orderBy: { createdAt: 'desc' }, include: { orderItem: { select: { nameSnapshot: true, quantity: true, totalCents: true, _count: { select: { tickets: { where: { OR: [{ usedAt: { not: null } }, { redemptionCount: { gt: 0 } }] } }, consumableRights: { where: { OR: [{ usedAt: { not: null } }, { redemptionCount: { gt: 0 } }] } } } } } } } });
    const unallocated = await this.prisma.refundRequest.findMany({ where: { eventJob: { is: null }, status: { in: ['UNDER_REVIEW','REQUESTED','FAILED','PROCESSING'] }, ...(clubId && eventId ? { clubId, order: { items: { some: { eventId } } } } : { order: { items: { some: { eventId: { not: null } } } } }) }, take: 50, orderBy: { createdAt: 'desc' } });
    return { jobs: [...jobs, ...unallocated.map((request) => ({ id: request.id, unallocated: true, status: 'MANUAL_REVIEW', amountCents: request.approvedAmountCents ?? request.requestedAmountCents ?? 0, lastError: request.reason, orderItem: { nameSnapshot: 'Compra que requiere conciliación individual', quantity: 1 } }))] };
  }

  async processUnallocated(user: AuthenticatedUser, id: string, amountCents: number, reason: string) {
    if (user.role !== UserRole.SUPER_ADMIN) throw forbidden('SUPER_ADMIN_REQUIRED', 'Solo Beerry puede resolver este caso.');
    const request = await this.prisma.refundRequest.findUniqueOrThrow({ where: { id }, include: { eventJob: true } });
    if (request.eventJob) throw conflict('USE_EVENT_JOB', 'Usa la revisión del caso de evento.');
    if (request.externalRefundId) return { confirmed: await this.commerce.reconcileEventRefund(id) };
    return this.commerce.processRefundRequest(user, id, amountCents, reason, true);
  }

  async review(user: AuthenticatedUser, id: string, amountCents: number, reason: string, approve: boolean) {
    if (user.role !== UserRole.SUPER_ADMIN) throw forbidden('SUPER_ADMIN_REQUIRED', 'Solo Beerry puede resolver este caso.');
    if (!reason.trim() || !Number.isSafeInteger(amountCents) || amountCents <= 0) throw conflict('INVALID_RESOLUTION', 'Indica importe y motivo.');
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.eventRefundJob.findUniqueOrThrow({ where: { id }, include: { orderItem: true } });
      if (job.status !== 'MANUAL_REVIEW' || amountCents > job.orderItem.totalCents || (job.refundRequestId && (amountCents !== job.amountCents || !approve))) throw conflict('RECONCILIATION_REQUIRED', 'No se puede modificar ni rechazar un envío de dinero existente; primero debe conciliarse.');
      const updated = await tx.eventRefundJob.updateMany({ where: { id, status: 'MANUAL_REVIEW', updatedAt: job.updatedAt }, data: { status: approve ? 'QUEUED' : 'REJECTED', amountCents, manualReviewNote: reason.trim(), authorizedBy: user.id, attempts: 0, nextRunAt: new Date(), lastError: null } });
      if (updated.count !== 1) throw conflict('JOB_CHANGED', 'El caso cambió.');
      await tx.auditLogEntry.create({ data: { actorUserId: user.id, clubId: job.orderItem.clubId, action: 'REVIEW_EVENT_REFUND_JOB', resourceType: 'EVENT_REFUND_JOB', resourceId: id, metadata: { approve, amountCents, reason } } });
      return { updated: true };
    });
  }
}
