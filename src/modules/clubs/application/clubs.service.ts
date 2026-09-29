import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClubOperationalProfile,
  ClubStatus,
  ClubWorkerStatus,
  CommerceItemType,
  EventStatus,
  InventoryReservationStatus,
  Prisma,
  ProductStatus,
  PromotionItemType,
  PromotionStatus,
  SellerConnectionStatus,
  TicketTypeStatus,
  UserRole,
} from '@prisma/client';
import { OfferScope } from '../../../shared/domain/offer-scope';
import {
  buildMediaUrl,
  extractObjectKeyFromUrl,
} from '../../../shared/infrastructure/media/media-url';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { badRequest, forbidden, notFound } from '../../../shared/presentation/api-exception';
import {
  currentEventsWhere,
  effectiveEventStatus,
  eventAllowsSales,
} from '../../events/application/event-availability';
import { FeaturedCampaignsService } from '../../featured-campaigns/application/featured-campaigns.service';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { currentPromotionsWhere } from '../../promotions/application/promotion-availability';
import { UploadsService } from '../../uploads/application/uploads.service';
import { readBusinessType } from '../domain/business-type';
import { CLUB_SCHEDULE_DAYS as scheduleDayOrder } from '../domain/club-profile';
import {
  CustomerClubEmptyReason,
  CustomerCommerceStatus,
  CustomerHomeEmptyReason,
} from '../domain/customer-discovery-status';
import { CreateClubDto } from '../presentation/dto/create-club.dto';
import { CustomerExploreQueryDto } from '../presentation/dto/customer-explore-query.dto';
import { CustomerHomeQueryDto } from '../presentation/dto/customer-home-query.dto';
import { CustomerNearbyCatalogQueryDto } from '../presentation/dto/customer-nearby-catalog-query.dto';
import type {
  CustomerClubDetailResponseDto,
  CustomerExploreResponseDto,
} from '../presentation/customer-discovery.response.dto';
import { UpdateClubOperationalProfileDto } from '../presentation/dto/update-club-operational-profile.dto';
import { UpdateClubDto } from '../presentation/dto/update-club.dto';
import { paymentReadyClubWhere } from './club-commerce-availability';
import {
  readClubAddress,
  readClubContact,
  readClubSchedule,
  readClubSocialMedia,
} from './club-profile';

const CUSTOMER_VISIBLE_EVENT_STATUSES = [
  EventStatus.PUBLISHED,
  EventStatus.SALE_ACTIVE,
  EventStatus.SOLD_OUT,
  EventStatus.IN_PROGRESS,
] as const;
const CUSTOMER_DETAIL_EVENT_STATUSES = [
  ...CUSTOMER_VISIBLE_EVENT_STATUSES,
  EventStatus.FINISHED,
  EventStatus.CANCELLED,
  EventStatus.POSTPONED,
] as const;
const CUSTOMER_PROMOTION_COMPONENTS_WHERE: Prisma.PromotionWhereInput = {
  items: {
    every: {
      OR: [
        { itemType: PromotionItemType.PRODUCT, product: { isNot: null } },
        { itemType: PromotionItemType.TICKET, ticketType: { isNot: null } },
      ],
    },
  },
};
const MERCADO_PAGO_PROVIDER = 'mercado_pago';

