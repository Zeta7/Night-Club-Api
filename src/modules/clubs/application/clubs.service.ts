import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClubStatus, EventStatus, Prisma, TicketTypeStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { forbidden, notFound } from '../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { CreateClubDto } from '../presentation/dto/create-club.dto';
import { UpdateClubDto } from '../presentation/dto/update-club.dto';

@Injectable()
export class ClubsService {
  private readonly s3Client: S3Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.s3Client = new S3Client({
      region: this.config.get<string>('AWS_REGION'),
    });
  }

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
      club: toClubResponse(club),
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
      clubs: clubs.map(toClubResponse),
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

    const capacityAggregate = await this.prisma.event.aggregate({
      where: { clubId: club.id },
      _sum: { capacity: true },
    });

    const [profileImage, coverImage] = await Promise.all([
      this.resolveDisplayImageUrl(club.profileImageUrl),
      this.resolveDisplayImageUrl(club.coverImageUrl),
    ]);

    const upcomingEvents = await Promise.all(
      club.events.map(async (event) => {
        const cheapestTicket = event.ticketTypes[0];

        return {
          id: event.id,
          name: event.name,
          imageUrl: await this.resolveDisplayImageUrl(event.imageUrl),
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
      summary: {
        capacity: {
          current: 0,
          total: capacityAggregate._sum.capacity ?? 0,
        },
        counts: {
          events: eventCount,
          activeEvents: activeEventCount,
          promotions: 0,
          products: 0,
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
      topProducts: [],
      topPromotions: [],
      recentActivity: [],
    };
  }

  private async resolveDisplayImageUrl(value: string | null) {
    if (!value) {
      return value;
    }

    if (!value.includes('X-Amz-Signature')) {
      return value;
    }

    const key = this.tryGetS3ObjectKey(value);
    if (!key) {
      return value;
    }

    const bucket = this.config.get<string>('AWS_S3_BUCKET');
    if (!bucket) {
      return value;
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: 'inline',
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: 15 * 60 });
  }

  private tryGetS3ObjectKey(value: string) {
    try {
      const url = new URL(value);
      const bucket = this.config.get<string>('AWS_S3_BUCKET');
      const region = this.config.get<string>('AWS_REGION');
      const s3Host = bucket && region ? `${bucket}.s3.${region}.amazonaws.com` : null;

      if (s3Host && url.hostname === s3Host) {
        return decodeURIComponent(url.pathname.replace(/^\/+/, ''));
      }

      if (bucket && url.hostname === 's3.amazonaws.com') {
        const parts = url.pathname.replace(/^\/+/, '').split('/');
        if (parts.shift() === bucket) {
          return decodeURIComponent(parts.join('/'));
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  async getClub(currentUser: AuthenticatedUser, clubId: string) {
    const club = await this.findVisibleClubOrFail(currentUser, clubId);

    return {
      message: 'Club obtenido correctamente.',
      club: toClubResponse(club),
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
      club: toClubResponse(club),
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
      club: toClubResponse(club),
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
      club: toClubResponse(club),
    };
  }

  private assertCanCreateClub(currentUser: AuthenticatedUser) {
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw forbidden('CLUB_CREATE_FORBIDDEN', 'No tienes permisos para crear clubes.');
    }
  }

  private assertCanViewAdminDashboard(currentUser: AuthenticatedUser) {
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
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
}) => ({
  id: club.id,
  name: club.name,
  description: club.description,
  type: club.type,
  coverImage: club.coverImageUrl,
  profileImage: club.profileImageUrl,
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
