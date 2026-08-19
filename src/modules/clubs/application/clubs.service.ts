import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClubStatus,
  EventStatus,
  Prisma,
  ProductStatus,
  PromotionStatus,
  TicketTypeStatus,
  UserRole,
} from '@prisma/client';
import {
  buildMediaUrl,
  extractObjectKeyFromUrl,
} from '../../../shared/infrastructure/media/media-url';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { forbidden, notFound } from '../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { UploadsService } from '../../uploads/application/uploads.service';
import { CreateClubDto } from '../presentation/dto/create-club.dto';
import { CustomerHomeQueryDto } from '../presentation/dto/customer-home-query.dto';
import { CustomerExploreQueryDto } from '../presentation/dto/customer-explore-query.dto';
import { UpdateClubDto } from '../presentation/dto/update-club.dto';
import { UpdateClubOperationalProfileDto } from '../presentation/dto/update-club-operational-profile.dto';

const CUSTOMER_VISIBLE_EVENT_STATUSES = [
  EventStatus.PUBLISHED,
  EventStatus.SALE_ACTIVE,
  EventStatus.SOLD_OUT,
  EventStatus.IN_PROGRESS,
] as const;
// Customer discovery must reflect newly activated clubs and published events.
// Keep the cache effectively disabled until mutation-driven invalidation exists.
const CUSTOMER_HOME_CACHE_TTL_MS = 0;
const customerHomeCache = new Map<
  string,
  { expiresAt: number; payload: Record<string, unknown> }
>();