@Injectable()
export class ClubsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly uploadsService: UploadsService,
    private readonly featuredCampaigns: FeaturedCampaignsService,
  ) {}

  async createClub(currentUser: AuthenticatedUser, input: CreateClubDto) {
    this.assertCanCreateClub(currentUser);

    const address = normalizeAddress(input.address);
    const contact = normalizeContact(input.contact);
    const socialMedia = normalizeSocialMedia(input.socialMedia);
    const schedule = normalizeSchedule(input.schedule);
    const club = await this.prisma.$transaction(async (tx) => {
      const coverUpload = input.coverImageUploadId
        ? await this.uploadsService.consumeUpload({
            uploadId: input.coverImageUploadId,
            userId: currentUser.id,
            transaction: tx,
          })
        : null;
      const profileUpload = input.profileImageUploadId
        ? await this.uploadsService.consumeUpload({
            uploadId: input.profileImageUploadId,
            userId: currentUser.id,
            transaction: tx,
          })
        : null;

      return tx.club.create({
        data: {
          name: normalizeText(input.name),
          description: normalizeOptionalText(input.description),
          type: input.type,
          addressJson: toNullableJson(address),
          contactJson: toNullableJson(contact),
          coverImageUrl:
            coverUpload?.objectKey ?? extractObjectKeyFromUrl(input.coverImage, this.config),
          profileImageUrl:
            profileUpload?.objectKey ?? extractObjectKeyFromUrl(input.profileImage, this.config),
          socialMediaJson: toNullableJson(socialMedia),
          scheduleJson: toNullableJson(schedule),
          admins: {
            create: {
              userId: currentUser.id,
            },
          },
        },
        include: clubInclude,
      });
    });

    return {
      message: 'Club creado correctamente. Queda pendiente de aprobacion.',
      club: toClubResponse(club, this.config),
    };
  }

  async listClubs(currentUser: AuthenticatedUser) {
    const clubs = await this.prisma.club.findMany({
      where: this.getVisibleClubWhere(currentUser),
      orderBy: { createdAt: 'desc' },
      include: clubInclude,
    });

    return {
      message: 'Clubes obtenidos correctamente.',
      clubs: clubs.map((club) => toClubResponse(club, this.config)),
    };
  }

  async getAdminDashboard(currentUser: AuthenticatedUser) {
    this.assertCanViewAdminDashboard(currentUser);

    const club = await this.findAdminDashboardClub(currentUser);

    if (!club) {
      return {
        message: 'Dashboard admin obtenido correctamente.',
        hasClub: false as const,
        club: null,
        workerContext: null,
        summary: null,
        metrics: null,
        upcomingEvents: [],
        quickActions: [],
        alerts: [],
        latestSales: [],
        topProducts: [],
        topPromotions: [],
        recentActivity: [],
        emptyState: {
          title: 'Aun no tienes una discoteca',
          text: 'Para comenzar a gestionar eventos, vender entradas y ver tus estadisticas, primero debes registrar tu discoteca o club en POINT.',
          actionLabel: 'Crear mi Discoteca o Club',
        },
        features: [
          {
            icon: 'calendar',
            title: 'Gestion de Eventos',
            text: 'Crea y publica tus eventos nocturnos en minutos con herramientas de diseno y programacion.',
          },
          {
            icon: 'sales',
            title: 'Ventas en Tiempo Real',
            text: 'Monitorea tus ingresos y stock de entradas desde cualquier lugar. Moneda local S/ PEN.',
          },
          {
            icon: 'qr',
            title: 'Control de Accesos',
            text: 'Valida QRs de forma rapida y segura con nuestro escaner integrado de alto rendimiento.',
          },
        ],
      };
    }

    const eventCount = await this.prisma.event.count({
      where: { clubId: club.id },
    });

    const now = new Date();
    const activeEventCount = await this.prisma.event.count({
      where: {
        clubId: club.id,
        ...currentEventsWhere(now),
      },
    });

    const productCount = await this.prisma.product.count({
      where: {
        clubId: club.id,
        status: {
          in: [ProductStatus.ACTIVE, ProductStatus.OUT_OF_STOCK],
        },
      },
    });

    const promotionCount = await this.prisma.promotion.count({
      where: {
        clubId: club.id,
        ...currentPromotionsWhere(now),
      },
    });

    const topProducts = await this.prisma.product.findMany({
      where: {
        clubId: club.id,
        status: {
          in: [ProductStatus.ACTIVE, ProductStatus.OUT_OF_STOCK],
        },
      },
      orderBy: [{ stockQuantity: 'desc' }, { updatedAt: 'desc' }],
      take: 5,
    });

    const topPromotions = await this.prisma.promotion.findMany({
      where: {
        clubId: club.id,
        ...currentPromotionsWhere(now),
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 5,
      include: {
        items: true,
      },
    });

    const capacityAggregate = await this.prisma.event.aggregate({
      where: { clubId: club.id },
      _sum: { capacity: true },
    });
    const occupancyAggregate = await this.prisma.eventOccupancy.aggregate({
      where: { event: { clubId: club.id } },
      _sum: { currentCount: true },
    });

    const profileImage = buildMediaUrl(club.profileImageUrl, this.config);
    const coverImage = buildMediaUrl(club.coverImageUrl, this.config);
    const currentWorker = club.workers[0];

    const upcomingEvents = await Promise.all(
      club.events.map(async (event) => {
        const cheapestTicket = event.ticketTypes[0];

        return {
          id: event.id,
          name: event.name,
          imageUrl: await this.uploadsService.createReadableImageUrl(event.imageUrl),
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          capacity: event.capacity,
          sold: cheapestTicket?.quantitySold ?? 0,
          priceFrom: cheapestTicket ? cheapestTicket.priceCents / 100 : 0,
          status: effectiveEventStatus(event, now),
        };
      }),
    );

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const previousStart = new Date(todayStart.getTime() - 86_400_000);
    const [paidSales, previousSales, validatedQr, customers, latestSales, recentActivity] =
      await Promise.all([
        this.prisma.order.aggregate({
          where: { clubId: club.id, status: 'PAID', paidAt: { gte: todayStart } },
          _sum: { totalCents: true },
          _count: true,
        }),
        this.prisma.order.aggregate({
          where: {
            clubId: club.id,
            status: 'PAID',
            paidAt: { gte: previousStart, lt: todayStart },
          },
          _sum: { totalCents: true },
        }),
        this.prisma.qrValidationAttempt.count({
          where: { clubId: club.id, outcome: 'VALID', createdAt: { gte: todayStart } },
        }),
        this.prisma.order.groupBy({ by: ['userId'], where: { clubId: club.id, status: 'PAID' } }),
        this.prisma.order.findMany({
          where: { clubId: club.id },
          include: {
            user: { select: { fullName: true } },
            items: { orderBy: { createdAt: 'asc' } },
            paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        this.prisma.auditLogEntry.findMany({
          where: { clubId: club.id },
          include: { actor: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);
    const currentAmount = paidSales._sum.totalCents ?? 0;
    const previousAmount = previousSales._sum.totalCents ?? 0;
    const salesTrend =
      previousAmount > 0
        ? Math.round(((currentAmount - previousAmount) / previousAmount) * 1000) / 10
        : currentAmount > 0
          ? 100
          : 0;
    const alerts = topProducts
      .filter((product) => product.stockQuantity <= 5)
      .map((product) => ({
        type: product.stockQuantity <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
        severity: product.stockQuantity <= 0 ? 'critical' : 'warning',
        resourceId: product.id,
        title:
          product.stockQuantity <= 0 ? `${product.name} agotado` : `Stock bajo: ${product.name}`,
        value: product.stockQuantity,
      }));

    return {
      message: 'Dashboard admin obtenido correctamente.',
      hasClub: true as const,
      emptyState: null,
      features: [],
      club: {
        id: club.id,
        name: club.name,
        description: club.description,
        type: readBusinessType(club.type),
        status: club.status,
        profileImage,
        coverImage,
        address: readClubAddress(club.addressJson),
        contact: readClubContact(club.contactJson),
        socialMedia: readClubSocialMedia(club.socialMediaJson),
        schedule: readClubSchedule(club.scheduleJson),
      },
      workerContext: currentWorker
        ? {
            id: currentWorker.id,
            clubId: currentWorker.clubId,
            userId: currentWorker.userId,
            roleLabel: currentWorker.roleLabel,
            status: currentWorker.status,
            permissions: currentWorker.permissions,
            createdAt: currentWorker.createdAt,
            updatedAt: currentWorker.updatedAt,
            user: {
              id: currentWorker.user.id,
              fullName: currentWorker.user.fullName,
              phoneCountryCode: currentWorker.user.phoneCountryCode,
              phoneNumber: currentWorker.user.phoneNumber,
              email: currentWorker.user.email,
              role: currentWorker.user.role,
              status: currentWorker.user.status,
            },
          }
        : null,
      summary: {
        capacity: {
          current: occupancyAggregate._sum.currentCount ?? 0,
          total: capacityAggregate._sum.capacity ?? 0,
        },
        counts: {
          events: eventCount,
          activeEvents: activeEventCount,
          promotions: promotionCount,
          products: productCount,
        },
      },
      metrics: {
        sales: {
          amount: currentAmount / 100,
          currency: 'PEN',
          trendPercent: salesTrend,
        },
        purchases: paidSales._count,
        validatedQr,
        customers: customers.length,
      },
      upcomingEvents,
      quickActions: [
        { key: 'create_event', label: 'Crear Evento', icon: 'calendar' },
        { key: 'create_promo', label: 'Crear Promo', icon: 'tag' },
        { key: 'create_product', label: 'Crear Prod.', icon: 'box' },
        { key: 'scan_qr', label: 'Escanear QR', icon: 'qr' },
        { key: 'manage_staff', label: 'Gestionar Pers.', icon: 'badge' },
        { key: 'reports', label: 'Ver Reportes', icon: 'chart' },
      ],
      alerts,
      latestSales: latestSales.map((order) => ({
        id: order.id,
        customerName: order.user.fullName,
        amount: order.totalCents / 100,
        amountCents: order.totalCents,
        currency: order.currency,
        status: order.status,
        paymentStatus: order.paymentAttempts[0]?.status ?? null,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        category: order.items[0]?.itemType ?? ('MIXED' as const),
        items: order.items.map((item) => ({
          id: item.id,
          type: item.itemType,
          name: item.nameSnapshot,
          quantity: item.quantity,
          totalCents: item.totalCents,
        })),
      })),
      topProducts: topProducts.map((product) => ({
        id: product.id,
        name: product.name,
        stockQuantity: product.stockQuantity,
        price: product.priceCents / 100,
        currency: product.currency,
        status: product.status,
        imageUrl: buildMediaUrl(product.imageUrl, this.config),
      })),
      topPromotions: topPromotions.map((promotion) => ({
        id: promotion.id,
        name: promotion.name,
        finalPrice: promotion.finalPriceCents / 100,
        currency: promotion.currency,
        status: promotion.status,
        itemsCount: promotion.items.length,
        imageUrl: buildMediaUrl(promotion.imageUrl, this.config),
      })),
      recentActivity: recentActivity.map((entry) => ({
        id: entry.id,
        actorName: entry.actor.fullName,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        createdAt: entry.createdAt,
      })),
    };
  }

  async getCustomerHome(
    currentUser: AuthenticatedUser,
    query: CustomerHomeQueryDto,
    now = new Date(),
  ) {
    return this.buildCustomerDiscovery(currentUser, query, now, null);
  }

  private async buildCustomerDiscovery(
    currentUser: AuthenticatedUser,
    query: CustomerHomeQueryDto,
    now: Date,
    category: 'clubs' | 'events' | 'promotions' | null,
  ) {
    const location = normalizeCustomerLocationQuery(query);
    const clubs = await this.findCustomerVisibleClubs(location);
    const clubIds = clubs.map((club) => club.id);

    if (clubIds.length === 0) {
      const payload = {
        message: 'Home del cliente obtenido correctamente.',
        location,
        hasResults: false as const,
        clubs: [],
        events: [],
        promotions: [],
        counts: {
          clubs: 0,
          paymentReadyClubs: 0,
          paymentsUnavailableClubs: 0,
          events: 0,
          promotions: 0,
        },
        emptyReasons: buildCustomerHomeEmptyReasons(0, 0, 0, 0),
      };
      return {
        ...payload,
        featuredItems: [],
        viewer: {
          id: currentUser.id,
          role: currentUser.role,
        },
      };
    }

    const paymentReadyClubs = await this.prisma.club.findMany({
      where: { id: { in: clubIds }, ...paymentReadyClubWhere(now) },
      select: { id: true },
    });
    const paymentReadyClubIds = paymentReadyClubs.map((club) => club.id);
    const paymentReadyClubIdSet = new Set(paymentReadyClubIds);

    const visibleEventWhere: Prisma.EventWhereInput = {
      clubId: { in: paymentReadyClubIds },
      status: { in: [...CUSTOMER_VISIBLE_EVENT_STATUSES] },
      endsAt: { gt: now },
    };
    const catalogEventWhere: Prisma.EventWhereInput = {
      clubId: { in: paymentReadyClubIds },
      OR: [visibleEventWhere, { status: EventStatus.POSTPONED }],
    };
    const visiblePromotionWhere: Prisma.PromotionWhereInput = {
      clubId: { in: paymentReadyClubIds },
      status: PromotionStatus.ACTIVE,
      ...CUSTOMER_PROMOTION_COMPONENTS_WHERE,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        {
          OR: [
            { eventId: null },
            {
              event: {
                status: { in: [...CUSTOMER_VISIBLE_EVENT_STATUSES] },
                endsAt: { gt: now },
              },
            },
          ],
        },
      ],
    };
    const visibleProductWhere: Prisma.ProductWhereInput = {
      clubId: { in: paymentReadyClubIds },
      status: ProductStatus.ACTIVE,
    };
    const visibleTicketWhere: Prisma.TicketTypeWhereInput = {
      clubId: { in: paymentReadyClubIds },
      status: { in: [TicketTypeStatus.ACTIVE, TicketTypeStatus.SOLD_OUT] },
      OR: [
        { eventId: null },
        {
          event: {
            status: { in: [...CUSTOMER_VISIBLE_EVENT_STATUSES] },
            endsAt: { gt: now },
          },
        },
      ],
    };

    const [events, promotions, eventCounts, promotionCounts, productCounts, ticketCounts] =
      await Promise.all([
        this.prisma.event.findMany({
          where: catalogEventWhere,
          include: {
            club: true,
            ticketTypes: true,
          },
        }),
        this.prisma.promotion.findMany({
          where: visiblePromotionWhere,
          include: {
            club: true,
            event: true,
            items: { include: { product: true, ticketType: true }, orderBy: { id: 'asc' } },
          },
        }),
        this.prisma.event.groupBy({
          by: ['clubId'],
          where: catalogEventWhere,
          _count: { _all: true },
        }),
        this.prisma.promotion.groupBy({
          by: ['clubId'],
          where: visiblePromotionWhere,
          _count: { _all: true },
        }),
        this.prisma.product.groupBy({
          by: ['clubId'],
          where: visibleProductWhere,
          _count: { _all: true },
        }),
        this.prisma.ticketType.groupBy({
          by: ['clubId'],
          where: visibleTicketWhere,
          _count: { _all: true },
        }),
      ]);
    const clubsWithContent = new Set([
      ...eventCounts.map((row) => row.clubId),
      ...promotionCounts.map((row) => row.clubId),
      ...productCounts.map((row) => row.clubId),
      ...ticketCounts.map((row) => row.clubId),
    ]);
    const ticketTypeIds = events.flatMap((event) => event.ticketTypes.map((ticket) => ticket.id));
    const reservedTickets =
      ticketTypeIds.length > 0
        ? await this.prisma.inventoryReservation.groupBy({
            by: ['resourceId'],
            where: {
              resourceType: CommerceItemType.TICKET,
              resourceId: { in: ticketTypeIds },
              status: InventoryReservationStatus.ACTIVE,
              expiresAt: { gt: now },
            },
            _sum: { quantity: true },
          })
        : [];
    const reservedByTicketId = new Map(
      reservedTickets.map((row) => [row.resourceId, row._sum.quantity ?? 0]),
    );
    const availabilityByEventId = new Map(
      events.map((event) => [event.id, homeEventAvailability(event, now, reservedByTicketId)]),
    );
    const night = homeNightWindow(now);
    const rankedEvents = events
      .filter((event) => event.status !== EventStatus.POSTPONED)
      .sort(
        (left, right) =>
          eventHomeGroup(left, now, night) - eventHomeGroup(right, now, night) ||
          homeAccessRank(availabilityByEventId.get(left.id)!.accessStatus) -
            homeAccessRank(availabilityByEventId.get(right.id)!.accessStatus) ||
          left.startsAt.getTime() - right.startsAt.getTime() ||
          left.id.localeCompare(right.id),
      );
    const catalogEvents = [
      ...rankedEvents,
      ...events
        .filter((event) => event.status === EventStatus.POSTPONED)
        .sort(
          (left, right) =>
            left.startsAt.getTime() - right.startsAt.getTime() || left.id.localeCompare(right.id),
        ),
    ];
    const immediateEventClubIds = new Set(
      rankedEvents
        .filter((event) => eventHomeGroup(event, now, night) < 2)
        .map((event) => event.clubId),
    );
    const rankedPromotions = promotions.sort(
      (left, right) =>
        Number(!left.event || eventHomeGroup(left.event, now, night) >= 2) -
          Number(!right.event || eventHomeGroup(right.event, now, night) >= 2) ||
        (left.endsAt?.getTime() ?? Number.POSITIVE_INFINITY) -
          (right.endsAt?.getTime() ?? Number.POSITIVE_INFINITY) ||
        left.id.localeCompare(right.id),
    );
    const clubsWithOffers = new Set(rankedPromotions.map((promotion) => promotion.clubId));
    const rankedClubs = clubs.sort((left, right) => {
      const group = (club: typeof left) => {
        if (!paymentReadyClubIdSet.has(club.id)) return 4;
        if (immediateEventClubIds.has(club.id)) return 0;
        if (isClubOpenNow(club.scheduleJson, now) && clubsWithOffers.has(club.id)) return 1;
        return clubsWithContent.has(club.id) ? 2 : 3;
      };
      return (
        group(left) - group(right) ||
        left.name.localeCompare(right.name, 'es') ||
        left.id.localeCompare(right.id)
      );
    });

    const payload = {
      message: 'Home del cliente obtenido correctamente.',
      location,
      hasResults: true as const,
      clubs: await Promise.all(
        (category === 'clubs' ? rankedClubs : category ? [] : rankedClubs.slice(0, 3)).map(
          async (club) => ({
            id: club.id,
            name: club.name,
            description: club.description,
            type: readBusinessType(club.type),
            profileImage: await this.uploadsService.createReadableImageUrl(club.profileImageUrl),
            coverImage: await this.uploadsService.createReadableImageUrl(club.coverImageUrl),
            address: toLocationAddress(club.addressJson),
            contact: readClubContact(club.contactJson),
            schedule: toScheduleSummary(club.scheduleJson),
            isOpenNow: isClubOpenNow(club.scheduleJson, now),
            status: club.status,
            commerceStatus: paymentReadyClubIdSet.has(club.id)
              ? CustomerCommerceStatus.AVAILABLE
              : CustomerCommerceStatus.PAYMENTS_UNAVAILABLE,
            emptyReason: !paymentReadyClubIdSet.has(club.id)
              ? CustomerClubEmptyReason.PAYMENTS_UNAVAILABLE
              : clubsWithContent.has(club.id)
                ? null
                : CustomerClubEmptyReason.NO_EVENTS_OR_OFFERS,
          }),
        ),
      ),
      events: await Promise.all(
        (category === 'events' ? catalogEvents : category ? [] : rankedEvents.slice(0, 3)).map(
          async (event) => {
            const availability = availabilityByEventId.get(event.id)!;
            return {
              id: event.id,
              clubId: event.clubId,
              clubName: event.club.name,
              name: event.name,
              description: event.description,
              imageUrl: await this.uploadsService.createReadableImageUrl(event.imageUrl),
              startsAt: event.startsAt,
              endsAt: event.endsAt,
              status: effectiveEventStatus(event, now),
              capacity: event.capacity,
              sold: event.ticketTypes.reduce((sum, ticket) => sum + ticket.quantitySold, 0),
              available: event.status === EventStatus.POSTPONED ? 0 : availability.available,
              accessStatus:
                event.status === EventStatus.POSTPONED
                  ? ('UNAVAILABLE' as const)
                  : availability.accessStatus,
              timing:
                event.status === EventStatus.POSTPONED
                  ? ('POSTPONED' as const)
                  : eventHomeGroup(event, now, night) === 0
                    ? ('ONGOING' as const)
                    : eventHomeGroup(event, now, night) === 1
                      ? ('TONIGHT' as const)
                      : ('FUTURE' as const),
              priceFrom: availability.cheapestTicket
                ? availability.cheapestTicket.priceCents / 100
                : null,
              currency: availability.cheapestTicket?.currency ?? 'PEN',
            };
          },
        ),
      ),
      promotions: await Promise.all(
        (category === 'promotions'
          ? rankedPromotions
          : category
            ? []
            : rankedPromotions.slice(0, 6)
        ).map(async (promotion) => ({
          id: promotion.id,
          clubId: promotion.clubId,
          clubName: promotion.club.name,
          eventId: promotion.eventId,
          eventName: promotion.event?.name ?? null,
          name: promotion.name,
          description: promotion.description,
          imageUrl: await this.uploadsService.createReadableImageUrl(promotion.imageUrl),
          finalPrice: promotion.finalPriceCents / 100,
          currency: promotion.currency,
          startsAt: promotion.startsAt,
          endsAt: promotion.endsAt,
          status: promotion.status,
          itemsCount: promotion.items.length,
          items: promotionComponents(promotion.items),
          scope: promotion.eventId ? OfferScope.EVENT : OfferScope.CLUB,
        })),
      ),
      counts: {
        clubs: clubs.length,
        paymentReadyClubs: paymentReadyClubIds.length,
        paymentsUnavailableClubs: clubs.length - paymentReadyClubIds.length,
        events: catalogEvents.length,
        promotions: rankedPromotions.length,
      },
      emptyReasons: buildCustomerHomeEmptyReasons(
        clubs.length,
        paymentReadyClubIds.length,
        rankedEvents.length,
        promotions.length,
      ),
    };
    return {
      ...payload,
      featuredItems: category
        ? []
        : await this.featuredCampaigns.selectForHome({
            viewerUserId: currentUser.id,
            clubIds,
            now,
          }),
      viewer: {
        id: currentUser.id,
        role: currentUser.role,
      },
    };
  }

  getCustomerNearbyCatalog(
    currentUser: AuthenticatedUser,
    category: 'clubs',
    query: CustomerNearbyCatalogQueryDto,
    requestNow?: Date,
  ): Promise<NearbyPage<CustomerHomeResponse['clubs'][number]>>;
  getCustomerNearbyCatalog(
    currentUser: AuthenticatedUser,
    category: 'events',
    query: CustomerNearbyCatalogQueryDto,
    requestNow?: Date,
  ): Promise<NearbyPage<CustomerHomeResponse['events'][number]>>;
  getCustomerNearbyCatalog(
    currentUser: AuthenticatedUser,
    category: 'promotions',
    query: CustomerNearbyCatalogQueryDto,
    requestNow?: Date,
  ): Promise<NearbyPage<CustomerHomeResponse['promotions'][number]>>;
  async getCustomerNearbyCatalog(
    currentUser: AuthenticatedUser,
    category: 'clubs' | 'events' | 'promotions',
    query: CustomerNearbyCatalogQueryDto,
    requestNow = new Date(),
  ) {
    const location = normalizeCustomerLocationQuery(query);
    let now = requestNow;
    let afterId: string | null = null;
    if (query.cursor) {
      try {
        const decoded: unknown = JSON.parse(
          Buffer.from(query.cursor, 'base64url').toString('utf8'),
        );
        if (
          !isNearbyCursor(decoded) ||
          decoded.category !== category ||
          decoded.location.district !== location.district ||
          decoded.location.province !== location.province ||
          decoded.location.department !== location.department ||
          Date.parse(decoded.asOf) > requestNow.getTime() ||
          requestNow.getTime() - Date.parse(decoded.asOf) > 10 * 60_000
        ) {
          throw new Error('Invalid cursor');
        }
        now = new Date(decoded.asOf);
        afterId = decoded.afterId;
      } catch {
        throw badRequest('INVALID_NEARBY_CURSOR', 'La continuación del catálogo no es válida.');
      }
    }

    const discovery = await this.buildCustomerDiscovery(currentUser, location, now, category);
    const allItems = discovery[category];
    const start = afterId ? allItems.findIndex((item) => item.id === afterId) + 1 : 0;
    if (afterId && start === 0) {
      throw badRequest(
        'INVALID_NEARBY_CURSOR',
        'La continuación del catálogo ya no está disponible.',
      );
    }
    const limit = query.limit ?? 20;
    const items = allItems.slice(start, start + limit);
    const last = items.at(-1);
    const nextCursor =
      last && start + items.length < allItems.length
        ? Buffer.from(
            JSON.stringify({
              version: 1,
              category,
              location,
              asOf: now.toISOString(),
              afterId: last.id,
            }),
          ).toString('base64url')
        : null;
    return { location, total: allItems.length, items, nextCursor };
  }

  async exploreCustomerContent(
    currentUser: AuthenticatedUser,
    query: CustomerExploreQueryDto,
  ): Promise<CustomerExploreResponse> {
    const search = query.q ?? '';
    const page = query.page ?? 1;
    const pageSize = 30;
    const offset = (page - 1) * pageSize;
    const now = new Date();
    const matchingClub: Prisma.ClubWhereInput | undefined = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { type: { contains: search, mode: 'insensitive' } },
            ...(
              ['direccion', 'distrito', 'provincia', 'departamento', 'pais', 'location'] as const
            ).map((field): Prisma.ClubWhereInput => ({
              addressJson: { path: [field], string_contains: search, mode: 'insensitive' },
            })),
          ],
        }
      : undefined;
    const clubRows = await this.prisma.club.findMany({
      where: { status: ClubStatus.ACTIVE, ...matchingClub },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: offset,
      take: pageSize + 1,
    });
    const activeClubs = clubRows.slice(0, pageSize);
    const matchedClubIds = activeClubs.map((club) => club.id);
    const clubRelationFilter = paymentReadyClubWhere(now);

    const [eventRows, promotionRows, productRows] = await Promise.all([
      this.prisma.event.findMany({
        where: {
          club: clubRelationFilter,
          status: { in: [...CUSTOMER_VISIBLE_EVENT_STATUSES] },
          endsAt: { gt: now },
          OR: search
            ? [
                { club: matchingClub },
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ]
            : undefined,
        },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        skip: offset,
        take: pageSize + 1,
        include: {
          club: true,
          ticketTypes: {
            where: { status: { in: [TicketTypeStatus.ACTIVE, TicketTypeStatus.SOLD_OUT] } },
            orderBy: { priceCents: 'asc' },
            take: 1,
          },
        },
      }),
      this.prisma.promotion.findMany({
        where: {
          club: clubRelationFilter,
          status: PromotionStatus.ACTIVE,
          ...CUSTOMER_PROMOTION_COMPONENTS_WHERE,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
            { OR: [{ eventId: null }, { event: currentEventsWhere(now) }] },
            ...(search
              ? [
                  {
                    OR: [
                      { club: matchingClub },
                      { name: { contains: search, mode: 'insensitive' } },
                      { description: { contains: search, mode: 'insensitive' } },
                    ],
                  } satisfies Prisma.PromotionWhereInput,
                ]
              : []),
          ],
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: offset,
        take: pageSize + 1,
        include: {
          club: true,
          event: true,
          items: { include: { product: true, ticketType: true }, orderBy: { id: 'asc' } },
        },
      }),
      this.prisma.product.findMany({
        where: {
          club: clubRelationFilter,
          status: ProductStatus.ACTIVE,
          OR: search
            ? [
                { club: matchingClub },
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ]
            : undefined,
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: offset,
        take: pageSize + 1,
        include: { club: true },
      }),
    ]);

    const events = eventRows.slice(0, pageSize);
    const promotions = promotionRows.slice(0, pageSize);
    const products = productRows.slice(0, pageSize);
    const nextPage =
      clubRows.length > pageSize ||
      eventRows.length > pageSize ||
      promotionRows.length > pageSize ||
      productRows.length > pageSize
        ? page + 1
        : null;

    const referencedClubIds = new Set([
      ...matchedClubIds,
      ...events.map((item) => item.clubId),
      ...promotions.map((item) => item.clubId),
      ...products.map((item) => item.clubId),
    ]);
    const extraClubIds = [...referencedClubIds].filter((id) => !matchedClubIds.includes(id));
    const extraClubs = extraClubIds.length
      ? await this.prisma.club.findMany({
          where: { id: { in: extraClubIds }, status: ClubStatus.ACTIVE },
        })
      : [];
    const clubs = [...activeClubs, ...extraClubs];

    return {
      message: 'Exploración nacional obtenida correctamente.',
      nextPage,
      query: search,
      scope: 'PERU',
      location: { district: '', province: '', department: '' },
      hasResults: clubs.length + events.length + promotions.length + products.length > 0,
      clubs: await Promise.all(
        clubs.map(async (club) => ({
          id: club.id,
          name: club.name,
          description: club.description,
          type: readBusinessType(club.type),
          profileImage: await this.uploadsService.createReadableImageUrl(club.profileImageUrl),
          coverImage: await this.uploadsService.createReadableImageUrl(club.coverImageUrl),
          address: toLocationAddress(club.addressJson),
          contact: readClubContact(club.contactJson),
          schedule: toScheduleSummary(club.scheduleJson),
          isOpenNow: isClubOpenNow(club.scheduleJson, now),
          status: club.status,
        })),
      ),
      events: await Promise.all(
        events.map(async (event) => ({
          id: event.id,
          clubId: event.clubId,
          clubName: event.club.name,
          name: event.name,
          description: event.description,
          imageUrl: await this.uploadsService.createReadableImageUrl(event.imageUrl),
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          status: effectiveEventStatus(event, now),
          capacity: event.capacity,
          sold: event.ticketTypes[0]?.quantitySold ?? 0,
          priceFrom: event.ticketTypes[0] ? event.ticketTypes[0].priceCents / 100 : null,
          currency: event.ticketTypes[0]?.currency ?? 'PEN',
        })),
      ),
      tickets: [],
      promotions: await Promise.all(
        promotions.map(async (promotion) => ({
          id: promotion.id,
          clubId: promotion.clubId,
          clubName: promotion.club.name,
          eventId: promotion.eventId,
          eventName: promotion.event?.name ?? null,
          name: promotion.name,
          description: promotion.description,
          imageUrl: await this.uploadsService.createReadableImageUrl(promotion.imageUrl),
          finalPrice: promotion.finalPriceCents / 100,
          currency: promotion.currency,
          status: promotion.status,
          itemsCount: promotion.items.length,
          items: promotionComponents(promotion.items),
          scope: promotion.eventId ? OfferScope.EVENT : OfferScope.CLUB,
        })),
      ),
      products: await Promise.all(
        products.map(async (product) => ({
          id: product.id,
          clubId: product.clubId,
          clubName: product.club.name,
          name: product.name,
          description: product.description,
          imageUrl: await this.uploadsService.createReadableImageUrl(product.imageUrl),
          price: product.priceCents / 100,
          currency: product.currency,
          stockQuantity: product.stockQuantity,
          status: product.status,
        })),
      ),
      emptyState: null,
      viewer: { id: currentUser.id, role: currentUser.role },
    };
  }

  async getCustomerClubDetail(
    currentUser: AuthenticatedUser,
    clubId: string,
  ): Promise<CustomerClubDetailResponse> {
    const now = new Date();
    const club = await this.prisma.club.findFirst({
      where: {
        id: clubId,
        status: ClubStatus.ACTIVE,
      },
    });

    if (!club) {
      throw notFound('CLUB_NOT_FOUND', 'Discoteca no encontrada o no disponible.');
    }

    const paymentReady = Boolean(
      await this.prisma.marketplaceSellerConnection.findFirst({
        where: {
          clubId,
          provider: MERCADO_PAGO_PROVIDER,
          status: SellerConnectionStatus.CONNECTED,
          OR: [{ tokenExpiresAt: null }, { tokenExpiresAt: { gt: now } }],
        },
        select: { id: true },
      }),
    );
    const paidContentClubIds = paymentReady ? [clubId] : [];

    const [events, promotions, products, tickets] = await Promise.all([
      this.prisma.event.findMany({
        where: {
          clubId: { in: paidContentClubIds },
          status: { in: [...CUSTOMER_VISIBLE_EVENT_STATUSES] },
          endsAt: { gt: now },
        },
        orderBy: { startsAt: 'asc' },
        include: {
          club: true,
          ticketTypes: {
            where: { status: { in: [TicketTypeStatus.ACTIVE, TicketTypeStatus.SOLD_OUT] } },
            orderBy: { priceCents: 'asc' },
            take: 1,
          },
        },
      }),
      this.prisma.promotion.findMany({
        where: {
          clubId: { in: paidContentClubIds },
          status: PromotionStatus.ACTIVE,
          ...CUSTOMER_PROMOTION_COMPONENTS_WHERE,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
            {
              OR: [
                { eventId: null },
                {
                  event: {
                    status: { in: [...CUSTOMER_VISIBLE_EVENT_STATUSES] },
                    endsAt: { gt: now },
                  },
                },
              ],
            },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        include: {
          club: true,
          event: true,
          items: { include: { product: true, ticketType: true }, orderBy: { id: 'asc' } },
        },
      }),
      this.prisma.product.findMany({
        where: {
          clubId: { in: paidContentClubIds },
          status: ProductStatus.ACTIVE,
        },
        orderBy: { updatedAt: 'desc' },
        include: { club: true },
      }),
      this.prisma.ticketType.findMany({
        where: {
          clubId: { in: paidContentClubIds },
          status: { in: [TicketTypeStatus.ACTIVE, TicketTypeStatus.SOLD_OUT] },
          OR: [
            { eventId: null },
            {
              event: {
                status: { in: [...CUSTOMER_VISIBLE_EVENT_STATUSES] },
                endsAt: { gt: now },
              },
            },
          ],
        },
        orderBy: { priceCents: 'asc' },
        include: { club: true, event: true },
      }),
    ]);

    return {
      message: 'Detalle de la discoteca obtenido correctamente.',
      location: {
        district: toLocationAddress(club.addressJson).distrito,
        province: toLocationAddress(club.addressJson).provincia,
        department: toLocationAddress(club.addressJson).departamento,
      },
      hasResults: true as const,
      clubs: [
        {
          id: club.id,
          name: club.name,
          description: club.description,
          type: readBusinessType(club.type),
          profileImage: await this.uploadsService.createReadableImageUrl(club.profileImageUrl),
          coverImage: await this.uploadsService.createReadableImageUrl(club.coverImageUrl),
          address: toLocationAddress(club.addressJson),
          contact: readClubContact(club.contactJson),
          schedule: toScheduleSummary(club.scheduleJson),
          isOpenNow: isClubOpenNow(club.scheduleJson, now),
          status: club.status,
          commerceStatus: paymentReady
            ? CustomerCommerceStatus.AVAILABLE
            : CustomerCommerceStatus.PAYMENTS_UNAVAILABLE,
          emptyReason: !paymentReady
            ? CustomerClubEmptyReason.PAYMENTS_UNAVAILABLE
            : events.length === 0 &&
                promotions.length === 0 &&
                products.length === 0 &&
                tickets.length === 0
              ? CustomerClubEmptyReason.NO_EVENTS_OR_OFFERS
              : null,
        },
      ],
      events: await Promise.all(
        events.map(async (event) => ({
          id: event.id,
          clubId: event.clubId,
          clubName: event.club.name,
          name: event.name,
          description: event.description,
          imageUrl: await this.uploadsService.createReadableImageUrl(event.imageUrl),
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          status: effectiveEventStatus(event, now),
          capacity: event.capacity,
          sold: event.ticketTypes[0]?.quantitySold ?? 0,
          priceFrom: event.ticketTypes[0] ? event.ticketTypes[0].priceCents / 100 : null,
          currency: event.ticketTypes[0]?.currency ?? 'PEN',
        })),
      ),
      tickets: await Promise.all(
        tickets.map(async (ticket) => ({
          id: ticket.id,
          clubId: ticket.clubId,
          clubName: ticket.club.name,
          eventId: ticket.eventId,
          eventName: ticket.event?.name ?? null,
          imageUrl: await this.uploadsService.createReadableImageUrl(ticket.event?.imageUrl),
          name: ticket.name,
          description: ticket.description,
          price: ticket.priceCents / 100,
          currency: ticket.currency,
          quantityAvailable: Math.max(
            ticket.quantityTotal - ticket.quantitySold - ticket.replacementReserved,
            0,
          ),
          perUserLimit: ticket.perUserLimit,
          saleStartAt: ticket.saleStartAt,
          saleEndAt: ticket.saleEndAt,
          status: ticket.status,
        })),
      ),
      promotions: await Promise.all(
        promotions.map(async (promotion) => ({
          id: promotion.id,
          clubId: promotion.clubId,
          clubName: promotion.club.name,
          eventId: promotion.eventId,
          eventName: promotion.event?.name ?? null,
          name: promotion.name,
          description: promotion.description,
          imageUrl: await this.uploadsService.createReadableImageUrl(promotion.imageUrl),
          finalPrice: promotion.finalPriceCents / 100,
          currency: promotion.currency,
          startsAt: promotion.startsAt,
          endsAt: promotion.endsAt,
          status: promotion.status,
          itemsCount: promotion.items.length,
          items: promotionComponents(promotion.items),
          scope: promotion.eventId ? OfferScope.EVENT : OfferScope.CLUB,
        })),
      ),
      products: await Promise.all(
        products.map(async (product) => ({
          id: product.id,
          clubId: product.clubId,
          clubName: product.club.name,
          name: product.name,
          description: product.description,
          imageUrl: await this.uploadsService.createReadableImageUrl(product.imageUrl),
          price: product.priceCents / 100,
          currency: product.currency,
          stockQuantity: product.stockQuantity,
          status: product.status,
        })),
      ),
      emptyState: null,
      viewer: { id: currentUser.id, role: currentUser.role },
    };
  }

  async getCustomerEventDetail(currentUser: AuthenticatedUser, eventId: string) {
    const now = new Date();
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        status: { in: [...CUSTOMER_DETAIL_EVENT_STATUSES] },
        club: paymentReadyClubWhere(now),
      },
      include: {
        club: true,
        ticketTypes: {
          where: { status: { in: [TicketTypeStatus.ACTIVE, TicketTypeStatus.SOLD_OUT] } },
          orderBy: { priceCents: 'asc' },
        },
        promotions: {
          where: {
            status: PromotionStatus.ACTIVE,
            ...CUSTOMER_PROMOTION_COMPONENTS_WHERE,
            AND: [
              { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
              { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
            ],
          },
          orderBy: { updatedAt: 'desc' },
          include: {
            items: { include: { product: true, ticketType: true }, orderBy: { id: 'asc' } },
          },
        },
      },
    });
    if (!event) throw notFound('EVENT_NOT_FOUND', 'Evento no encontrado o no disponible.');

    const club = event.club;
    return {
      message: 'Detalle del evento obtenido correctamente.',
      viewer: { id: currentUser.id, role: currentUser.role },
      event: {
        id: event.id,
        clubId: event.clubId,
        clubName: club.name,
        name: event.name,
        description: event.description,
        imageUrl: await this.uploadsService.createReadableImageUrl(event.imageUrl),
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        status: effectiveEventStatus(event, now),
        priceFrom: event.ticketTypes[0]?.priceCents ? event.ticketTypes[0].priceCents / 100 : null,
        currency: event.ticketTypes[0]?.currency ?? 'PEN',
      },
      club: {
        id: club.id,
        name: club.name,
        description: club.description,
        type: readBusinessType(club.type),
        profileImage: await this.uploadsService.createReadableImageUrl(club.profileImageUrl),
        coverImage: await this.uploadsService.createReadableImageUrl(club.coverImageUrl),
        address: toLocationAddress(club.addressJson),
        contact: readClubContact(club.contactJson),
        schedule: toScheduleSummary(club.scheduleJson),
        isOpenNow: isClubOpenNow(club.scheduleJson, now),
        status: club.status,
      },
      tickets: await Promise.all(
        event.ticketTypes.map(async (ticket) => {
          const [reserved, alreadyOwned] = await Promise.all([
            this.prisma.inventoryReservation.aggregate({
              where: {
                resourceType: 'TICKET',
                resourceId: ticket.id,
                status: 'ACTIVE',
                expiresAt: { gt: now },
              },
              _sum: { quantity: true },
            }),
            ticket.perUserLimit
              ? this.prisma.ticket.count({
                  where: { ownerUserId: currentUser.id, ticketTypeId: ticket.id },
                })
              : Promise.resolve(0),
          ]);
          return {
            id: ticket.id,
            clubId: ticket.clubId,
            clubName: club.name,
            eventId: event.id,
            eventName: event.name,
            imageUrl: await this.uploadsService.createReadableImageUrl(event.imageUrl),
            name: ticket.name,
            description: ticket.description,
            price: ticket.priceCents / 100,
            currency: ticket.currency,
            quantityAvailable: Math.max(
              ticket.quantityTotal -
                ticket.quantitySold -
                (ticket.replacementReserved ?? 0) -
                (reserved._sum.quantity ?? 0),
              0,
            ),
            perUserLimit: ticket.perUserLimit,
            remainingUserLimit: ticket.perUserLimit
              ? Math.max(ticket.perUserLimit - alreadyOwned, 0)
              : null,
            saleStartAt: ticket.saleStartAt,
            saleEndAt: ticket.saleEndAt,
            status: ticket.status,
          };
        }),
      ),
      promotions: await Promise.all(
        event.promotions.map(async (promotion) => ({
          id: promotion.id,
          clubId: promotion.clubId,
          clubName: club.name,
          eventId: event.id,
          eventName: event.name,
          name: promotion.name,
          description: promotion.description,
          imageUrl: await this.uploadsService.createReadableImageUrl(promotion.imageUrl),
          finalPrice: promotion.finalPriceCents / 100,
          currency: promotion.currency,
          status: promotion.status,
          itemsCount: promotion.items.length,
          items: promotionComponents(promotion.items),
          scope: OfferScope.EVENT,
          startsAt: promotion.startsAt,
          endsAt: promotion.endsAt,
        })),
      ),
    };
  }

  async getClub(currentUser: AuthenticatedUser, clubId: string) {
    const club = await this.findVisibleClubOrFail(currentUser, clubId);

    return {
      message: 'Club obtenido correctamente.',
      club: toClubResponse(club, this.config),
    };
  }

  async updateClub(currentUser: AuthenticatedUser, clubId: string, input: UpdateClubDto) {
    await this.assertCanManageClub(currentUser, clubId);
    const previousClub = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: { coverImageUrl: true, profileImageUrl: true },
    });
    if (!previousClub) {
      throw notFound('CLUB_NOT_FOUND', 'No encontramos el club solicitado.');
    }

    const data: Prisma.ClubUpdateInput = {};

    if (input.name !== undefined) {
      data.name = normalizeText(input.name);
    }

    if (input.description !== undefined) {
      data.description = normalizeOptionalText(input.description);
    }

    if (input.type !== undefined) {
      data.type = input.type;
    }

    if (input.address !== undefined) {
      const address = normalizeAddress(input.address);
      data.addressJson = toNullableJson(address);
    }

    if (input.contact !== undefined) {
      const contact = normalizeContact(input.contact);
      data.contactJson = toNullableJson(contact);
    }

    if (input.coverImage !== undefined) {
      data.coverImageUrl = extractObjectKeyFromUrl(input.coverImage, this.config);
    }

    if (input.profileImage !== undefined) {
      const profileImageUrl = extractObjectKeyFromUrl(input.profileImage, this.config);
      data.profileImageUrl = profileImageUrl;
    }

    if (input.socialMedia !== undefined) {
      data.socialMediaJson = toNullableJson(normalizeSocialMedia(input.socialMedia));
    }

    if (input.schedule !== undefined) {
      data.scheduleJson = toNullableJson(normalizeSchedule(input.schedule));
    }

    const club = await this.prisma.$transaction(async (tx) => {
      if (input.coverImageUploadId) {
        const upload = await this.uploadsService.replaceUpload({
          uploadId: input.coverImageUploadId,
          userId: currentUser.id,
          previousObjectKey: previousClub.coverImageUrl,
          transaction: tx,
        });
        data.coverImageUrl = upload.objectKey;
      }
      if (input.profileImageUploadId) {
        const upload = await this.uploadsService.replaceUpload({
          uploadId: input.profileImageUploadId,
          userId: currentUser.id,
          previousObjectKey: previousClub.profileImageUrl,
          transaction: tx,
        });
        data.profileImageUrl = upload.objectKey;
      }
      return tx.club.update({
        where: { id: clubId },
        data,
        include: clubInclude,
      });
    });

    return {
      message: 'Club actualizado correctamente.',
      club: toClubResponse(club, this.config),
    };
  }

  async activateClub(currentUser: AuthenticatedUser, clubId: string) {
    this.assertSuperAdmin(currentUser);
    await this.findClubOrFail(clubId);

    const club = await this.prisma.club.update({
      where: { id: clubId },
      data: { status: ClubStatus.ACTIVE },
      include: clubInclude,
    });

    return {
      message: 'Club activado correctamente.',
      club: toClubResponse(club, this.config),
    };
  }

  async getOperationalProfile(currentUser: AuthenticatedUser, clubId: string) {
    await this.assertCanManageClub(currentUser, clubId);
    const profile = await this.prisma.clubOperationalProfile.findUnique({ where: { clubId } });
    return { profile: profile ? toOperationalProfileResponse(profile) : null };
  }

  async updateOperationalProfile(
    currentUser: AuthenticatedUser,
    clubId: string,
    input: UpdateClubOperationalProfileDto,
  ) {
    await this.assertCanManageClub(currentUser, clubId);
    const clean = (value: string | null | undefined) => value?.trim() || null;
    const profile = await this.prisma.clubOperationalProfile.upsert({
      where: { clubId },
      create: {
        clubId,
        refundPolicy: clean(input.refundPolicy),
        responsibleName: clean(input.responsibleName),
        responsibleEmail: clean(input.responsibleEmail),
        responsiblePhone: clean(input.responsiblePhone),
        approvalDocumentUploadIds: input.approvalDocumentUploadIds ?? [],
      },
      update: {
        ...(input.refundPolicy !== undefined ? { refundPolicy: clean(input.refundPolicy) } : {}),
        ...(input.responsibleName !== undefined
          ? { responsibleName: clean(input.responsibleName) }
          : {}),
        ...(input.responsibleEmail !== undefined
          ? { responsibleEmail: clean(input.responsibleEmail) }
          : {}),
        ...(input.responsiblePhone !== undefined
          ? { responsiblePhone: clean(input.responsiblePhone) }
          : {}),
        ...(input.approvalDocumentUploadIds !== undefined
          ? { approvalDocumentUploadIds: input.approvalDocumentUploadIds }
          : {}),
      },
    });
    await this.prisma.auditLogEntry.create({
      data: {
        actorUserId: currentUser.id,
        clubId,
        action: 'UPDATE_OPERATIONAL_PROFILE',
        resourceType: 'CLUB',
        resourceId: clubId,
      },
    });
    return {
      message: 'Configuración operativa actualizada.',
      profile: toOperationalProfileResponse(profile),
    };
  }

  async deactivateClub(currentUser: AuthenticatedUser, clubId: string) {
    this.assertSuperAdmin(currentUser);
    await this.findClubOrFail(clubId);

    const club = await this.prisma.club.update({
      where: { id: clubId },
      data: { status: ClubStatus.INACTIVE },
      include: clubInclude,
    });

    return {
      message: 'Club desactivado correctamente.',
      club: toClubResponse(club, this.config),
    };
  }

  private assertCanCreateClub(currentUser: AuthenticatedUser) {
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw forbidden('CLUB_CREATE_FORBIDDEN', 'No tienes permisos para crear clubes.');
    }
  }

  private assertCanViewAdminDashboard(currentUser: AuthenticatedUser) {
    if (
      currentUser.role !== UserRole.ADMIN &&
      currentUser.role !== UserRole.SUPER_ADMIN &&
      currentUser.role !== UserRole.WORKER
    ) {
      throw forbidden(
        'ADMIN_DASHBOARD_FORBIDDEN',
        'No tienes permisos para consultar el dashboard admin.',
      );
    }
  }

  private assertSuperAdmin(currentUser: AuthenticatedUser) {
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      throw forbidden('SUPER_ADMIN_REQUIRED', 'Solo un Super Admin puede realizar esta accion.');
    }
  }

  private async assertCanManageClub(currentUser: AuthenticatedUser, clubId: string) {
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      await this.findClubOrFail(clubId);
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

  private getVisibleClubWhere(currentUser: AuthenticatedUser) {
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      return {};
    }

    if (currentUser.role === UserRole.ADMIN) {
      return {
        admins: {
          some: {
            userId: currentUser.id,
          },
        },
      };
    }

    return {
      status: ClubStatus.ACTIVE,
    };
  }

  private async findAdminDashboardClub(currentUser: AuthenticatedUser) {
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      return this.prisma.club.findFirst({
        orderBy: { createdAt: 'asc' },
        include: buildAdminDashboardClubInclude(currentUser.id),
      });
    }

    if (currentUser.role === UserRole.WORKER) {
      const relation = await this.prisma.clubWorker.findFirst({
        where: {
          userId: currentUser.id,
          status: ClubWorkerStatus.ACTIVE,
        },
        orderBy: { createdAt: 'asc' },
        include: {
          club: {
            include: buildAdminDashboardClubInclude(currentUser.id),
          },
        },
      });

      return relation?.club ?? null;
    }

    const relation = await this.prisma.clubAdmin.findFirst({
      where: {
        userId: currentUser.id,
      },
      orderBy: { createdAt: 'asc' },
      include: {
        club: {
          include: buildAdminDashboardClubInclude(currentUser.id),
        },
      },
    });

    return relation?.club ?? null;
  }

  private async findVisibleClubOrFail(currentUser: AuthenticatedUser, clubId: string) {
    const club = await this.prisma.club.findFirst({
      where: {
        id: clubId,
        ...this.getVisibleClubWhere(currentUser),
      },
      include: clubInclude,
    });

    if (!club) {
      throw notFound('CLUB_NOT_FOUND', 'No encontramos el club solicitado.');
    }

    return club;
  }

  private async findCustomerVisibleClubs(location: {
    district: string;
    province: string;
    department: string;
  }) {
    const clubs = await this.prisma.club.findMany({
      where: { status: ClubStatus.ACTIVE },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: customerHomeClubSelect,
    });

    return clubs.filter(
      (club) =>
        equalsNormalized(readClubAddress(club.addressJson).pais, 'Peru') &&
        matchesLocationQuery(club.addressJson, location),
    );
  }

  private async findClubOrFail(clubId: string) {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
    });

    if (!club) {
      throw notFound('CLUB_NOT_FOUND', 'No encontramos el club solicitado.');
    }

    return club;
  }
}

