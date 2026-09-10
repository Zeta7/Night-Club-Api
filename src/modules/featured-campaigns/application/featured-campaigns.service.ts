import { Inject, Injectable } from '@nestjs/common';
import {
  ClubStatus,
  EventStatus,
  FeaturedCampaignStatus,
  FeaturedTargetType,
  Prisma,
  SellerConnectionStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { conflict, forbidden, notFound } from '../../../shared/presentation/api-exception';
import { CommerceService } from '../../commerce/application/commerce.service';
import {
  PaymentGateway,
  WALLET_TOP_UP_PAYMENT_GATEWAY,
} from '../../commerce/application/ports/payment-gateway.port';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { PlatformService } from '../../platform/application/platform.service';
import { CreateFeaturedCheckoutDto } from '../presentation/create-featured-checkout.dto';

const ELIGIBLE_EVENT_STATUSES = [
  EventStatus.PUBLISHED,
  EventStatus.SALE_ACTIVE,
  EventStatus.SOLD_OUT,
  EventStatus.IN_PROGRESS,
] as const;

const eligibleEventWhere = (clubId: string, now: Date): Prisma.EventWhereInput => ({
  clubId,
  status: { in: [...ELIGIBLE_EVENT_STATUSES] },
  endsAt: { gt: now },
  club: {
    status: ClubStatus.ACTIVE,
    sellerConnections: {
      some: {
        provider: 'mercado_pago',
        status: SellerConnectionStatus.CONNECTED,
        OR: [{ tokenExpiresAt: null }, { tokenExpiresAt: { gt: now } }],
      },
    },
  },
});

@Injectable()
export class FeaturedCampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platform: PlatformService,
    private readonly commerce: CommerceService,
    @Inject(WALLET_TOP_UP_PAYMENT_GATEWAY)
    private readonly paymentGateway: PaymentGateway,
  ) {}

  async getManagement(user: AuthenticatedUser, clubId: string) {
    await this.assertCanManageClub(user, clubId);
    await this.expireFinishedCampaigns(clubId);
    const [events, campaigns, settings] = await Promise.all([
      this.prisma.event.findMany({
        where: eligibleEventWhere(clubId, new Date()),
        select: { id: true, name: true, startsAt: true, endsAt: true },
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.featuredCampaign.findMany({
        where: { clubId },
        include: { paymentAttempt: true, event: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.platform.getSettings(),
    ]);
    return {
      offers: [
        this.offerFor(settings, FeaturedTargetType.BUSINESS),
        this.offerFor(settings, FeaturedTargetType.EVENT),
      ],
      events,
      campaigns: campaigns.map((campaign) => this.campaignResponse(campaign)),
    };
  }

  async createCheckout(user: AuthenticatedUser, clubId: string, input: CreateFeaturedCheckoutDto) {
    const club = await this.assertCanManageClub(user, clubId);
    if (club.status !== ClubStatus.ACTIVE) {
      throw conflict(
        'FEATURED_CLUB_NOT_ACTIVE',
        'El negocio debe estar activo antes de promocionarlo.',
      );
    }
    await this.expireFinishedCampaigns(clubId);
    const offer = this.requirePurchasableOffer(await this.platform.getSettings(), input.targetType);
    const priceCents = offer.dailyPriceCents * input.durationDays;
    if (!Number.isSafeInteger(priceCents) || priceCents > 2_147_483_647) {
      throw conflict(
        'FEATURED_CAMPAIGN_TOTAL_INVALID',
        'El importe total de la promoción supera el máximo permitido.',
      );
    }
    const eventId = input.targetType === FeaturedTargetType.EVENT ? input.eventId?.trim() : null;
    if (input.targetType === FeaturedTargetType.EVENT) {
      const event = await this.prisma.event.findFirst({
        where: { id: eventId ?? '', ...eligibleEventWhere(clubId, new Date()) },
        select: { id: true },
      });
      if (!event) {
        throw notFound('FEATURED_EVENT_NOT_FOUND', 'Selecciona un evento vigente de tu negocio.');
      }
    }

    const existing = await this.prisma.featuredCampaign.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { paymentAttempt: true, event: { select: { name: true } } },
    });
    if (existing) {
      if (existing.clubId !== clubId || existing.createdByUserId !== user.id) {
        throw conflict('IDEMPOTENCY_KEY_CONFLICT', 'La clave de pago ya fue utilizada.');
      }
      return this.checkoutResponse(existing);
    }

    const overlapping = await this.prisma.featuredCampaign.findFirst({
      where: {
        clubId,
        targetType: input.targetType,
        eventId,
        status: {
          in: [FeaturedCampaignStatus.PENDING_PAYMENT, FeaturedCampaignStatus.ACTIVE],
        },
      },
      select: { id: true },
    });
    if (overlapping) {
      throw conflict(
        'FEATURED_CAMPAIGN_ALREADY_EXISTS',
        'Ya existe una promoción activa o pendiente para esta selección.',
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.featuredCampaign.create({
        data: {
          clubId,
          eventId,
          createdByUserId: user.id,
          targetType: input.targetType,
          durationDays: input.durationDays,
          priceCents,
          currency: offer.currency,
          idempotencyKey: input.idempotencyKey,
        },
      });
      const paymentAttempt = await tx.paymentAttempt.create({
        data: {
          featuredCampaignId: campaign.id,
          purpose: 'FEATURED_CAMPAIGN',
          provider: this.paymentGateway.provider,
          amountCents: campaign.priceCents,
          currency: campaign.currency,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
      return { campaign, paymentAttempt };
    });

    try {
      const payment = await this.paymentGateway.createPayment({
        attemptId: created.paymentAttempt.id,
        orderId: created.campaign.id,
        operationType: 'FEATURED_CAMPAIGN',
        amountCents: created.campaign.priceCents,
        currency: created.campaign.currency,
        subject:
          input.targetType === FeaturedTargetType.BUSINESS
            ? `Promoción de negocio en Beerry por ${input.durationDays} días`
            : `Promoción de evento en Beerry por ${input.durationDays} días`,
      });
      const paymentAttempt = await this.prisma.paymentAttempt.update({
        where: { id: created.paymentAttempt.id },
        data: {
          externalPaymentId: payment.externalPaymentId,
          externalCheckoutId: payment.externalPaymentId,
          sellerExternalId: payment.sellerExternalId,
          providerData: {
            ...payment.providerData,
            checkoutUrl: payment.checkoutUrl,
          } as Prisma.InputJsonValue,
        },
      });
      return this.checkoutResponse({ ...created.campaign, paymentAttempt, event: null });
    } catch (error) {
      await this.prisma.$transaction([
        this.prisma.paymentAttempt.update({
          where: { id: created.paymentAttempt.id },
          data: {
            status: 'REJECTED',
            failedAt: new Date(),
            failureCode: 'FEATURED_CHECKOUT_CREATION_FAILED',
          },
        }),
        this.prisma.featuredCampaign.update({
          where: { id: created.campaign.id },
          data: { status: FeaturedCampaignStatus.REJECTED },
        }),
      ]);
      throw error;
    }
  }

  async getPayment(user: AuthenticatedUser, clubId: string, campaignId: string) {
    await this.assertCanManageClub(user, clubId);
    let campaign = await this.prisma.featuredCampaign.findFirst({
      where: { id: campaignId, clubId },
      include: { paymentAttempt: true, event: { select: { name: true } } },
    });
    if (!campaign) {
      throw notFound('FEATURED_CAMPAIGN_NOT_FOUND', 'No encontramos esta promoción.');
    }
    const attempt = campaign.paymentAttempt;
    if (campaign.status === FeaturedCampaignStatus.PENDING_PAYMENT && attempt?.status === 'PENDING') {
      try {
        const sellerExternalId = attempt.sellerExternalId ?? undefined;
        const event =
          attempt.externalPaymentId &&
          /^\d+$/.test(attempt.externalPaymentId) &&
          this.paymentGateway.queryExternalPayment
            ? await this.paymentGateway.queryExternalPayment(
                attempt.externalPaymentId,
                sellerExternalId,
              )
            : this.paymentGateway.queryPaymentByExternalReference
              ? await this.paymentGateway.queryPaymentByExternalReference(
                  attempt.id,
                  sellerExternalId,
                )
              : null;
        if (event) {
          await this.commerce.bindAuthoritativeExternalPayment(event);
          await this.commerce.processPaymentEvent(event);
        }
      } catch {
        // La consulta externa no debe impedir que el admin vea o retome su pago pendiente.
      }
    }
    await this.expireFinishedCampaigns(clubId);
    campaign = await this.prisma.featuredCampaign.findFirstOrThrow({
      where: { id: campaignId, clubId },
      include: { paymentAttempt: true, event: { select: { name: true } } },
    });
    return this.checkoutResponse(campaign);
  }

  async getPaymentById(user: AuthenticatedUser, campaignId: string) {
    const campaign = await this.prisma.featuredCampaign.findUnique({
      where: { id: campaignId },
      select: { clubId: true },
    });
    if (!campaign) {
      throw notFound('FEATURED_CAMPAIGN_NOT_FOUND', 'No encontramos esta promoción.');
    }
    return this.getPayment(user, campaign.clubId, campaignId);
  }

  async selectForHome(input: {
    viewerUserId: string;
    clubIds: readonly string[];
    eventIds: readonly string[];
    limit?: number;
  }) {
    if (input.clubIds.length === 0) return [];
    const now = new Date();
    const campaigns = await this.prisma.featuredCampaign.findMany({
      where: {
        status: FeaturedCampaignStatus.ACTIVE,
        startsAt: { lte: now },
        endsAt: { gt: now },
        clubId: { in: [...input.clubIds] },
      },
      select: { id: true, clubId: true, eventId: true, targetType: true },
    });
    const visible = campaigns.filter(
      (campaign) =>
        campaign.targetType === FeaturedTargetType.BUSINESS ||
        (campaign.eventId !== null && input.eventIds.includes(campaign.eventId)),
    );
    const seed = `${input.viewerUserId}:${now.toISOString().slice(0, 13)}`;
    visible.sort((left, right) => hash(seed, left.id) - hash(seed, right.id));
    const selected = [] as typeof visible;
    const usedClubs = new Set<string>();
    for (const campaign of visible) {
      if (usedClubs.has(campaign.clubId)) continue;
      usedClubs.add(campaign.clubId);
      selected.push(campaign);
      if (selected.length >= (input.limit ?? 5)) break;
    }
    return selected.map((campaign) => ({
      campaignId: campaign.id,
      targetType: campaign.targetType,
      clubId: campaign.clubId,
      eventId: campaign.eventId,
      isSponsored: true,
    }));
  }

  private offerFor(settings: Record<string, unknown>, targetType: FeaturedTargetType) {
    const advertisingSettings =
      toSettingsRecord(settings.advertisingSettings) ?? toSettingsRecord(settings.settings) ?? {};
    const priceKey =
      targetType === FeaturedTargetType.BUSINESS
        ? 'featuredBusinessDailyPriceCents'
        : 'featuredEventDailyPriceCents';
    const dailyPriceCents = Number(advertisingSettings[priceKey] ?? settings[priceKey]);
    const configured = Number.isInteger(dailyPriceCents) && dailyPriceCents > 0;
    return {
      targetType,
      title:
        targetType === FeaturedTargetType.BUSINESS
          ? 'Promocionar mi negocio'
          : 'Promocionar un evento',
      dailyPriceCents: configured ? dailyPriceCents : null,
      currency: 'PEN',
      configured,
    };
  }

  private requirePurchasableOffer(
    settings: Record<string, unknown>,
    targetType: FeaturedTargetType,
  ) {
    const offer = this.offerFor(settings, targetType);
    if (offer.dailyPriceCents === null) {
      throw conflict(
        'FEATURED_CAMPAIGN_SETTINGS_REQUIRED',
        'El superadmin debe configurar los precios de promoción.',
      );
    }
    return { ...offer, dailyPriceCents: offer.dailyPriceCents };
  }

  private campaignResponse(campaign: any) {
    return {
      id: campaign.id,
      targetType: campaign.targetType,
      eventId: campaign.eventId,
      eventName: campaign.event?.name ?? null,
      status: campaign.status,
      durationDays: campaign.durationDays,
      priceCents: campaign.priceCents,
      currency: campaign.currency,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      createdAt: campaign.createdAt,
      paymentStatus: campaign.paymentAttempt?.status ?? null,
    };
  }

  private checkoutResponse(campaign: any) {
    const providerData =
      campaign.paymentAttempt?.providerData &&
      typeof campaign.paymentAttempt.providerData === 'object'
        ? (campaign.paymentAttempt.providerData as Record<string, unknown>)
        : undefined;
    return {
      campaign: this.campaignResponse(campaign),
      payment: {
        provider: campaign.paymentAttempt?.provider ?? null,
        paymentAttemptId: campaign.paymentAttempt?.id ?? null,
        status: campaign.paymentAttempt?.status ?? null,
        checkoutUrl: providerData?.checkoutUrl ?? null,
        expiresAt: campaign.paymentAttempt?.expiresAt ?? null,
        failureCode: campaign.paymentAttempt?.failureCode ?? null,
        failureMessage: campaign.paymentAttempt?.failureMessage ?? null,
      },
    };
  }

  private async expireFinishedCampaigns(clubId: string) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.paymentAttempt.updateMany({
        where: {
          purpose: 'FEATURED_CAMPAIGN',
          status: 'PENDING',
          expiresAt: { lte: now },
          featuredCampaign: { is: { clubId } },
        },
        data: { status: 'EXPIRED', failedAt: now, failureCode: 'PAYMENT_TIMEOUT' },
      }),
      this.prisma.featuredCampaign.updateMany({
        where: {
          clubId,
          OR: [
            { status: FeaturedCampaignStatus.ACTIVE, endsAt: { lte: now } },
            {
              status: FeaturedCampaignStatus.PENDING_PAYMENT,
              paymentAttempt: { is: { status: 'EXPIRED' } },
            },
          ],
        },
        data: { status: FeaturedCampaignStatus.EXPIRED },
      }),
    ]);
  }

  private async assertCanManageClub(user: AuthenticatedUser, clubId: string) {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true, status: true },
    });
    if (!club) throw notFound('CLUB_NOT_FOUND', 'No encontramos el negocio.');
    if (user.role === UserRole.SUPER_ADMIN) return club;
    if (user.role !== UserRole.ADMIN) {
      throw forbidden('FEATURED_CAMPAIGN_FORBIDDEN', 'Solo un administrador puede promocionar.');
    }
    const admin = await this.prisma.clubAdmin.findUnique({
      where: { clubId_userId: { clubId, userId: user.id } },
      select: { id: true },
    });
    if (!admin) {
      throw forbidden('FEATURED_CAMPAIGN_FORBIDDEN', 'No administras este negocio.');
    }
    return club;
  }
}

function hash(seed: string, value: string) {
  let result = 2166136261;
  for (const character of `${seed}:${value}`) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function toSettingsRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
