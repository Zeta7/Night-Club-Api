import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClubStatus,
  EventStatus,
  Prisma,
  RedeemableStatus,
  SellerConnectionStatus,
  UserRole,
} from '@prisma/client';
import { buildMediaUrl } from '../../../shared/infrastructure/media/media-url';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { badRequest, conflict, forbidden, notFound } from '../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { UploadsService } from '../../uploads/application/uploads.service';
import { CreateEventDto } from '../presentation/dto/create-event.dto';
import { UpdateEventDto } from '../presentation/dto/update-event.dto';
import { CancelEventDto, ReviewEventCancellationDto } from '../presentation/dto/cancel-event.dto';
import { EventReasonDto, RescheduleEventDto } from '../presentation/dto/reschedule-event.dto';

const PUBLIC_EVENT_STATUSES = [
  EventStatus.PUBLISHED,
  EventStatus.SALE_ACTIVE,
  EventStatus.SOLD_OUT,
  EventStatus.IN_PROGRESS,
];
const mercadoPagoReadyClubWhere = () => ({
  status: ClubStatus.ACTIVE,
  sellerConnections: {
    some: {
      provider: 'mercado_pago',
      status: SellerConnectionStatus.CONNECTED,
      OR: [{ tokenExpiresAt: null }, { tokenExpiresAt: { gt: new Date() } }],
    },
  },
});

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
    private readonly config: ConfigService,
  ) {}

  async createEvent(currentUser: AuthenticatedUser, clubId: string, input: CreateEventDto) {
    await this.assertCanManageClub(currentUser, clubId);
    const { startsAt, endsAt } = parseEventDates(input.startsAt, input.endsAt);

    this.assertImageMutationInput(input.imageUploadId, input.removeImage);

    const event = await this.prisma.$transaction(async (tx) => {
      const consumedImage = input.imageUploadId
        ? await this.uploadsService.consumeUpload({
            uploadId: input.imageUploadId,
            userId: currentUser.id,
            transaction: tx,
          })
        : null;

      return tx.event.create({
        data: {
          clubId,
          name: normalizeText(input.name),
          description: normalizeOptionalText(input.description),
          imageUrl: consumedImage?.objectKey ?? null,
          startsAt,
          endsAt,
          capacity: input.capacity,
        },
        include: eventInclude,
      });
    });

    return {
      message: 'Evento creado correctamente.',
      event: await toEventResponse(event, this.config, this.uploadsService),
    };
  }

  async listClubEvents(currentUser: AuthenticatedUser, clubId: string) {
    await this.assertCanManageClub(currentUser, clubId);

    const events = await this.prisma.event.findMany({
      where: { clubId },
      orderBy: { startsAt: 'desc' },
      include: eventInclude,
    });

    return {
      message: 'Eventos del club obtenidos correctamente.',
      events: await Promise.all(
        events.map((event) => toEventResponse(event, this.config, this.uploadsService)),
      ),
    };
  }

  async listPublicEvents() {
    const events = await this.prisma.event.findMany({
      where: {
        status: { in: PUBLIC_EVENT_STATUSES },
        club: mercadoPagoReadyClubWhere(),
      },
      orderBy: { startsAt: 'asc' },
      include: eventInclude,
    });

    return {
      message: 'Eventos publicos obtenidos correctamente.',
      events: await Promise.all(
        events.map((event) => toEventResponse(event, this.config, this.uploadsService)),
      ),
    };
  }

  async getAdminEventsDashboard(currentUser: AuthenticatedUser) {
    this.assertCanViewAdminEvents(currentUser);

    const club = await this.findAdminEventsClub(currentUser);

    if (!club) {
      return {
        message: 'Dashboard de eventos obtenido correctamente.',
        hasClub: false,
        summary: emptyAdminEventsSummary(),
        alerts: [],
        events: [],
        topEvents: [],
      };
    }

    const now = new Date();
    const activeStatuses: EventStatus[] = [
      EventStatus.PUBLISHED,
      EventStatus.SALE_ACTIVE,
      EventStatus.SOLD_OUT,
      EventStatus.IN_PROGRESS,
    ];
    const activeEvents = club.events.filter((event) => activeStatuses.includes(event.status));
    const publishedEvents = club.events.filter((event) => event.status !== EventStatus.CANCELLED);
    const visibleEvents = club.events.filter((event) => event.status !== EventStatus.CANCELLED);
    const nearlySoldOutEvent = activeEvents.find((event) => event.capacity > 0);
    const allTicketTypes = club.events.flatMap((event) => event.ticketTypes ?? []);
    const ticketsSold = allTicketTypes.reduce((total, ticket) => total + ticket.quantitySold, 0);
    const salesAmount = allTicketTypes.reduce(
      (total, ticket) => total + (ticket.quantitySold * ticket.priceCents) / 100,
      0,
    );

    const eventCards = await Promise.all(
      club.events.map(async (event) => ({
        ...toAdminEventCard(event, now, this.config),
        imageUrl: await this.uploadsService.createReadableImageUrl(event.imageUrl),
      })),
    );
    const alertImageUrl = nearlySoldOutEvent
      ? await this.uploadsService.createReadableImageUrl(nearlySoldOutEvent.imageUrl)
      : null;

    return {
      message: 'Dashboard de eventos obtenido correctamente.',
      hasClub: true,
      club: {
        id: club.id,
        name: club.name,
        type: club.type,
        status: club.status,
      },
      summary: {
        activeEvents: activeEvents.length,
        publishedEvents: publishedEvents.length,
        ticketsSold,
        salesAmount,
        currency: 'PEN',
      },
      alerts: nearlySoldOutEvent
        ? [
            {
              type: 'selling_out',
              title: 'Proximo a agotarse',
              text: nearlySoldOutEvent.name,
              imageUrl: alertImageUrl,
            },
          ]
        : [],
      events: eventCards,
      topEvents: visibleEvents.slice(0, 3).map((event, index) => ({
        rank: index + 1,
        id: event.id,
        name: event.name,
        amount: 0,
        currency: 'PEN',
      })),
    };
  }

  async getPublicEvent(eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        status: { in: PUBLIC_EVENT_STATUSES },
        club: mercadoPagoReadyClubWhere(),
      },
      include: eventInclude,
    });

    if (!event) {
      throw notFound('EVENT_NOT_FOUND', 'No encontramos el evento solicitado.');
    }

    return {
      message: 'Evento obtenido correctamente.',
      event: await toEventResponse(event, this.config, this.uploadsService),
    };
  }

  async updateEvent(
    currentUser: AuthenticatedUser,
    clubId: string,
    eventId: string,
    input: UpdateEventDto,
  ) {
    await this.assertCanManageEvent(currentUser, clubId, eventId);

    const data: {
      name?: string;
      description?: string | null;
      imageUrl?: string | null;
      startsAt?: Date;
      endsAt?: Date;
      capacity?: number;
    } = {};

    if (input.name !== undefined) {
      data.name = normalizeText(input.name);
    }

    if (input.description !== undefined) {
      data.description = normalizeOptionalText(input.description);
    }

    if (input.capacity !== undefined) {
      data.capacity = input.capacity;
    }

    if (input.startsAt !== undefined || input.endsAt !== undefined) {
      const currentEvent = await this.findEventOrFail(clubId, eventId);
      const { startsAt, endsAt } = parseEventDates(
        input.startsAt ?? currentEvent.startsAt.toISOString(),
        input.endsAt ?? currentEvent.endsAt.toISOString(),
      );
      data.startsAt = startsAt;
      data.endsAt = endsAt;
    }

    this.assertImageMutationInput(input.imageUploadId, input.removeImage);
    const currentEvent = await this.findEventOrFail(clubId, eventId);

    const event = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`);
      const locked = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
      if (locked.updatedAt.getTime() !== currentEvent.updatedAt.getTime()) {
        throw conflict('EVENT_CHANGED', 'El evento cambió. Actualiza la pantalla antes de continuar.');
      }
      const datesChanged = (data.startsAt && data.startsAt.getTime() !== locked.startsAt.getTime())
        || (data.endsAt && data.endsAt.getTime() !== locked.endsAt.getTime());
      if (datesChanged && await this.hasCommercialHistory(tx, eventId)) {
        throw conflict('EVENT_REPROGRAMMING_REQUIRED', 'El evento tiene compras asociadas. No se puede cambiar su fecha mediante una edición simple.');
      }
      if (data.capacity !== undefined) {
        const [allocated, occupancy] = await Promise.all([
          tx.ticketType.aggregate({ where: { eventId }, _sum: { quantityTotal: true } }),
          tx.eventOccupancy.findUnique({ where: { eventId } }),
        ]);
        if (data.capacity < Math.max(allocated._sum.quantityTotal ?? 0, occupancy?.currentCount ?? 0)) {
          throw conflict('EVENT_CAPACITY_BELOW_COMMITMENTS', 'El aforo no puede ser menor que las entradas asignadas o las personas presentes.');
        }
      }
      if (input.imageUploadId) {
        const replacement = await this.uploadsService.replaceUpload({
          uploadId: input.imageUploadId,
          userId: currentUser.id,
          previousObjectKey: currentEvent.imageUrl,
          transaction: tx,
        });
        data.imageUrl = replacement.objectKey;
      } else if (input.removeImage) {
        data.imageUrl = null;
        await this.uploadsService.queueObjectDeletion(currentEvent.imageUrl, tx);
      }

      const updated = await tx.event.update({
        where: { id: eventId },
        data,
        include: eventInclude,
      });
      await tx.auditLogEntry.create({ data: {
        actorUserId: currentUser.id, clubId, action: 'UPDATE_EVENT', resourceType: 'EVENT', resourceId: eventId,
        metadata: { previousStartsAt: locked.startsAt.toISOString(), previousEndsAt: locked.endsAt.toISOString(),
          startsAt: updated.startsAt.toISOString(), endsAt: updated.endsAt.toISOString(), previousCapacity: locked.capacity, capacity: updated.capacity },
      } });
      return updated;
    });

    return {
      message: 'Evento actualizado correctamente.',
      event: await toEventResponse(event, this.config, this.uploadsService),
    };
  }

  async publishEvent(currentUser: AuthenticatedUser, clubId: string, eventId: string) {
    const event = await this.assertCanManageEvent(currentUser, clubId, eventId);
    this.assertTransitionAllowed(event.status, [EventStatus.DRAFT]);

    return this.updateEventStatus(
      eventId,
      EventStatus.PUBLISHED,
      'Evento publicado correctamente.',
      event.status, currentUser.id,
    );
  }

  async startSale(currentUser: AuthenticatedUser, clubId: string, eventId: string) {
    const event = await this.assertCanManageEvent(currentUser, clubId, eventId);
    this.assertTransitionAllowed(event.status, [EventStatus.PUBLISHED]);

    return this.updateEventStatus(
      eventId,
      EventStatus.SALE_ACTIVE,
      'Venta activada correctamente.',
      event.status, currentUser.id,
    );
  }

  async cancelEvent(currentUser: AuthenticatedUser, clubId: string, eventId: string, decision: CancelEventDto) {
    if (!decision?.mode || !decision.reason?.trim() || decision.reason.trim().length < 5) {
      throw badRequest('CANCELLATION_DECISION_REQUIRED', 'Selecciona la solución para los compradores e indica el motivo.');
    }
    const event = await this.assertCanManageEvent(currentUser, clubId, eventId);
    this.assertTransitionAllowed(event.status, [
      EventStatus.DRAFT,
      EventStatus.PUBLISHED,
      EventStatus.SALE_ACTIVE,
      EventStatus.SOLD_OUT,
      EventStatus.IN_PROGRESS,
      EventStatus.POSTPONED,
    ]);

    return this.updateEventStatus(
      eventId,
      EventStatus.CANCELLED,
      'Evento cancelado correctamente.',
      event.status, currentUser.id,
      decision,
    );
  }

  async reactivateEvent(currentUser: AuthenticatedUser, clubId: string, eventId: string) {
    const event = await this.assertCanManageEvent(currentUser, clubId, eventId);
    this.assertTransitionAllowed(event.status, [EventStatus.CANCELLED]);

    return this.updateEventStatus(
      eventId,
      EventStatus.PUBLISHED,
      'Evento reactivado correctamente.',
      event.status, currentUser.id,
    );
  }

  async finishEvent(currentUser: AuthenticatedUser, clubId: string, eventId: string) {
    const event = await this.assertCanManageEvent(currentUser, clubId, eventId);
    this.assertTransitionAllowed(event.status, [EventStatus.IN_PROGRESS, EventStatus.SALE_ACTIVE]);

    return this.updateEventStatus(
      eventId,
      EventStatus.FINISHED,
      'Evento finalizado correctamente.',
      event.status, currentUser.id,
    );
  }

  private assertCanViewAdminEvents(currentUser: AuthenticatedUser) {
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw forbidden(
        'ADMIN_EVENTS_FORBIDDEN',
        'No tienes permisos para ver eventos administrativos.',
      );
    }
  }

  private async findAdminEventsClub(currentUser: AuthenticatedUser) {
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      return this.prisma.club.findFirst({
        orderBy: { createdAt: 'asc' },
        include: adminEventsClubInclude,
      });
    }

    const relation = await this.prisma.clubAdmin.findFirst({
      where: {
        userId: currentUser.id,
      },
      orderBy: { createdAt: 'asc' },
      include: {
        club: {
          include: adminEventsClubInclude,
        },
      },
    });

    return relation?.club ?? null;
  }

  private async updateEventStatus(eventId: string, status: EventStatus, message: string, expectedStatus: EventStatus, actorUserId: string, decision?: CancelEventDto) {
    const event = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`);
      const current = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
      if (current.status !== expectedStatus) {
        throw conflict('EVENT_CHANGED', 'El evento cambió. Actualiza la pantalla antes de continuar.');
      }
      if ((status === EventStatus.PUBLISHED || status === EventStatus.SALE_ACTIVE) && current.endsAt <= new Date()) {
        throw badRequest('EVENT_ALREADY_ENDED', 'No puedes publicar o activar ventas de un evento cuya fecha ya terminó.');
      }
      if (expectedStatus === EventStatus.CANCELLED && await this.hasCommercialHistory(tx, eventId)) {
        throw conflict('EVENT_REACTIVATION_UNSAFE', 'Este evento tiene compras asociadas. Crea un nuevo evento; no se pueden restaurar automáticamente sus entradas.');
      }
      const updated = await tx.event.update({
        where: { id: eventId },
        data: { status },
        include: eventInclude,
      });
      await tx.auditLogEntry.create({ data: {
        actorUserId, clubId: current.clubId, action: 'CHANGE_EVENT_STATUS', resourceType: 'EVENT', resourceId: eventId,
        metadata: { from: current.status, to: status },
      } });
      if (status === EventStatus.CANCELLED) {
        if (!decision) throw badRequest('CANCELLATION_DECISION_REQUIRED', 'Falta la decisión del negocio.');
        if (decision.mode === 'REPLACEMENT') {
          if (!decision.replacementEventId || decision.replacementEventId === eventId) {
            throw badRequest('REPLACEMENT_REQUIRED', 'Selecciona un nuevo evento del mismo establecimiento.');
          }
          const replacement = await tx.event.findFirst({ where: {
            id: decision.replacementEventId, clubId: current.clubId,
            status: { in: ['DRAFT', 'PUBLISHED', 'SALE_ACTIVE'] }, startsAt: { gt: new Date() },
          } });
          if (!replacement) throw badRequest('REPLACEMENT_INVALID', 'El evento de reemplazo debe tener una fecha futura y pertenecer al negocio.');
        } else if (decision.replacementEventId) {
          throw badRequest('REPLACEMENT_NOT_ALLOWED', 'El reemplazo solo corresponde a la opción de nuevo evento.');
        }
        const cancellationStatus = decision.mode === 'REFUND_REQUESTED' ? 'PENDING_BEERRY'
          : decision.mode === 'REFUND_DECLINED' ? 'CONTACT_REQUIRED' : 'REPLACEMENT_PROPOSED';
        const cancellation = await tx.eventCancellation.create({ data: {
          eventId, mode: decision.mode, status: cancellationStatus, reason: decision.reason.trim(),
          replacementEventId: decision.replacementEventId, requestedByUserId: actorUserId,
        } });
        if (decision.mode !== 'REPLACEMENT') {
          const admins = await tx.user.findMany({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' }, select: { id: true } });
          await tx.notification.createMany({ data: admins.map((admin) => ({
            userId: admin.id, category: 'EVENT' as const,
            title: decision.mode === 'REFUND_REQUESTED' ? 'Cancelación: devolución solicitada' : 'Cancelación: contactar al negocio',
            body: decision.mode === 'REFUND_REQUESTED'
              ? `${current.name}: el negocio acepta devolver. Se requiere revisión de Beerry.`
              : `${current.name}: el negocio no acepta devolver y no ofrece reemplazo. Se requiere contacto.`,
            data: { eventId, cancellationId: cancellation.id, status: cancellationStatus },
          })) });
        }
        const revokedAt = new Date();
        const revokedReason = `EVENT_CANCELLED:${eventId}`;
        await tx.ticket.updateMany({
          where: { eventId, status: RedeemableStatus.AVAILABLE },
          data: { status: RedeemableStatus.CANCELLED, revokedAt, revokedReason },
        });
        await tx.consumableRight.updateMany({
          where: { eventId, status: RedeemableStatus.AVAILABLE },
          data: { status: RedeemableStatus.CANCELLED, revokedAt, revokedReason },
        });
        await this.notifyEventBuyers(tx, eventId, 'Evento cancelado', `${current.name}: los QR anteriores ya no son válidos. Tu compra está pendiente de resolución; no hay una devolución confirmada.`);
      }
      return updated;
    });

    return {
      message,
      event: await toEventResponse(event, this.config, this.uploadsService),
    };
  }

  async postponeEvent(user: AuthenticatedUser, clubId: string, eventId: string, input: EventReasonDto) {
    await this.assertCanManageEvent(user, clubId, eventId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`);
      const event = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
      this.assertTransitionAllowed(event.status, [EventStatus.PUBLISHED, EventStatus.SALE_ACTIVE, EventStatus.SOLD_OUT]);
      if (input.reason.trim().length < 5) throw badRequest('EVENT_REASON_REQUIRED', 'Indica el motivo.');
      await tx.event.update({ where: { id: eventId }, data: { status: 'POSTPONED' } });
      await this.notifyEventBuyers(tx, eventId, 'Evento postergado', `${event.name}: conservas tu compra. Las ventas y los canjes están suspendidos hasta confirmar una nueva fecha.`);
      await tx.auditLogEntry.create({ data: { actorUserId: user.id, clubId, action: 'POSTPONE_EVENT', resourceType: 'EVENT', resourceId: eventId,
        metadata: { reason: input.reason.trim(), previousStatus: event.status, startsAt: event.startsAt.toISOString(), endsAt: event.endsAt.toISOString() } } });
      return { message: 'Evento postergado. Las compras se conservan y los canjes quedan suspendidos.' };
    });
  }

  async rescheduleEvent(user: AuthenticatedUser, clubId: string, eventId: string, input: RescheduleEventDto) {
    await this.assertCanManageEvent(user, clubId, eventId);
    const { startsAt, endsAt } = parseEventDates(input.startsAt, input.endsAt);
    if (startsAt <= new Date() || input.reason.trim().length < 5) throw badRequest('EVENT_RESCHEDULE_INVALID', 'Indica una fecha futura y un motivo.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`);
      const event = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
      this.assertTransitionAllowed(event.status, [EventStatus.POSTPONED]);
      // Shift existing windows relative to the old event; preserve shorter promotion validity.
      const deltaMs = startsAt.getTime() - event.startsAt.getTime();
      for (const table of ['Ticket', 'ConsumableRight'] as const) {
        await tx.$executeRaw(Prisma.sql`UPDATE ${Prisma.raw('"' + table + '"')} SET
          "validFrom" = LEAST(COALESCE("validFrom" + ${deltaMs} * INTERVAL '1 millisecond', ${startsAt}), ${endsAt}),
          "validUntil" = LEAST(COALESCE("validUntil" + ${deltaMs} * INTERVAL '1 millisecond', ${endsAt}), ${endsAt})
          WHERE "eventId" = ${eventId} AND "status" = 'AVAILABLE' AND "revokedAt" IS NULL`);
      }
      await tx.$executeRaw(Prisma.sql`UPDATE "TicketType" SET
        "saleStartAt" = "saleStartAt" + ${deltaMs} * INTERVAL '1 millisecond',
        "saleEndAt" = LEAST("saleEndAt" + ${deltaMs} * INTERVAL '1 millisecond', ${endsAt}) WHERE "eventId" = ${eventId}`);
      await tx.$executeRaw(Prisma.sql`UPDATE "Promotion" SET
        "startsAt" = "startsAt" + ${deltaMs} * INTERVAL '1 millisecond',
        "endsAt" = LEAST("endsAt" + ${deltaMs} * INTERVAL '1 millisecond', ${endsAt}) WHERE "eventId" = ${eventId}`);
      await tx.event.update({ where: { id: eventId }, data: { startsAt, endsAt, status: 'PUBLISHED' } });
      await this.notifyEventBuyers(tx, eventId, 'Nueva fecha confirmada', `${event.name}: revisa la nueva fecha en tus compras. Tus derechos disponibles se han actualizado.`);
      await tx.auditLogEntry.create({ data: { actorUserId: user.id, clubId, action: 'RESCHEDULE_EVENT', resourceType: 'EVENT', resourceId: eventId,
        metadata: { reason: input.reason.trim(), previousStartsAt: event.startsAt.toISOString(), previousEndsAt: event.endsAt.toISOString(), startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() } } });
      return { message: 'Nueva fecha confirmada. Revisa las ventanas de venta antes de activarlas.' };
    });
  }

  private async notifyEventBuyers(tx: Prisma.TransactionClient, eventId: string, title: string, body: string) {
    // One database statement, no per-buyer HTTP calls and no in-memory fan-out.
    await tx.$executeRaw(Prisma.sql`INSERT INTO "Notification" ("id", "userId", "category", "title", "body", "data", "createdAt")
      SELECT gen_random_uuid()::text, buyers."ownerUserId", 'EVENT'::"NotificationCategory", ${title}, ${body}, jsonb_build_object('eventId', ${eventId}::text), NOW()
      FROM (SELECT "ownerUserId" FROM "Ticket" WHERE "eventId" = ${eventId}
        UNION SELECT "ownerUserId" FROM "ConsumableRight" WHERE "eventId" = ${eventId}
        UNION SELECT o."userId" FROM "Order" o JOIN "OrderItem" i ON i."orderId" = o."id"
          WHERE i."eventId" = ${eventId} AND o."status" IN ('PENDING', 'PAID', 'REFUND_PENDING', 'PARTIALLY_REFUNDED')) buyers`);
  }

  async listCancellationRequests(user: AuthenticatedUser) {
    if (user.role !== UserRole.SUPER_ADMIN) throw forbidden('SUPER_ADMIN_REQUIRED', 'Solo Beerry puede revisar cancelaciones.');
    return { cancellations: await this.prisma.eventCancellation.findMany({
      where: { mode: { in: ['REFUND_REQUESTED', 'REFUND_DECLINED'] } },
      orderBy: { createdAt: 'desc' }, take: 100,
      include: { event: { select: { name: true, clubId: true } } },
    }) };
  }

  async requestReplacementRefund(user: AuthenticatedUser, orderItemId: string, input: EventReasonDto) {
    if (input.reason.trim().length < 5) throw badRequest('REASON_REQUIRED', 'Indica por qué no aceptas el reemplazo.');
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findFirst({ where: { id: orderItemId, order: { userId: user.id } }, include: { order: true } });
      if (!item?.eventId) throw notFound('EVENT_PURCHASE_NOT_FOUND', 'No encontramos una compra de evento elegible.');
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${item.orderId} FOR UPDATE`);
      const order = await tx.order.findUniqueOrThrow({ where: { id: item.orderId } });
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "EventCancellation" WHERE "eventId" = ${item.eventId} FOR SHARE`);
      const cancellation = await tx.eventCancellation.findUnique({ where: { eventId: item.eventId } });
      if (!cancellation || cancellation.mode !== 'REPLACEMENT' || cancellation.status !== 'REPLACEMENT_PROPOSED') {
        throw conflict('REPLACEMENT_REQUIRED', 'Esta solicitud solo corresponde a un evento cancelado con reemplazo propuesto.');
      }
      const existing = await tx.eventBuyerRefundRequest.findUnique({ where: { cancellationId_orderItemId: { cancellationId: cancellation.id, orderItemId } } });
      if (existing) return { request: { id: existing.id, status: existing.status } };
      if (order.status !== 'PAID') throw conflict('PURCHASE_NOT_ELIGIBLE', 'La compra debe estar pagada y sin otra devolución en curso.');
      const otherRefund = await tx.refundRequest.findFirst({ where: { orderId: item.orderId, status: { not: 'REJECTED' } }, select: { id: true } });
      if (otherRefund) throw conflict('REFUND_ALREADY_REQUESTED', 'La compra ya tiene una gestión de devolución.');
      const request = await tx.eventBuyerRefundRequest.create({ data: { cancellationId: cancellation.id, orderItemId, reason: input.reason.trim() } });
      const admins = await tx.clubAdmin.findMany({ where: { clubId: item.clubId, user: { status: 'ACTIVE' } }, select: { userId: true } });
      if (admins.length) await tx.notification.createMany({ data: admins.map((admin) => ({ userId: admin.userId, category: 'EVENT' as const,
        title: 'Un comprador no acepta el reemplazo', body: 'Revisa la solicitud individual de devolución. Aceptarla la enviará a Beerry para autorización.',
        data: { eventId: item.eventId, buyerRefundRequestId: request.id },
      })) });
      await tx.auditLogEntry.create({ data: { actorUserId: user.id, clubId: item.clubId, action: 'BUYER_REJECTS_EVENT_REPLACEMENT', resourceType: 'EVENT_BUYER_REFUND', resourceId: request.id, metadata: { orderItemId, cancellationId: cancellation.id } } });
      // No payment/order state mutation: this is a request, not authorization.
      return { request: { id: request.id, status: request.status } };
    });
  }

  async listBuyerRefunds(user: AuthenticatedUser, clubId?: string, eventId?: string) {
    if (clubId && eventId) await this.assertCanManageEvent(user, clubId, eventId);
    else if (user.role !== UserRole.SUPER_ADMIN) throw forbidden('SUPER_ADMIN_REQUIRED', 'Solo Beerry puede revisar esta bandeja.');
    return { requests: await this.prisma.eventBuyerRefundRequest.findMany({
      where: clubId && eventId ? { orderItem: { clubId }, cancellation: { eventId } } : { status: { in: ['PENDING_BEERRY', 'AUTHORIZED', 'REJECTED', 'BUSINESS_DECLINED'] } },
      orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, status: true, reason: true, businessReason: true, beerryReason: true, createdAt: true,
        cancellation: { select: { event: { select: { name: true } } } },
        orderItem: { select: { nameSnapshot: true, quantity: true, totalCents: true } },
      },
    }) };
  }

  async reviewBuyerRefund(user: AuthenticatedUser, id: string, input: ReviewEventCancellationDto, clubId?: string, eventId?: string) {
    const business = !!clubId && !!eventId;
    if (business) await this.assertCanManageEvent(user, clubId!, eventId!);
    else if (user.role !== UserRole.SUPER_ADMIN) throw forbidden('SUPER_ADMIN_REQUIRED', 'Solo Beerry puede autorizar.');
    if (input.reason.trim().length < 5) throw badRequest('REASON_REQUIRED', 'Indica el motivo de la resolución.');
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.eventBuyerRefundRequest.findUnique({ where: { id }, include: { orderItem: true, cancellation: true } });
      if (!current || (business && (current.orderItem.clubId !== clubId || current.cancellation.eventId !== eventId))) throw notFound('REQUEST_NOT_FOUND', 'No encontramos la solicitud.');
      const allowed = business ? ['PENDING_BUSINESS', 'BUSINESS_DECLINED'] : ['PENDING_BEERRY'];
      if (!allowed.includes(current.status)) throw conflict('REQUEST_CHANGED', 'La solicitud no admite esta decisión. Actualiza la pantalla.');
      const status = business ? (input.decision === 'APPROVE' ? 'PENDING_BEERRY' : 'BUSINESS_DECLINED') : (input.decision === 'APPROVE' ? 'AUTHORIZED' : 'REJECTED');
      const result = await tx.eventBuyerRefundRequest.updateMany({ where: { id, status: current.status, updatedAt: current.updatedAt }, data: {
        status, ...(business ? { businessReason: input.reason.trim(), businessReviewedBy: user.id } : { beerryReason: input.reason.trim(), beerryReviewedBy: user.id }),
      } });
      if (result.count !== 1) throw conflict('REQUEST_CHANGED', 'Otra persona ya resolvió la solicitud.');
      const order = await tx.order.findUniqueOrThrow({ where: { id: current.orderItem.orderId }, select: { userId: true } });
      await tx.notification.create({ data: { userId: order.userId, category: 'EVENT', title: 'Actualización de tu solicitud',
        body: status === 'PENDING_BEERRY' ? 'El negocio aceptó la solicitud. Falta la revisión de Beerry.' : 'Tu solicitud tiene una nueva resolución. Consulta tu compra; esto no confirma una devolución de dinero.',
        data: { orderId: current.orderItem.orderId },
      } });
      if (business && status === 'PENDING_BEERRY') {
        const reviewers = await tx.user.findMany({ where: { role: UserRole.SUPER_ADMIN, status: 'ACTIVE' }, select: { id: true } });
        if (reviewers.length) await tx.notification.createMany({ data: reviewers.map((reviewer) => ({ userId: reviewer.id, category: 'EVENT' as const, title: 'Devolución individual pendiente de revisión', body: 'El negocio aceptó una solicitud por rechazo de reemplazo. Se requiere autorización de Beerry.', data: { buyerRefundRequestId: id } })) });
      }
      await tx.auditLogEntry.create({ data: { actorUserId: user.id, clubId: current.orderItem.clubId, action: business ? 'BUSINESS_REVIEWS_EVENT_BUYER_REFUND' : 'BEERRY_REVIEWS_EVENT_BUYER_REFUND', resourceType: 'EVENT_BUYER_REFUND', resourceId: id, metadata: { previousStatus: current.status, status, reason: input.reason.trim() } } });
      return { request: { id, status } };
    });
  }

  async getBusinessCancellation(user: AuthenticatedUser, clubId: string, eventId: string) {
    await this.assertCanManageEvent(user, clubId, eventId);
    const cancellation = await this.prisma.eventCancellation.findUnique({ where: { eventId } });
    return { cancellation, canRequestRefund: !!cancellation &&
      ['CONTACT_REQUIRED', 'REJECTED', 'REPLACEMENT_PROPOSED'].includes(cancellation.status) };
  }

  async requestCancellationRefund(user: AuthenticatedUser, clubId: string, eventId: string, input: EventReasonDto) {
    await this.assertCanManageEvent(user, clubId, eventId);
    if (input.reason.trim().length < 5) throw badRequest('REVIEW_REASON_REQUIRED', 'Indica el motivo de la nueva decisión.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`);
      const current = await tx.eventCancellation.findUnique({ where: { eventId } });
      if (!current || !['CONTACT_REQUIRED', 'REJECTED', 'REPLACEMENT_PROPOSED'].includes(current.status)) {
        throw conflict('CANCELLATION_CHANGED', 'Esta cancelación no admite una nueva solicitud de devolución.');
      }
      const updated = await tx.eventCancellation.updateMany({
        where: { id: current.id, status: current.status, updatedAt: current.updatedAt },
        data: { mode: 'REFUND_REQUESTED', status: 'PENDING_BEERRY', reason: input.reason.trim(),
          requestedByUserId: user.id, reviewedByUserId: null, reviewedAt: null, reviewReason: null },
      });
      if (updated.count !== 1) throw conflict('CANCELLATION_CHANGED', 'La decisión cambió. Actualiza la pantalla.');
      await tx.auditLogEntry.create({ data: {
        actorUserId: user.id, clubId, action: 'RESUBMIT_EVENT_CANCELLATION', resourceType: 'EVENT_CANCELLATION', resourceId: current.id,
        metadata: { previousMode: current.mode, previousStatus: current.status, previousReason: current.reason,
          previousReviewReason: current.reviewReason, reason: input.reason.trim() },
      } });
      const reviewers = await tx.user.findMany({ where: { role: UserRole.SUPER_ADMIN, status: 'ACTIVE' }, select: { id: true } });
      if (reviewers.length) await tx.notification.createMany({ data: reviewers.map((reviewer) => ({
        userId: reviewer.id, category: 'EVENT' as const, title: 'Negocio acepta solicitar devoluciones',
        body: 'Revisa la nueva decisión del negocio antes de autorizar cualquier devolución.',
        data: { eventId, cancellationId: current.id, status: 'PENDING_BEERRY' },
      })) });
      return { cancellation: await tx.eventCancellation.findUniqueOrThrow({ where: { id: current.id } }) };
    });
  }

  async reviewCancellation(user: AuthenticatedUser, id: string, input: ReviewEventCancellationDto) {
    if (user.role !== UserRole.SUPER_ADMIN) throw forbidden('SUPER_ADMIN_REQUIRED', 'Solo Beerry puede revisar cancelaciones.');
    if (input.reason.trim().length < 5) throw badRequest('REVIEW_REASON_REQUIRED', 'Indica el motivo de la decisión.');
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.eventCancellation.findUnique({ where: { id }, include: { event: true } });
      if (!current) throw notFound('CANCELLATION_NOT_FOUND', 'No encontramos la solicitud.');
      // A negative business decision is a contact case, never authorization to refund.
      if (current.mode !== 'REFUND_REQUESTED' || current.status !== 'PENDING_BEERRY') {
        throw conflict('CANCELLATION_NOT_REVIEWABLE', 'El negocio debe aceptar la devolución antes de autorizarla.');
      }
      const status = input.decision === 'APPROVE' ? 'AUTHORIZED' : 'REJECTED';
      const updated = await tx.eventCancellation.updateMany({ where: { id, status: 'PENDING_BEERRY' }, data: {
        status, reviewedByUserId: user.id, reviewedAt: new Date(), reviewReason: input.reason.trim(),
      } });
      if (updated.count !== 1) throw conflict('CANCELLATION_CHANGED', 'La solicitud ya fue revisada.');
      await tx.auditLogEntry.create({ data: {
        actorUserId: user.id, clubId: current.event.clubId, action: 'REVIEW_EVENT_CANCELLATION',
        resourceType: 'EVENT_CANCELLATION', resourceId: id,
        metadata: { status, reason: input.reason.trim() },
      } });
      return { cancellation: await tx.eventCancellation.findUniqueOrThrow({ where: { id } }) };
    });
  }

  private async hasCommercialHistory(tx: Prisma.TransactionClient, eventId: string): Promise<boolean> {
    if (await tx.eventCancellation.findFirst({ where: { replacementEventId: eventId } })) return true;
    if (await tx.eventCancellation.findUnique({ where: { eventId } })) return true;
    const [tickets, promotions, issuedTicket, issuedRight] = await Promise.all([
      tx.ticketType.findMany({ where: { eventId }, select: { id: true } }),
      tx.promotion.findMany({ where: { eventId }, select: { id: true } }),
      tx.ticket.findFirst({ where: { eventId }, select: { id: true } }),
      tx.consumableRight.findFirst({ where: { eventId }, select: { id: true } }),
    ]);
    if (issuedTicket || issuedRight) return true;
    return !!await tx.orderItem.findFirst({ where: { OR: [
      { itemType: 'TICKET', itemId: { in: tickets.map((item) => item.id) } },
      { itemType: 'PROMOTION', itemId: { in: promotions.map((item) => item.id) } },
    ] }, select: { id: true } });
  }

  private async assertCanManageEvent(
    currentUser: AuthenticatedUser,
    clubId: string,
    eventId: string,
  ) {
    await this.assertCanManageClub(currentUser, clubId);

    return this.findEventOrFail(clubId, eventId);
  }

  private async assertCanManageClub(currentUser: AuthenticatedUser, clubId: string) {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
    });

    if (!club) {
      throw notFound('CLUB_NOT_FOUND', 'No encontramos el club solicitado.');
    }

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      return;
    }

    if (currentUser.role !== UserRole.ADMIN) {
      throw forbidden('CLUB_MANAGE_FORBIDDEN', 'No tienes permisos para administrar este club.');
    }

    const clubAdmin = await this.prisma.clubAdmin.findUnique({
      where: {
        clubId_userId: {
          clubId,
          userId: currentUser.id,
        },
      },
    });

    if (!clubAdmin) {
      throw forbidden('CLUB_MANAGE_FORBIDDEN', 'No tienes permisos para administrar este club.');
    }
  }

  private async findEventOrFail(clubId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        clubId,
      },
    });

    if (!event) {
      throw notFound('EVENT_NOT_FOUND', 'No encontramos el evento solicitado.');
    }

    return event;
  }

  private assertTransitionAllowed(currentStatus: EventStatus, allowedStatuses: EventStatus[]) {
    if (!allowedStatuses.includes(currentStatus)) {
      throw badRequest(
        'EVENT_STATUS_TRANSITION_NOT_ALLOWED',
        'El evento no se encuentra en un estado valido para esta accion.',
      );
    }
  }

  private assertImageMutationInput(imageUploadId?: string, removeImage?: boolean) {
    if (imageUploadId && removeImage) {
      throw badRequest(
        'EVENT_IMAGE_INPUT_CONFLICT',
        'No puedes enviar imageUploadId y removeImage al mismo tiempo.',
      );
    }
  }
}