type CustomerHomeResponse = Awaited<ReturnType<ClubsService['getCustomerHome']>>;
type NearbyPage<T> = {
  location: CustomerHomeResponse['location'];
  total: number;
  items: T[];
  nextCursor: string | null;
};
const isNearbyCursor = (
  value: unknown,
): value is {
  version: 1;
  category: 'clubs' | 'events' | 'promotions';
  location: { district: string; province: string; department: string };
  asOf: string;
  afterId: string;
} => {
  if (!value || typeof value !== 'object') return false;
  const cursor = value as Record<string, unknown>;
  const location = cursor.location;
  return (
    cursor.version === 1 &&
    (cursor.category === 'clubs' ||
      cursor.category === 'events' ||
      cursor.category === 'promotions') &&
    typeof cursor.asOf === 'string' &&
    Number.isFinite(Date.parse(cursor.asOf)) &&
    typeof cursor.afterId === 'string' &&
    cursor.afterId.length > 0 &&
    !!location &&
    typeof location === 'object' &&
    ['district', 'province', 'department'].every(
      (key) => typeof (location as Record<string, unknown>)[key] === 'string',
    )
  );
};

const promotionComponents = (
  items: Array<{
    itemType: PromotionItemType;
    product: { name: string } | null;
    ticketType: { name: string } | null;
    quantity: number;
  }>,
) =>
  items.map((item) => {
    const name =
      item.itemType === PromotionItemType.PRODUCT ? item.product?.name : item.ticketType?.name;
    if (!name) throw new Error('La Promoción contiene un componente sin nombre.');
    return { type: item.itemType, name, quantity: item.quantity };
  });
