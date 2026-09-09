import { Injectable } from '@nestjs/common';
import { CommerceItemType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { conflict, notFound } from '../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { EventsService } from '../../events/application/events.service';
import { CommerceService } from './commerce.service';

@Injectable()
export class EventReplacementService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService, private readonly commerce: CommerceService) {}

  async options(user: AuthenticatedUser, clubId: string, eventId: string) {
    const { cancellation } = await this.events.getBusinessCancellation(user, clubId, eventId);
    if (!cancellation?.replacementEventId) throw conflict('NO_REPLACEMENT', 'Este evento no tiene reemplazo.');
    const [source, tickets, promotions, mappings] = await Promise.all([
      this.prisma.orderItem.groupBy({ by: ['itemType', 'itemId', 'nameSnapshot'], where: { eventId, order: { status: { in: ['PAID', 'PENDING'] } } }, _sum: { quantity: true } }),
      this.prisma.ticketType.findMany({ where: { eventId: cancellation.replacementEventId, status: 'ACTIVE' }, select: { id: true, name: true } }),
      this.prisma.promotion.findMany({ where: { eventId: cancellation.replacementEventId, status: 'ACTIVE' }, select: { id: true, name: true } }),
      this.prisma.eventReplacementMapping.findMany({ where: { cancellationId: cancellation.id } }),
    ]);
    return { source, tickets, promotions, mappings };
  }

  async configure(user: AuthenticatedUser, clubId: string, eventId: string, itemType: CommerceItemType, sourceItemId: string, targetItemId: string) {
    await this.events.getBusinessCancellation(user, clubId, eventId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${itemType + ':' + targetItemId}))::text`);
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "EventCancellation" WHERE "eventId" = ${eventId} FOR SHARE`);
      const cancellation = await tx.eventCancellation.findUniqueOrThrow({ where: { eventId } });
      if (cancellation.status !== 'REPLACEMENT_PROPOSED' || !cancellation.replacementEventId) throw conflict('REPLACEMENT_CLOSED', 'El reemplazo ya no admite configuración.');
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Event" WHERE "id" = ${cancellation.replacementEventId} FOR SHARE`);
      const target = await tx.event.findUniqueOrThrow({ where: { id: cancellation.replacementEventId } });
      if (target.clubId !== clubId || target.startsAt <= new Date() || !['DRAFT','PUBLISHED','SALE_ACTIVE','SOLD_OUT'].includes(target.status)) throw conflict('REPLACEMENT_UNAVAILABLE', 'El evento de reemplazo no está disponible.');
      const existing = await tx.eventReplacementMapping.findUnique({ where: { cancellationId_itemType_sourceItemId: { cancellationId: cancellation.id, itemType, sourceItemId } } });
      if (existing) {
        if (existing.targetItemId !== targetItemId) throw conflict('MAPPING_IMMUTABLE', 'Una correspondencia ofrecida a compradores no puede cambiarse silenciosamente.');
        return { mapping: existing };
      }
      const quantity = (await tx.orderItem.aggregate({ where: { eventId, itemId: sourceItemId, itemType, order: { status: { in: ['PAID','PENDING'] } } }, _sum: { quantity: true } }))._sum.quantity ?? 0;
      if (quantity <= 0) throw conflict('NO_PURCHASES', 'No hay compras elegibles para esta correspondencia.');
      let targetName = '';
      if (itemType === 'TICKET') {
        const ticket = await tx.ticketType.findFirst({ where: { id: targetItemId, eventId: target.id, status: 'ACTIVE' } });
        const reserved = await tx.inventoryReservation.aggregate({ where: { resourceType: 'TICKET', resourceId: targetItemId, status: 'ACTIVE', expiresAt: { gt: new Date() } }, _sum: { quantity: true } });
        if (!ticket || ticket.quantityTotal - ticket.quantitySold - ticket.replacementReserved - (reserved._sum.quantity ?? 0) < quantity) throw conflict('REPLACEMENT_CAPACITY', 'El reemplazo no tiene cupo suficiente para todas estas compras.');
        targetName = ticket.name;
        await tx.ticketType.update({ where: { id: targetItemId }, data: { replacementReserved: { increment: quantity } } });
      } else {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM "Promotion" WHERE id = ${targetItemId} FOR UPDATE`);
        const promotion = itemType === 'PROMOTION' ? await tx.promotion.findFirst({ where: { id: targetItemId, eventId: target.id, status: 'ACTIVE' } }) : null;
        if (!promotion) throw conflict('REPLACEMENT_ITEM_INVALID', 'Selecciona una entrada o promoción válida del nuevo evento.');
        targetName = promotion.name;
      }
      const mapping = await tx.eventReplacementMapping.create({ data: { cancellationId: cancellation.id, itemType, sourceItemId, targetItemId, targetName, reservedQuantity: quantity } });
      await tx.auditLogEntry.create({ data: { actorUserId: user.id, clubId, action: 'CONFIGURE_EVENT_REPLACEMENT', resourceType: 'EVENT', resourceId: eventId, metadata: { itemType, sourceItemId, targetItemId, quantity } } });
      return { mapping };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async accept(user: AuthenticatedUser, orderItemId: string, cancellationId: string, startsAt: string, endsAt: string) {
    return this.prisma.$transaction(async (tx) => {
      const initial = await tx.orderItem.findFirst({ where: { id: orderItemId, order: { userId: user.id } } });
      if (!initial) throw notFound('PURCHASE_NOT_FOUND', 'No encontramos tu compra.');
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Order" WHERE id = ${initial.orderId} FOR UPDATE`);
      const already = await tx.eventReplacementAcceptance.findUnique({ where: { cancellationId_orderItemId: { cancellationId, orderItemId } } });
      if (already) return { accepted: true };
      const item = await tx.orderItem.findUniqueOrThrow({ where: { id: orderItemId }, include: { order: true } });
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "EventCancellation" WHERE id = ${cancellationId} FOR SHARE`);
      const cancellation = await tx.eventCancellation.findUniqueOrThrow({ where: { id: cancellationId } });
      const request = await tx.eventBuyerRefundRequest.findUnique({ where: { cancellationId_orderItemId: { cancellationId, orderItemId } } });
      const refund = await tx.refundRequest.findFirst({ where: { orderId: item.orderId, status: { not: 'REJECTED' } } });
      if (request || refund || item.order.status !== 'PAID' || item.eventId !== cancellation.eventId || cancellation.status !== 'REPLACEMENT_PROPOSED' || !cancellation.replacementEventId) throw conflict('REPLACEMENT_NOT_ELIGIBLE', 'La compra tiene otra resolución o ya no admite este reemplazo.');
      const mapping = await tx.eventReplacementMapping.findUnique({ where: { cancellationId_itemType_sourceItemId: { cancellationId, itemType: item.itemType, sourceItemId: item.itemId } } });
      if (!mapping) throw conflict('REPLACEMENT_NOT_CONFIGURED', 'El negocio todavía debe configurar la equivalencia de tu compra.');
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${item.itemType + ':' + mapping.targetItemId}))::text`);
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Event" WHERE id = ${cancellation.replacementEventId} FOR SHARE`);
      const target = await tx.event.findUniqueOrThrow({ where: { id: cancellation.replacementEventId } });
      if (target.startsAt.getTime() !== new Date(startsAt).getTime() || target.endsAt.getTime() !== new Date(endsAt).getTime()) throw conflict('REPLACEMENT_CHANGED', 'La fecha cambió. Revisa la propuesta actualizada antes de aceptar.');
      if (target.startsAt <= new Date() || !['PUBLISHED','SALE_ACTIVE','SOLD_OUT'].includes(target.status)) throw conflict('REPLACEMENT_UNAVAILABLE', 'El reemplazo debe estar publicado y no haber comenzado.');
      const used = { orderItemId, OR: [{ usedAt: { not: null } }, { redemptionCount: { gt: 0 } }] };
      if (await tx.ticket.findFirst({ where: used }) || await tx.consumableRight.findFirst({ where: used })) throw conflict('MANUAL_REVIEW_REQUIRED', 'Esta compra ya tiene usos registrados y requiere revisión del negocio y Beerry.');
      const allocated = await tx.eventReplacementMapping.updateMany({ where: { id: mapping.id, reservedQuantity: { gte: item.quantity } }, data: { reservedQuantity: { decrement: item.quantity } } });
      if (allocated.count !== 1) throw conflict('REPLACEMENT_CAPACITY', 'No queda cupo reservado para esta compra.');
      if (item.itemType === 'TICKET') await tx.ticketType.update({ where: { id: mapping.targetItemId }, data: { replacementReserved: { decrement: item.quantity }, quantitySold: { increment: item.quantity } } });
      await this.commerce.issueReplacementResources(tx, orderItemId, mapping.targetItemId, target.id);
      await tx.orderItem.update({ where: { id: orderItemId }, data: { eventId: target.id, itemId: mapping.targetItemId } });
      await tx.eventReplacementAcceptance.create({ data: { cancellationId, orderItemId, targetEventId: target.id, targetItemId: mapping.targetItemId } });
      await tx.auditLogEntry.create({ data: { actorUserId: user.id, clubId: item.clubId, action: 'ACCEPT_EVENT_REPLACEMENT', resourceType: 'ORDER_ITEM', resourceId: orderItemId, metadata: { sourceEventId: cancellation.eventId, targetEventId: target.id, sourceItemId: item.itemId, targetItemId: mapping.targetItemId } } });
      await tx.notification.create({ data: { userId: user.id, category: 'EVENT', title: 'Reemplazo aceptado', body: 'Tus nuevos QR ya están disponibles. Los anteriores continúan cancelados. No se generó un nuevo cobro.', data: { orderId: item.orderId } } });
      return { accepted: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