const eventInclude = {
  club: true,
  ticketTypes: {
    orderBy: { createdAt: 'asc' },
  },
} as const;

const adminEventsClubInclude = {
  events: {
    orderBy: { startsAt: 'asc' as const },
    include: eventInclude,
  },
} as const;

const normalizeText = (value: string): string => value.trim();

const normalizeOptionalText = (value?: string): string | null => {
  const normalized = value?.trim();

  return normalized ? normalized : null;
};

const parseEventDates = (startsAtInput: string, endsAtInput: string) => {
  const startsAt = new Date(startsAtInput);
  const endsAt = new Date(endsAtInput);

  if (endsAt.getTime() <= startsAt.getTime()) {
    throw badRequest('EVENT_DATE_RANGE_INVALID', 'La fecha de fin debe ser posterior al inicio.');
  }

  return { startsAt, endsAt };
};

const toEventResponse = async (
  event: {
    id: string;
    clubId: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    startsAt: Date;
    endsAt: Date;
    capacity: number;
    status: EventStatus;
    createdAt: Date;
    updatedAt: Date;
    club: {
      id: string;
      name: string;
      status: ClubStatus;
    };
    ticketTypes?: Array<{
      id: string;
      name: string;
      description: string | null;
      priceCents: number;
      currency: string;
      quantityTotal: number;
      quantitySold: number;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
  },
  config: ConfigService,
  uploadsService: UploadsService,
) => {
  const imageUrl = await uploadsService.createReadableImageUrl(event.imageUrl);
  return {
    id: event.id,
    clubId: event.clubId,
    name: event.name,
    description: event.description,
    imageUrl,
    imageObjectKey: event.imageUrl,
    imagePublicUrl: imageUrl ?? buildMediaUrl(event.imageUrl, config),
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    capacity: event.capacity,
    status: event.status,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    club: {
      id: event.club.id,
      name: event.club.name,
      status: event.club.status,
    },
    ticketTypes: event.ticketTypes?.map(toEventTicketTypeResponse) ?? [],
  };
};

const emptyAdminEventsSummary = () => ({
  activeEvents: 0,
  publishedEvents: 0,
  ticketsSold: 0,
  salesAmount: 0,
  currency: 'PEN',
});

const toAdminEventCard = (
  event: {
    id: string;
    clubId: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    startsAt: Date;
    endsAt: Date;
    capacity: number;
    status: EventStatus;
    createdAt: Date;
    updatedAt: Date;
    club: {
      id: string;
      name: string;
      status: ClubStatus;
    };
    ticketTypes?: Array<{
      id: string;
      name: string;
      description: string | null;
      priceCents: number;
      currency: string;
      quantityTotal: number;
      quantitySold: number;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
  },
  now: Date,
  config: ConfigService,
) => {
  const status = getAdminEventDisplayStatus(event, now);
  const ticketTypes = event.ticketTypes ?? [];
  const sold = ticketTypes.reduce((total, ticket) => total + ticket.quantitySold, 0);
  const salesAmount = ticketTypes.reduce(
    (total, ticket) => total + (ticket.quantitySold * ticket.priceCents) / 100,
    0,
  );
  const ticketCapacity = ticketTypes.reduce((total, ticket) => total + ticket.quantityTotal, 0);
  const capacity = ticketCapacity > 0 ? ticketCapacity : event.capacity;

  return {
    id: event.id,
    name: event.name,
    description: event.description,
    imageUrl: buildMediaUrl(event.imageUrl, config),
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    capacity,
    sold,
    salesAmount,
    currency: 'PEN',
    status,
    rawStatus: event.status,
    progress: capacity > 0 ? sold / capacity : 0,
    ticketTypes: ticketTypes.map(toEventTicketTypeResponse),
  };
};

const toEventTicketTypeResponse = (ticket: {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  quantityTotal: number;
  quantitySold: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: ticket.id,
  name: ticket.name,
  description: ticket.description,
  price: ticket.priceCents / 100,
  currency: ticket.currency,
  quantityTotal: ticket.quantityTotal,
  quantitySold: ticket.quantitySold,
  status: ticket.status,
  createdAt: ticket.createdAt,
  updatedAt: ticket.updatedAt,
});

const getAdminEventDisplayStatus = (
  event: { startsAt: Date; endsAt: Date; status: EventStatus },
  now: Date,
) => {
  if (event.status === EventStatus.CANCELLED || event.status === EventStatus.POSTPONED || event.status === EventStatus.DRAFT) return event.status.toLowerCase();
  if (event.status === EventStatus.FINISHED || event.endsAt.getTime() < now.getTime()) {
    return 'finished';
  }

  if (
    (
      [
        EventStatus.PUBLISHED,
        EventStatus.SALE_ACTIVE,
        EventStatus.SOLD_OUT,
        EventStatus.IN_PROGRESS,
      ] as EventStatus[]
    ).includes(event.status)
  ) {
    return 'active';
  }

  if (event.startsAt.getTime() > now.getTime()) {
    return 'upcoming';
  }

  return event.status.toLowerCase();
};