type CustomerExploreResponse = CustomerExploreResponseDto;
type CustomerClubDetailResponse = CustomerClubDetailResponseDto;

const clubInclude = {
  admins: {
    include: {
      user: true,
    },
  },
} as const;

const customerHomeClubSelect = {
  id: true,
  name: true,
  description: true,
  type: true,
  addressJson: true,
  contactJson: true,
  coverImageUrl: true,
  profileImageUrl: true,
  scheduleJson: true,
  status: true,
} as const;

const normalizeText = (value: string): string => value.trim();

const normalizeOptionalText = (value?: string | null): string | null => {
  const normalized = value?.trim();

  return normalized ? normalized : null;
};

const toNullableJson = (
  value: Prisma.InputJsonValue | null,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput => value ?? Prisma.JsonNull;

const normalizeAddress = (value?: CreateClubDto['address']): Record<string, string | number> => ({
  direccion: value?.direccion?.trim() ?? '',
  distrito: value?.distrito?.trim() ?? '',
  provincia: value?.provincia?.trim() ?? '',
  departamento: value?.departamento?.trim() ?? '',
  pais: value?.pais?.trim() || 'Perú',
  ...(value?.latitude != null ? { latitude: value.latitude } : {}),
  ...(value?.longitude != null ? { longitude: value.longitude } : {}),
});

const normalizeCustomerLocationQuery = (query: CustomerHomeQueryDto) => ({
  district: query.district?.trim() ?? '',
  province: query.province?.trim() ?? '',
  department: query.department?.trim() ?? '',
});

const normalizeContact = (contact?: CreateClubDto['contact']): Record<string, string> => ({
  phone: contact?.phone?.trim() ?? '',
  email: contact?.email?.trim().toLowerCase() ?? '',
});

const normalizeSocialMedia = (
  socialMedia?: CreateClubDto['socialMedia'],
): Array<Record<string, string>> | null => {
  const normalized =
    socialMedia
      ?.map((item) =>
        removeEmptyStringValues({
          type: item.type,
          url: item.url,
        }),
      )
      .filter((item) => item.type && item.url) ?? [];

  return normalized.length > 0 ? normalized : null;
};

const normalizeSchedule = (
  schedule?: CreateClubDto['schedule'],
): Array<Record<string, string | boolean>> => {
  const valuesByDay = new Map(schedule?.map((item) => [item.day, item]) ?? []);

  return scheduleDayOrder.map((day) => {
    const item = valuesByDay.get(day);

    return {
      day,
      isOpen: item?.isOpen ?? false,
      openTime: item?.openTime?.trim() ?? '',
      closeTime: item?.closeTime?.trim() ?? '',
    };
  });
};

const removeEmptyStringValues = (
  value: Record<string, string | undefined>,
): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    const trimmed = item?.trim();
    if (trimmed) result[key] = trimmed;
  }
  return result;
};

