import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClubStatus, EventStatus, RedeemableStatus, UserRole } from '@prisma/client';
import { buildMediaUrl } from '../../../shared/infrastructure/media/media-url';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { badRequest, forbidden, notFound } from '../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { UploadsService } from '../../uploads/application/uploads.service';
import { CreateEventDto } from '../presentation/dto/create-event.dto';
import { UpdateEventDto } from '../presentation/dto/update-event.dto';

const PUBLIC_EVENT_STATUSES = [
  EventStatus.PUBLISHED,
  EventStatus.SALE_ACTIVE,
  EventStatus.SOLD_OUT,
  EventStatus.IN_PROGRESS,
];

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
        club: { status: ClubStatus.ACTIVE },
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
        club: { status: ClubStatus.ACTIVE },
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

      return tx.event.update({
        where: { id: eventId },
        data,
        include: eventInclude,
      });
    });

    return {
      message: 'Evento actualizado correctamente.',
      event: await toEventResponse(event, this.config, this.uploadsService),
    };
  }

  async publishEvent(currentUser: AuthenticatedUser, clubId: string, eventId: string) {
    const event = await this.assertCanManageEvent(currentUser, clubId, eventId);
    this.assertTransitionAllowed(event.status, [EventStatus.DRAFT, EventStatus.POSTPONED]);

    return this.updateEventStatus(
      eventId,
      EventStatus.PUBLISHED,
      'Evento publicado correctamente.',
    );
  }

  async startSale(currentUser: AuthenticatedUser, clubId: string, eventId: string) {
    const event = await this.assertCanManageEvent(currentUser, clubId, eventId);
    this.assertTransitionAllowed(event.status, [EventStatus.PUBLISHED]);

    return this.updateEventStatus(
      eventId,
      EventStatus.SALE_ACTIVE,
      'Venta activada correctamente.',
    );
  }

  async cancelEvent(currentUser: AuthenticatedUser, clubId: string, eventId: string) {
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
    );
  }

  async reactivateEvent(currentUser: AuthenticatedUser, clubId: string, eventId: string) {
    const event = await this.assertCanManageEvent(currentUser, clubId, eventId);
    this.assertTransitionAllowed(event.status, [EventStatus.CANCELLED]);

    return this.updateEventStatus(
      eventId,
      EventStatus.PUBLISHED,
      'Evento reactivado correctamente.',
    );
  }

  async finishEvent(currentUser: AuthenticatedUser, clubId: string, eventId: string) {
    const event = await this.assertCanManageEvent(currentUser, clubId, eventId);
    this.assertTransitionAllowed(event.status, [EventStatus.IN_PROGRESS, EventStatus.SALE_ACTIVE]);

    return this.updateEventStatus(
      eventId,
      EventStatus.FINISHED,
      'Evento finalizado correctamente.',
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

  private async updateEventStatus(eventId: string, status: EventStatus, message: string) {
    const event = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({
        where: { id: eventId },
        data: { status },
        include: eventInclude,
      });
      if (status === EventStatus.CANCELLED) {
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
      }
      return updated;
    });

    return {
      message,
      event: await toEventResponse(event, this.config, this.uploadsService),
    };
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