@Injectable()
export class ClubsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly uploadsService: UploadsService,
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
          type: normalizeBusinessType(input.type),
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
        hasClub: false,
        club: null,
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

    const activeEventCount = await this.prisma.event.count({
      where: {
        clubId: club.id,
        status: {
          in: [
            EventStatus.PUBLISHED,
            EventStatus.SALE_ACTIVE,
            EventStatus.SOLD_OUT,
            EventStatus.IN_PROGRESS,
          ],
        },
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
        status: PromotionStatus.ACTIVE,
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
        status: PromotionStatus.ACTIVE,
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
          status: event.status,
        };
      }),
    );

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const previousStart = new Date(todayStart.getTime() - 86_400_000);
    const [paidSales, previousSales, validatedQr, customers, latestSales, recentActivity] =
      await Promise.all([
        this.prisma.order.aggregate({ where: { clubId: club.id, status: 'PAID', paidAt: { gte: todayStart } }, _sum: { totalCents: true }, _count: true }),
        this.prisma.order.aggregate({ where: { clubId: club.id, status: 'PAID', paidAt: { gte: previousStart, lt: todayStart } }, _sum: { totalCents: true } }),
        this.prisma.qrValidationAttempt.count({ where: { clubId: club.id, outcome: 'VALID', createdAt: { gte: todayStart } } }),
        this.prisma.order.groupBy({ by: ['userId'], where: { clubId: club.id, status: 'PAID' } }),
        this.prisma.order.findMany({
          where: { clubId: club.id },
          include: { user: { select: { fullName: true } }, items: { orderBy: { createdAt: 'asc' } }, paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } },
          orderBy: { createdAt: 'desc' }, take: 10,
        }),
        this.prisma.auditLogEntry.findMany({ where: { clubId: club.id }, include: { actor: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 10 }),
      ]);
    const currentAmount = paidSales._sum.totalCents ?? 0;
    const previousAmount = previousSales._sum.totalCents ?? 0;
    const salesTrend = previousAmount > 0
      ? Math.round(((currentAmount - previousAmount) / previousAmount) * 1000) / 10
      : currentAmount > 0 ? 100 : 0;
    const alerts = topProducts.filter((product) => product.stockQuantity <= 5).map((product) => ({
      type: product.stockQuantity <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
      severity: product.stockQuantity <= 0 ? 'critical' : 'warning',
      resourceId: product.id,
      title: product.stockQuantity <= 0 ? `${product.name} agotado` : `Stock bajo: ${product.name}`,
      value: product.stockQuantity,
    }));

    return {
      message: 'Dashboard admin obtenido correctamente.',
      hasClub: true,
      club: {
        id: club.id,
        name: club.name,
        description: club.description,
        type: club.type,
        status: club.status,
        profileImage,
        coverImage,
        address: club.addressJson ?? {},
        contact: club.contactJson ?? {},
        socialMedia: club.socialMediaJson ?? [],
        schedule: club.scheduleJson ?? [],
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
        category: order.items[0]?.itemType ?? 'MIXED',
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

  async getCustomerHome(currentUser: AuthenticatedUser, query: CustomerHomeQueryDto) {
    const location = normalizeCustomerLocationQuery(query);
    const now = new Date();
    const cacheKey = customerHomeCacheKey(location);
    const cached = customerHomeCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...cached.payload,
        viewer: {
          id: currentUser.id,
          role: currentUser.role,
        },
      };
    }

    const clubs = await this.findCustomerVisibleClubs(location);
    const clubIds = clubs.map((club) => club.id);

    if (clubIds.length === 0) {
      const payload = {
        message: 'Home del cliente obtenido correctamente.',
        location,
        hasResults: false,
        clubs: [],
        events: [],
        tickets: [],
        promotions: [],
        products: [],
        emptyState: buildCustomerHomeEmptyState(location),
      };
      customerHomeCache.set(cacheKey, {
        expiresAt: Date.now() + CUSTOMER_HOME_CACHE_TTL_MS,
        payload,
      });
      return {
        ...payload,
        viewer: {
          id: currentUser.id,
          role: currentUser.role,
        },
      };
    }

    const [events, promotions, products, tickets] = await Promise.all([
      this.prisma.event.findMany({
        where: {
          clubId: { in: clubIds },
          status: { in: [...CUSTOMER_VISIBLE_EVENT_STATUSES] },
          endsAt: { gte: now },
        },
        orderBy: [{ startsAt: 'asc' }],
        take: 12,
        include: {
          club: true,
          ticketTypes: {
            where: {
              status: {
                in: [TicketTypeStatus.ACTIVE, TicketTypeStatus.SOLD_OUT],
              },
            },
            orderBy: [{ priceCents: 'asc' }],
            take: 1,
          },
        },
      }),
      this.prisma.promotion.findMany({
        where: {
          clubId: { in: clubIds },
          status: PromotionStatus.ACTIVE,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
            {
              OR: [
                { eventId: null },
                {
                  event: {
                    status: { in: [...CUSTOMER_VISIBLE_EVENT_STATUSES] },
                    endsAt: { gte: now },
                  },
                },
              ],
            },
          ],
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: 12,
        include: {
          club: true,
          event: true,
          items: true,
        },
      }),
      this.prisma.product.findMany({
        where: {
          clubId: { in: clubIds },
          status: ProductStatus.ACTIVE,
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: 12,
        include: {
          club: true,
        },
      }),
      this.prisma.ticketType.findMany({
        where: {
          clubId: { in: clubIds },
          status: { in: [TicketTypeStatus.ACTIVE, TicketTypeStatus.SOLD_OUT] },
          OR: [
            { eventId: null },
            {
              event: {
                status: { in: [...CUSTOMER_VISIBLE_EVENT_STATUSES] },
                endsAt: { gte: now },
              },
            },
          ],
        },
        orderBy: [{ priceCents: 'asc' }],
        take: 40,
        include: { club: true, event: true },
      }),
    ]);

    const payload = {
      message: 'Home del cliente obtenido correctamente.',
      location,
      hasResults: true,
      clubs: await Promise.all(
        clubs.slice(0, 8).map(async (club) => ({
          id: club.id,
          name: club.name,
          description: club.description,
          type: club.type,
          profileImage: await this.uploadsService.createReadableImageUrl(club.profileImageUrl),
          coverImage: await this.uploadsService.createReadableImageUrl(club.coverImageUrl),
          address: toLocationAddress(club.addressJson),
          contact: club.contactJson ?? {},
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
          status: event.status,
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
          quantityAvailable: Math.max(ticket.quantityTotal - ticket.quantitySold, 0),
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
          scope: promotion.eventId ? 'EVENT' : 'CLUB',
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
    };
    customerHomeCache.set(cacheKey, {
      expiresAt: Date.now() + CUSTOMER_HOME_CACHE_TTL_MS,
      payload,
    });
    return {
      ...payload,
      viewer: {
        id: currentUser.id,
        role: currentUser.role,
      },
    };
  }

  async exploreCustomerContent(currentUser: AuthenticatedUser, query: CustomerExploreQueryDto) {
    const search = query.q.trim();
    const now = new Date();
    const searchPattern = `%${search}%`;
    const matchedClubRows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Club"
      WHERE "status" = 'ACTIVE'::"ClubStatus"
        AND (
          "name" ILIKE ${searchPattern}
          OR COALESCE("description", '') ILIKE ${searchPattern}
          OR "type" ILIKE ${searchPattern}
          OR COALESCE("addressJson"::text, '') ILIKE ${searchPattern}
        )
      ORDER BY "updatedAt" DESC
      LIMIT 30
    `);
    const activeClubs = await this.prisma.club.findMany({
      where: {
        id: { in: matchedClubRows.map((club) => club.id) },
        status: ClubStatus.ACTIVE,
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    });
    const matchedClubIds = activeClubs.map((club) => club.id);
    const clubRelationFilter = {
      status: ClubStatus.ACTIVE,
    } as const;

    const [events, promotions, products] = await Promise.all([
      this.prisma.event.findMany({
        where: {
          club: clubRelationFilter,
          status: { in: [...CUSTOMER_VISIBLE_EVENT_STATUSES] },
          endsAt: { gte: now },
          OR: [
            { clubId: { in: matchedClubIds } },
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        },
        orderBy: { startsAt: 'asc' },
        take: 30,
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
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
            {
              OR: [
                { clubId: { in: matchedClubIds } },
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 30,
        include: { club: true, event: true, items: true },
      }),
      this.prisma.product.findMany({
        where: {
          club: clubRelationFilter,
          status: ProductStatus.ACTIVE,
          OR: [
            { clubId: { in: matchedClubIds } },
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 30,
        include: { club: true },
      }),
    ]);

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
      query: search,
      scope: 'PERU',
      location: { district: '', province: '', department: '' },
      hasResults: clubs.length + events.length + promotions.length + products.length > 0,
      clubs: await Promise.all(
        clubs.map(async (club) => ({
          id: club.id,
          name: club.name,
          description: club.description,
          type: club.type,
          profileImage: await this.uploadsService.createReadableImageUrl(club.profileImageUrl),
          coverImage: await this.uploadsService.createReadableImageUrl(club.coverImageUrl),
          address: toLocationAddress(club.addressJson),
          contact: club.contactJson ?? {},
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
          status: event.status,
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
          scope: promotion.eventId ? 'EVENT' : 'CLUB',
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

  async getCustomerClubDetail(currentUser: AuthenticatedUser, clubId: string) {
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

    const [events, promotions, products, tickets] = await Promise.all([
      this.prisma.event.findMany({
        where: {
          clubId,
          status: { in: [...CUSTOMER_VISIBLE_EVENT_STATUSES] },
          endsAt: { gte: now },
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
          clubId,
          status: PromotionStatus.ACTIVE,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
            {
              OR: [
                { eventId: null },
                {
                  event: {
                    status: { in: [...CUSTOMER_VISIBLE_EVENT_STATUSES] },
                    endsAt: { gte: now },
                  },
                },
              ],
            },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        include: { club: true, event: true, items: true },
      }),
      this.prisma.product.findMany({
        where: {
          clubId,
          status: ProductStatus.ACTIVE,
        },
        orderBy: { updatedAt: 'desc' },
        include: { club: true },
      }),
      this.prisma.ticketType.findMany({
        where: {
          clubId,
          status: { in: [TicketTypeStatus.ACTIVE, TicketTypeStatus.SOLD_OUT] },
          OR: [
            { eventId: null },
            {
              event: {
                status: { in: [...CUSTOMER_VISIBLE_EVENT_STATUSES] },
                endsAt: { gte: now },
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
      hasResults: true,
      clubs: [
        {
          id: club.id,
          name: club.name,
          description: club.description,
          type: club.type,
          profileImage: await this.uploadsService.createReadableImageUrl(club.profileImageUrl),
          coverImage: await this.uploadsService.createReadableImageUrl(club.coverImageUrl),
          address: toLocationAddress(club.addressJson),
          contact: club.contactJson ?? {},
          schedule: toScheduleSummary(club.scheduleJson),
          isOpenNow: isClubOpenNow(club.scheduleJson, now),
          status: club.status,
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
          status: event.status,
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
          quantityAvailable: Math.max(ticket.quantityTotal - ticket.quantitySold, 0),
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
          scope: promotion.eventId ? 'EVENT' : 'CLUB',
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
        status: { in: [...CUSTOMER_VISIBLE_EVENT_STATUSES] },
        club: { status: ClubStatus.ACTIVE },
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
            AND: [
              { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
              { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
            ],
          },
          orderBy: { updatedAt: 'desc' },
          include: { items: true },
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
        status: event.status,
        priceFrom: event.ticketTypes[0]?.priceCents ? event.ticketTypes[0].priceCents / 100 : null,
        currency: event.ticketTypes[0]?.currency ?? 'PEN',
      },
      club: {
        id: club.id,
        name: club.name,
        description: club.description,
        type: club.type,
        profileImage: await this.uploadsService.createReadableImageUrl(club.profileImageUrl),
        coverImage: await this.uploadsService.createReadableImageUrl(club.coverImageUrl),
        address: toLocationAddress(club.addressJson),
        contact: club.contactJson ?? {},
        schedule: toScheduleSummary(club.scheduleJson),
        isOpenNow: isClubOpenNow(club.scheduleJson, now),
        status: club.status,
      },
      tickets: await Promise.all(
        event.ticketTypes.map(async (ticket) => ({
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
          quantityAvailable: Math.max(ticket.quantityTotal - ticket.quantitySold, 0),
          perUserLimit: ticket.perUserLimit,
          status: ticket.status,
        })),
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
          scope: 'EVENT',
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
      data.type = normalizeBusinessType(input.type);
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
    return { profile };
  }

  async updateOperationalProfile(
    currentUser: AuthenticatedUser,
    clubId: string,
    input: UpdateClubOperationalProfileDto,
  ) {
    await this.assertCanManageClub(currentUser, clubId);
    const clean = (value: string | undefined) => value?.trim() || null;
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
        ...(input.responsibleName !== undefined ? { responsibleName: clean(input.responsibleName) } : {}),
        ...(input.responsibleEmail !== undefined ? { responsibleEmail: clean(input.responsibleEmail) } : {}),
        ...(input.responsiblePhone !== undefined ? { responsiblePhone: clean(input.responsiblePhone) } : {}),
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
    return { message: 'Configuración operativa actualizada.', profile };
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
      orderBy: [{ updatedAt: 'desc' }],
      select: customerHomeClubSelect,
    });

    if (!location.district && !location.province && !location.department) {
      return clubs.slice(0, 8);
    }

    return clubs.filter((club) => matchesLocationQuery(club.addressJson, location)).slice(0, 8);
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

const normalizeOptionalText = (value?: string): string | null => {
  const normalized = value?.trim();

  return normalized ? normalized : null;
};

const toNullableJson = (
  value: Prisma.InputJsonValue | null,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput => value ?? Prisma.JsonNull;

const normalizeBusinessType = (value?: string): string => value?.trim().toLowerCase() || 'club';

const normalizeAddress = (value?: CreateClubDto['address']): Record<string, string | number> => ({
  direccion: value?.direccion?.trim() ?? '',
  distrito: value?.distrito?.trim() ?? '',
  provincia: value?.provincia?.trim() ?? '',
  departamento: value?.departamento?.trim() ?? '',
  pais: value?.pais?.trim() || 'Perú',
  ...(value?.latitude !== undefined ? { latitude: value.latitude } : {}),
  ...(value?.longitude !== undefined ? { longitude: value.longitude } : {}),
});

const normalizeCustomerLocationQuery = (query: CustomerHomeQueryDto) => ({
  district: query.district?.trim() ?? '',
  province: query.province?.trim() ?? '',
  department: query.department?.trim() ?? '',
});

const customerHomeCacheKey = (location: {
  district: string;
  province: string;
  department: string;
}) =>
  [
    normalizeComparable(location.district),
    normalizeComparable(location.province),
    normalizeComparable(location.department),
  ].join('|');

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

const scheduleDayOrder = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

const removeEmptyStringValues = (
  value: Record<string, string | undefined>,
): Record<string, string> => {
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, item?.trim()] as const)
      .filter(([, item]) => item !== undefined && item !== ''),
  ) as Record<string, string>;
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

const parseAddressJson = (value: Prisma.JsonValue | null) => {
  const address = (value ?? {}) as Record<string, unknown>;
  return {
    direccion: readString(address['direccion']),
    distrito: readString(address['distrito']),
    provincia: readString(address['provincia']),
    departamento: readString(address['departamento']),
    pais: readString(address['pais']),
  };
};

const toScheduleSummary = (value: Prisma.JsonValue | null) => {
  const entries = parseScheduleJson(value);
  return entries.map((entry) => ({
    day: entry.day,
    isOpen: entry.isOpen,
    openTime: entry.openTime,
    closeTime: entry.closeTime,
  }));
};

const parseScheduleJson = (value: Prisma.JsonValue | null) => {
  if (!Array.isArray(value)) {
    return [] as Array<{
      day: string;
      isOpen: boolean;
      openTime: string;
      closeTime: string;
    }>;
  }

  return value.map((entry) => {
    const item = entry as Record<string, unknown>;
    return {
      day: readString(item['day']),
      isOpen: item['isOpen'] == true,
      openTime: readString(item['openTime']),
      closeTime: readString(item['closeTime']),
    };
  });
};

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
  const todayEntry = entries.find((entry) => entry.day === today) ?? emptyScheduleEntry(today);
  const yesterdayEntry =
    entries.find((entry) => entry.day === yesterday) ?? emptyScheduleEntry(yesterday);

  return (
    isOpenWithinEntry(todayEntry, currentMinutes) ||
    isOpenFromPreviousEntry(yesterdayEntry, currentMinutes)
  );
};

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

const readString = (value: unknown) => (typeof value === 'string' ? value : '');

const buildCustomerHomeEmptyState = (location: {
  district: string;
  province: string;
  department: string;
}) => {
  const locationLabel =
    location.district || location.province || location.department || 'tu zona actual';

  return {
    title: 'Aun no hay actividad disponible',
    text: `Todavia no encontramos discotecas activas registradas en ${locationLabel}. Cuando se sumen nuevos lugares, aqui apareceran sus eventos, promociones y productos.`,
    sections: {
      clubs: 'Aun no hay discotecas activas registradas en esta ciudad.',
      events: 'Aun no hay eventos visibles para esta ciudad.',
      promotions: 'Aun no hay promociones activas disponibles.',
      products: 'Aun no hay productos publicados en esta zona.',
    },
  };
};

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
  type: club.type,
  coverImage: buildMediaUrl(club.coverImageUrl, config),
  coverImageObjectKey: club.coverImageUrl,
  profileImage: buildMediaUrl(club.profileImageUrl, config),
  profileImageObjectKey: club.profileImageUrl,
  address: club.addressJson ?? {
    direccion: '',
    distrito: '',
    provincia: '',
    departamento: '',
    pais: '',
  },
  contact: club.contactJson ?? { phone: '', email: '' },
  socialMedia: club.socialMediaJson ?? [],
  schedule: club.scheduleJson ?? [],
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