const toLocationAddress = (value: Prisma.JsonValue | null) => {
  const address = parseAddressJson(value);
  return {
    direccion: address.direccion,
    distrito: address.distrito,
    provincia: address.provincia,
    departamento: address.departamento,
    pais: address.pais,
  };
};

const parseAddressJson = readClubAddress;

const toScheduleSummary = (value: Prisma.JsonValue | null) => {
  const entries = parseScheduleJson(value);
  return entries.map((entry) => ({
    day: entry.day,
    isOpen: entry.isOpen,
    openTime: entry.openTime,
    closeTime: entry.closeTime,
  }));
};

const parseScheduleJson = readClubSchedule;

const isClubOpenNow = (value: Prisma.JsonValue | null, now: Date) => {
  const entries = parseScheduleJson(value);
  if (entries.length === 0) {
    return false;
  }

  const limaNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const dayIndex = (limaNow.getUTCDay() + 6) % 7;
  const currentMinutes = limaNow.getUTCHours() * 60 + limaNow.getUTCMinutes();
  const today = scheduleDayOrder[dayIndex];
  const yesterday = scheduleDayOrder[(dayIndex + 6) % 7];
  if (!today || !yesterday) return false;
  const todayEntry = entries.find((entry) => entry.day === today) ?? emptyScheduleEntry(today);
  const yesterdayEntry =
    entries.find((entry) => entry.day === yesterday) ?? emptyScheduleEntry(yesterday);

  return (
    isOpenWithinEntry(todayEntry, currentMinutes) ||
    isOpenFromPreviousEntry(yesterdayEntry, currentMinutes)
  );
};

