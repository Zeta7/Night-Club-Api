import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClubStatus, EventStatus, Prisma, ProductStatus, PromotionStatus, TicketTypeStatus, UserRole } from '@prisma/client';
import { buildMediaUrl } from '../../../shared/infrastructure/media/media-url';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { forbidden, notFound } from '../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { CreateClubDto } from '../presentation/dto/create-club.dto';
import { CustomerHomeQueryDto } from '../presentation/dto/customer-home-query.dto';
import { UpdateClubDto } from '../presentation/dto/update-club.dto';

const CUSTOMER_VISIBLE_EVENT_STATUSES = [
  EventStatus.PUBLISHED,
  EventStatus.SALE_ACTIVE,
  EventStatus.SOLD_OUT,
  EventStatus.IN_PROGRESS,
] as const;
const CUSTOMER_HOME_CACHE_TTL_MS = 1000 * 60 * 3;
const customerHomeCache = new Map<
  string,
  { expiresAt: number; payload: Record<string, unknown> }
>();

@Injectable()
export class ClubsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createClub(currentUser: AuthenticatedUser, input: CreateClubDto) {
    this.assertCanCreateClub(currentUser);

    const address = normalizeAddress(input.address);
    const contact = normalizeContact(input.contact);
    const coverImageUrl = normalizeOptionalText(input.coverImage);
    const profileImageUrl = normalizeOptionalText(input.profileImage);
    const socialMedia = normalizeSocialMedia(input.socialMedia);
    const schedule = normalizeSchedule(input.schedule);
    const club = await this.prisma.club.create({
      data: {
        name: normalizeText(input.name),
        description: normalizeOptionalText(input.description),
        type: normalizeBusinessType(input.type),
        addressJson: toNullableJson(address),
        contactJson: toNullableJson(contact),
        coverImageUrl,
        profileImageUrl,
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

    const club = await this.prisma.club.findFirst({
      where: this.getAdminDashboardClubWhere(currentUser),
      orderBy: { createdAt: 'asc' },
      include: {
        admins: {
          include: {
            user: true,
          },
        },
        workers: {
          where: {
            userId: currentUser.id,
          },
          take: 1,
          include: {
            user: true,
          },
        },
        events: {
          orderBy: { startsAt: 'asc' },
          take: 6,
          include: {
            ticketTypes: {
              where: {
                status: {
                  in: [TicketTypeStatus.ACTIVE, TicketTypeStatus.SOLD_OUT],
                },
              },
              orderBy: { priceCents: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

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

    const profileImage = buildMediaUrl(club.profileImageUrl, this.config);
    const coverImage = buildMediaUrl(club.coverImageUrl, this.config);
    const currentWorker = club.workers[0];

    const upcomingEvents = await Promise.all(
      club.events.map(async (event) => {
        const cheapestTicket = event.ticketTypes[0];

        return {
          id: event.id,
          name: event.name,
          imageUrl: buildMediaUrl(event.imageUrl, this.config),
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          capacity: event.capacity,
          sold: cheapestTicket?.quantitySold ?? 0,
          priceFrom: cheapestTicket ? cheapestTicket.priceCents / 100 : 0,
          status: event.status,
        };
      }),
    );

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
          current: 0,
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
          amount: 0,
          currency: 'PEN',
          trendPercent: 0,
        },
        purchases: 0,
        validatedQr: 0,
        customers: 0,
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
      alerts: [],
      latestSales: [],
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
      recentActivity: [],
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

    const [events, promotions, products] = await Promise.all([
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
    ]);

    const payload = {
      message: 'Home del cliente obtenido correctamente.',
      location,
      hasResults: true,
      clubs: clubs.slice(0, 8).map((club) => ({
        id: club.id,
        name: club.name,
        description: club.description,
        type: club.type,
        profileImage: buildMediaUrl(club.profileImageUrl, this.config),
        coverImage: buildMediaUrl(club.coverImageUrl, this.config),
        address: toLocationAddress(club.addressJson),
        contact: club.contactJson ?? {},
        schedule: toScheduleSummary(club.scheduleJson),
        isOpenNow: isClubOpenNow(club.scheduleJson, now),
        status: club.status,
      })),
      events: events.map((event) => ({
        id: event.id,
        clubId: event.clubId,
        clubName: event.club.name,
        name: event.name,
        description: event.description,
        imageUrl: buildMediaUrl(event.imageUrl, this.config),
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        status: event.status,
        capacity: event.capacity,
        sold: event.ticketTypes[0]?.quantitySold ?? 0,
        priceFrom: event.ticketTypes[0] ? event.ticketTypes[0].priceCents / 100 : null,
        currency: event.ticketTypes[0]?.currency ?? 'PEN',
      })),
      promotions: promotions.map((promotion) => ({
        id: promotion.id,
        clubId: promotion.clubId,
        clubName: promotion.club.name,
        eventId: promotion.eventId,
        eventName: promotion.event?.name ?? null,
        name: promotion.name,
        description: promotion.description,
        imageUrl: buildMediaUrl(promotion.imageUrl, this.config),
        finalPrice: promotion.finalPriceCents / 100,
        currency: promotion.currency,
        startsAt: promotion.startsAt,
        endsAt: promotion.endsAt,
        status: promotion.status,
        itemsCount: promotion.items.length,
        scope: promotion.eventId ? 'EVENT' : 'CLUB',
      })),
      products: products.map((product) => ({
        id: product.id,
        clubId: product.clubId,
        clubName: product.club.name,
        name: product.name,
        description: product.description,
        imageUrl: buildMediaUrl(product.imageUrl, this.config),
        price: product.priceCents / 100,
        currency: product.currency,
        stockQuantity: product.stockQuantity,
        status: product.status,
      })),
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

  async getClub(currentUser: AuthenticatedUser, clubId: string) {
    const club = await this.findVisibleClubOrFail(currentUser, clubId);

    return {
      message: 'Club obtenido correctamente.',
      club: toClubResponse(club, this.config),
    };
  }

  async updateClub(currentUser: AuthenticatedUser, clubId: string, input: UpdateClubDto) {
    await this.assertCanManageClub(currentUser, clubId);

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
      data.coverImageUrl = normalizeOptionalText(input.coverImage);
    }

    if (input.profileImage !== undefined) {
      const profileImageUrl = normalizeOptionalText(input.profileImage);
      data.profileImageUrl = profileImageUrl;
    }

    if (input.socialMedia !== undefined) {
      data.socialMediaJson = toNullableJson(normalizeSocialMedia(input.socialMedia));
    }

    if (input.schedule !== undefined) {
      data.scheduleJson = toNullableJson(normalizeSchedule(input.schedule));
    }

    const club = await this.prisma.club.update({
      where: { id: clubId },
      data,
      include: clubInclude,
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

  private getAdminDashboardClubWhere(currentUser: AuthenticatedUser) {
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      return {};
    }

    if (currentUser.role === UserRole.WORKER) {
      return {
        workers: {
          some: {
            userId: currentUser.id,
          },
        },
      };
    }

    return {
      admins: {
        some: {
          userId: currentUser.id,
        },
      },
    };
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
    const locationAttempts = buildCustomerLocationAttempts(location);

    if (locationAttempts.length === 0) {
      return this.prisma.club.findMany({
        where: { status: ClubStatus.ACTIVE },
        orderBy: [{ updatedAt: 'desc' }],
        take: 8,
        select: customerHomeClubSelect,
      });
    }

    for (const attempt of locationAttempts) {
      const clubs = await this.prisma.club.findMany({
        where: {
          status: ClubStatus.ACTIVE,
          ...attempt.where,
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: 8,
        select: customerHomeClubSelect,
      });

      if (clubs.length > 0) {
        return clubs;
      }
    }

    return [];
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

const normalizeAddress = (value?: CreateClubDto['address']): Record<string, string> => ({
  direccion: value?.direccion?.trim() ?? '',
  distrito: value?.distrito?.trim() ?? '',
  provincia: value?.provincia?.trim() ?? '',
  departamento: value?.departamento?.trim() ?? '',
  pais: value?.pais?.trim() || 'Perú',
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

const buildCustomerLocationWhere = (location: {
  district: string;
  province: string;
  department: string;
}): Prisma.ClubWhereInput => {
  const conditions: Prisma.ClubWhereInput[] = [];

  if (location.district) {
    conditions.push({
      addressJson: {
        path: ['distrito'],
        string_contains: location.district,
      },
    });
  }

  if (location.province) {
    conditions.push({
      addressJson: {
        path: ['provincia'],
        string_contains: location.province,
      },
    });
  }

  if (location.department) {
    conditions.push({
      addressJson: {
        path: ['departamento'],
        string_contains: location.department,
      },
    });
  }

  return conditions.length === 0 ? {} : { OR: conditions };
};

const buildCustomerLocationAttempts = (location: {
  district: string;
  province: string;
  department: string;
}) => {
  const attempts: Array<{
    key: 'district' | 'province' | 'department';
    where: Prisma.ClubWhereInput;
  }> = [];

  if (location.district) {
    attempts.push({
      key: 'district',
      where: {
        addressJson: {
          path: ['distrito'],
          string_contains: location.district,
        },
      },
    });
  }

  if (location.province) {
    attempts.push({
      key: 'province',
      where: {
        addressJson: {
          path: ['provincia'],
          string_contains: location.province,
        },
      },
    });
  }

  if (location.department) {
    attempts.push({
      key: 'department',
      where: {
        addressJson: {
          path: ['departamento'],
          string_contains: location.department,
        },
      },
    });
  }

  return attempts;
};

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
  const todayEntry =
    entries.find((entry) => entry.day === today) ?? emptyScheduleEntry(today);
  const yesterdayEntry =
    entries.find((entry) => entry.day === yesterday) ??
    emptyScheduleEntry(yesterday);

  return isOpenWithinEntry(todayEntry, currentMinutes) ||
    isOpenFromPreviousEntry(yesterdayEntry, currentMinutes);
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
  const districtMatch = !location.district || equalsNormalized(address.distrito, location.district);
  const provinceMatch =
    !location.province || equalsNormalized(address.provincia, location.province);
  const departmentMatch =
    !location.department || equalsNormalized(address.departamento, location.department);

  return districtMatch || provinceMatch || departmentMatch;
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

const toClubResponse = (club: {
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
    };
  }>;
}, config: ConfigService) => ({
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
  })),
});