type HomeEventTime = { startsAt: Date; endsAt: Date };
type HomeEventTickets = HomeEventTime & {
  status: EventStatus;
  ticketTypes: Array<{
    id: string;
    status: TicketTypeStatus;
    quantityTotal: number;
    quantitySold: number;
    replacementReserved: number;
    saleStartAt: Date | null;
    saleEndAt: Date | null;
    priceCents: number;
    currency: string;
  }>;
};

const homeNightWindow = (now: Date) => {
  // America/Lima is UTC-05:00; the window changes at 06:00 local time.
  const lima = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const day = lima.getUTCHours() < 6 ? lima.getUTCDate() - 1 : lima.getUTCDate();
  return {
    start: new Date(Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), day, 23)),
    end: new Date(Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), day + 1, 11)),
  };
};

const eventHomeGroup = (
  event: HomeEventTime,
  now: Date,
  night: ReturnType<typeof homeNightWindow>,
) =>
  event.startsAt <= now && event.endsAt > now
    ? 0
    : event.startsAt < night.end && event.endsAt > night.start
      ? 1
      : 2;

const homeEventAvailability = (
  event: HomeEventTickets,
  now: Date,
  reserved: ReadonlyMap<string, number>,
) => {
  const active = event.ticketTypes.filter((ticket) => ticket.status === TicketTypeStatus.ACTIVE);
  const physicalRemaining = (ticket: (typeof active)[number]) =>
    Math.max(ticket.quantityTotal - ticket.quantitySold - ticket.replacementReserved, 0);
  const remaining = (ticket: (typeof active)[number]) =>
    Math.max(physicalRemaining(ticket) - (reserved.get(ticket.id) ?? 0), 0);
  const stocked = active.reduce((sum, ticket) => sum + physicalRemaining(ticket), 0);
  const sellable = eventAllowsSales(event, now)
    ? active.filter(
        (ticket) =>
          (!ticket.saleStartAt || ticket.saleStartAt <= now) &&
          (!ticket.saleEndAt || ticket.saleEndAt > now) &&
          remaining(ticket) > 0,
      )
    : [];
  const available = sellable.reduce((sum, ticket) => sum + remaining(ticket), 0);
  const soldOut = event.status === EventStatus.SOLD_OUT || (active.length > 0 && stocked === 0);
  const accessStatus = soldOut
    ? ('SOLD_OUT' as const)
    : event.ticketTypes.length === 0
      ? ('INFORMATIONAL' as const)
      : available > 0
        ? ('AVAILABLE' as const)
        : ('UNAVAILABLE' as const);
  const cheapestTicket = sellable.sort(
    (left, right) => left.priceCents - right.priceCents || left.id.localeCompare(right.id),
  )[0];
  return { available, accessStatus, cheapestTicket };
};

const homeAccessRank = (status: ReturnType<typeof homeEventAvailability>['accessStatus']) =>
  status === 'SOLD_OUT' ? 2 : status === 'UNAVAILABLE' ? 1 : 0;

const emptyScheduleEntry = (day: string) => ({
  day,
  isOpen: false,
  openTime: '',
  closeTime: '',
});

const isOpenWithinEntry = (
  entry: { isOpen: boolean; openTime: string; closeTime: string },
  currentMinutes: number,
) => {
  if (!entry.isOpen) {
    return false;
  }

  const openMinutes = parseHourMinutes(entry.openTime);
  const closeMinutes = parseHourMinutes(entry.closeTime);
  if (openMinutes == null || closeMinutes == null) {
    return false;
  }

  if (closeMinutes > openMinutes) {
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  }

  return currentMinutes >= openMinutes;
};

const isOpenFromPreviousEntry = (
  entry: { isOpen: boolean; openTime: string; closeTime: string },
  currentMinutes: number,
) => {
  if (!entry.isOpen) {
    return false;
  }

  const openMinutes = parseHourMinutes(entry.openTime);
  const closeMinutes = parseHourMinutes(entry.closeTime);
  if (openMinutes == null || closeMinutes == null) {
    return false;
  }

  if (closeMinutes <= openMinutes) {
    return currentMinutes < closeMinutes;
  }

  return false;
};

const parseHourMinutes = (value: string) => {
  const parts = value.split(':');
  if (parts.length != 2) {
    return null;
  }

  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  return hour * 60 + minute;
};

const matchesLocationQuery = (
  value: Prisma.JsonValue | null,
  location: { district: string; province: string; department: string },
) => {
  if (!location.district && !location.province && !location.department) {
    return true;
  }

  const address = parseAddressJson(value);
  const localityMatches = [
    location.district ? equalsNormalized(address.distrito, location.district) : false,
    location.province ? equalsNormalized(address.provincia, location.province) : false,
  ];

  if (location.district || location.province) {
    return localityMatches.some(Boolean);
  }

  return location.department ? equalsNormalized(address.departamento, location.department) : true;
};

const equalsNormalized = (left: string, right: string) =>
  normalizeComparable(left) === normalizeComparable(right);

const normalizeComparable = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

const buildCustomerHomeEmptyReasons = (
  clubCount: number,
  paymentReadyClubCount: number,
  eventCount: number,
  promotionCount: number,
) => ({
  clubs: clubCount === 0 ? CustomerHomeEmptyReason.NO_ACTIVE_CLUBS_IN_SCOPE : null,
  events:
    eventCount > 0
      ? null
      : clubCount === 0
        ? CustomerHomeEmptyReason.NO_ACTIVE_CLUBS_IN_SCOPE
        : paymentReadyClubCount === 0
          ? CustomerHomeEmptyReason.PAYMENTS_UNAVAILABLE
          : CustomerHomeEmptyReason.NO_VISIBLE_EVENTS,
  promotions:
    promotionCount > 0
      ? null
      : clubCount === 0
        ? CustomerHomeEmptyReason.NO_ACTIVE_CLUBS_IN_SCOPE
        : paymentReadyClubCount === 0
          ? CustomerHomeEmptyReason.PAYMENTS_UNAVAILABLE
          : CustomerHomeEmptyReason.NO_ACTIVE_PROMOTIONS,
});

const buildAdminDashboardClubInclude = (currentUserId: string) => ({
  admins: {
    include: {
      user: true,
    },
  },
  workers: {
    where: {
      userId: currentUserId,
    },
    take: 1,
    include: {
      user: true,
    },
  },
  events: {
    where: currentEventsWhere(),
    orderBy: { startsAt: 'asc' as const },
    take: 6,
    include: {
      ticketTypes: {
        where: {
          status: {
            in: [TicketTypeStatus.ACTIVE, TicketTypeStatus.SOLD_OUT],
          },
        },
        orderBy: { priceCents: 'asc' as const },
        take: 1,
      },
    },
  },
});

const toClubResponse = (
  club: {
    id: string;
    name: string;
    description: string | null;
    type: string;
    addressJson: Prisma.JsonValue | null;
    contactJson: Prisma.JsonValue | null;
    coverImageUrl: string | null;
    profileImageUrl: string | null;
    socialMediaJson: Prisma.JsonValue | null;
    scheduleJson: Prisma.JsonValue | null;
    status: ClubStatus;
    createdAt: Date;
    updatedAt: Date;
    admins?: Array<{
      user: {
        id: string;
        fullName: string;
        phoneCountryCode: string;
        phoneNumber: string;
        email: string | null;
        profileImageUrl: string | null;
      };
    }>;
  },
  config: ConfigService,
) => ({
  id: club.id,
  name: club.name,
  description: club.description,
  type: readBusinessType(club.type),
  coverImage: buildMediaUrl(club.coverImageUrl, config),
  coverImageObjectKey: club.coverImageUrl,
  profileImage: buildMediaUrl(club.profileImageUrl, config),
  profileImageObjectKey: club.profileImageUrl,
  address: readClubAddress(club.addressJson),
  contact: readClubContact(club.contactJson),
  socialMedia: readClubSocialMedia(club.socialMediaJson),
  schedule: readClubSchedule(club.scheduleJson),
  status: club.status,
  createdAt: club.createdAt,
  updatedAt: club.updatedAt,
  admins: (club.admins ?? []).map((admin) => ({
    id: admin.user.id,
    fullName: admin.user.fullName,
    phoneCountryCode: admin.user.phoneCountryCode,
    phoneNumber: admin.user.phoneNumber,
    email: admin.user.email,
    profileImage: buildMediaUrl(admin.user.profileImageUrl, config),
  })),
});

function toOperationalProfileResponse(profile: ClubOperationalProfile) {
  return {
    ...profile,
    approvalDocumentUploadIds: Array.isArray(profile.approvalDocumentUploadIds)
      ? profile.approvalDocumentUploadIds.filter(
          (value): value is string => typeof value === 'string',
        )
      : [],
  };
}
