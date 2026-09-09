import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import {
  ClubStatus,
  ClubWorkerStatus,
  CommerceItemType,
  EventStatus,
  OrderStatus,
  ProductStatus,
  ProductDeliveryMode,
  PromotionStatus,
  Prisma,
  RedeemableStatus,
  SellerConnectionStatus,
  TicketTypeStatus,
  UserRole,
  WorkerPermission,
} from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
} from '../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { UploadsService } from '../../uploads/application/uploads.service';
import { CheckoutDto } from '../presentation/checkout.dto';
import { AddCartItemDto } from '../presentation/add-cart-item.dto';
import { NotificationService } from '../../notification/application/notification.service';
import { LedgerService } from '../../wallets/application/ledger.service';
import { ClubOrdersQueryDto } from '../presentation/club-orders-query.dto';
import { UpdateProductDeliveryDto } from '../presentation/update-product-delivery.dto';
import { CapacityService } from '../../events/application/capacity.service';
import { eventAllowsSales, eventAllowsRedemption } from '../../events/application/event-availability';
import { ReferralsService } from '../../referrals/application/referrals.service';
import {
  PAYMENT_GATEWAY,
  REFUND_GATEWAY,
  WALLET_TOP_UP_PAYMENT_GATEWAY,
  PaymentGateway,
  RefundGateway,
  PaymentOutcome,
  VerifiedPaymentEvent,
} from './ports/payment-gateway.port';
import { buildProductDeliveryPlan } from './product-delivery-plan';
import { MarketplaceFeeService } from '../../platform/application/marketplace-fee.service';

type ValidationKind = 'TICKET' | 'PRODUCT' | 'PROMOTION';

const mercadoPagoReadyRelation = (now = new Date()) => ({
  some: {
    provider: 'mercado_pago',
    status: SellerConnectionStatus.CONNECTED,
    OR: [{ tokenExpiresAt: null }, { tokenExpiresAt: { gt: now } }],
  },
});

@Injectable()
export class CommerceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommerceService.name);
  private expirationTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly uploadsService: UploadsService,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: PaymentGateway,
    @Optional() private readonly notifications?: NotificationService,
    @Optional() private readonly ledger?: LedgerService,
    @Optional() private readonly capacity?: CapacityService,
    @Optional() private readonly referrals?: ReferralsService,
    @Optional()
    @Inject(WALLET_TOP_UP_PAYMENT_GATEWAY)
    private readonly configuredWalletTopUpGateway?: PaymentGateway,
    @Optional() private readonly marketplaceFees?: MarketplaceFeeService,
    @Optional() @Inject(REFUND_GATEWAY) private readonly refundGateway?: RefundGateway,
  ) {}

  onModuleInit() {
    this.signingKeys();
    this.expirationTimer = setInterval(() => void this.expirePendingOrders(), 60_000);
    this.expirationTimer.unref();
    void this.expirePendingOrders();
  }

  onModuleDestroy() {
    if (this.expirationTimer) clearInterval(this.expirationTimer);
  }

  private qr(resource: ValidationKind, id: string, clubId: string, eventId?: string | null) {
    const version = this.activeSigningVersion();
    const payload = {
      v: version,
      resource,
      id,
      clubId,
      eventId: eventId ?? null,
      issuedAt: new Date().toISOString(),
      nonce: randomBytes(12).toString('hex'),
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.signingKey(version))
      .update(encoded)
      .digest('base64url');
    return `${encoded}.${signature}`;
  }

  private activeSigningVersion() {
    return this.config.get<string>('QR_SIGNING_ACTIVE_VERSION') ?? 'v1';
  }

  private signingKeys(): Record<string, string> {
    const serialized = this.config.get<string>('QR_SIGNING_KEYS_JSON');
    if (serialized) {
      try {
        const parsed = JSON.parse(serialized) as Record<string, unknown>;
        const keys = Object.fromEntries(
          Object.entries(parsed).filter(
            (entry): entry is [string, string] =>
              typeof entry[1] === 'string' && entry[1].length >= 32,
          ),
        );
        if (Object.keys(keys).length > 0) return keys;
      } catch {
        throw new Error('QR_SIGNING_KEYS_JSON debe ser un objeto JSON válido.');
      }
    }
    const legacy = this.config.get<string>('QR_SIGNING_SECRET');
    if (legacy && legacy.length >= 32) return { v1: legacy, legacy };
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new Error(
        'Debes configurar QR_SIGNING_KEYS_JSON con secretos de al menos 32 caracteres.',
      );
    }
    return { v1: 'beerry-dev-only-secret-change-before-prod', legacy: 'beerry-dev-only-secret' };
  }

  private signingKey(version: string) {
    const key = this.signingKeys()[version];
    if (!key) throw new Error(`No existe una clave QR configurada para la versión ${version}.`);
    return key;
  }

  private backupCode() {
    return randomInt(100000, 1000000).toString();
  }

  async paymentOptions(user: AuthenticatedUser) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId: user.id },
      select: { clubId: true },
    });
    const club = cart?.clubId
      ? await this.prisma.club.findUnique({
          where: { id: cart.clubId },
          select: { acceptsWalletPayments: true },
        })
      : null;
    return { acceptsWallet: club?.acceptsWalletPayments ?? false };
  }

  async checkout(user: AuthenticatedUser, input: CheckoutDto) {
    const requestedPaymentMethod =
      input.paymentMethod === 'MERCADO_PAGO' && this.paymentGateway.provider === 'simulated'
        ? 'SIMULATED'
        : (input.paymentMethod ??
          (this.paymentGateway.provider === 'mercado_pago' ? 'MERCADO_PAGO' : 'SIMULATED'));
    const created = await this.prisma.$transaction(async (tx) => {
      const reservationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const cart = await tx.cart.findUnique({
        where: { userId: user.id },
        include: { items: { orderBy: { createdAt: 'asc' } } },
      });
      const checkoutItems =
        cart?.items.map((item) => ({
          id: item.itemId,
          type: item.itemType,
          quantity: item.quantity,
          productDeliveryMode: item.productDeliveryMode,
        })) ?? [];
      if (checkoutItems.length === 0) {
        throw badRequest('EMPTY_CART', 'Agrega al menos un artículo antes de comprar.');
      }
      if (requestedPaymentMethod === 'MERCADO_PAGO') {
        const connectedClub = cart?.clubId
          ? await tx.club.findFirst({
              where: {
                id: cart.clubId,
                sellerConnections: mercadoPagoReadyRelation(),
              },
              select: { id: true },
            })
          : null;
        if (!connectedClub) {
          throw conflict(
            'MERCADO_PAGO_NOT_CONNECTED',
            'Este negocio todavía no ha habilitado sus pagos con Mercado Pago.',
          );
        }
      }
      checkoutItems.sort((left, right) =>
        `${left.type}:${left.id}`.localeCompare(`${right.type}:${right.id}`),
      );
      const resolved: Array<{
        type: CommerceItemType;
        id: string;
        clubId: string;
        clubName: string;
        name: string;
        price: number;
        quantity: number;
        eventId: string | null;
        validUntil: Date | null;
        productDeliveryMode: ProductDeliveryMode;
      }> = [];

      for (const item of checkoutItems) {
        if (item.type === CommerceItemType.TICKET) {
          await this.lockInventoryResource(tx, item.type, item.id);
          const source = await tx.ticketType.findFirst({
            where: {
              id: item.id,
              status: TicketTypeStatus.ACTIVE,
              club: { status: ClubStatus.ACTIVE },
            },
            include: { club: true, event: true },
          });
          const now = new Date();
          if (source?.eventId) await this.assertEventForCheckout(tx, source.eventId);
          const alreadyOwned = source?.perUserLimit
            ? await tx.ticket.count({ where: { ownerUserId: user.id, ticketTypeId: source.id } })
            : 0;
          const reserved = await tx.inventoryReservation.aggregate({
            where: {
              resourceType: item.type,
              resourceId: item.id,
              status: 'ACTIVE',
              expiresAt: { gt: now },
            },
            _sum: { quantity: true },
          });
          const availableQuantity = source
            ? source.quantityTotal - source.quantitySold - (source.replacementReserved ?? 0) - (reserved._sum.quantity ?? 0)
            : 0;
          if (
            !source ||
            (source.eventId && source.event?.status !== EventStatus.SALE_ACTIVE) ||
            availableQuantity < item.quantity ||
            (source.saleStartAt && source.saleStartAt > now) ||
            (source.saleEndAt && source.saleEndAt < now) ||
            (source.perUserLimit && alreadyOwned + item.quantity > source.perUserLimit)
          ) {
            throw badRequest('TICKET_UNAVAILABLE', 'Una entrada ya no está disponible.');
          }
          resolved.push({
            type: item.type,
            id: source.id,
            clubId: source.clubId,
            clubName: source.club.name,
            name: source.name,
            price: source.priceCents,
            quantity: item.quantity,
            eventId: source.eventId,
            validUntil: source.event?.endsAt ?? source.saleEndAt,
            productDeliveryMode: item.productDeliveryMode,
          });
        } else if (item.type === CommerceItemType.PRODUCT) {
          await this.lockInventoryResource(tx, item.type, item.id);
          const source = await tx.product.findFirst({
            where: {
              id: item.id,
              status: ProductStatus.ACTIVE,
              club: { status: ClubStatus.ACTIVE },
            },
            include: { club: true },
          });
          const reserved = await tx.inventoryReservation.aggregate({
            where: {
              resourceType: item.type,
              resourceId: item.id,
              status: 'ACTIVE',
              expiresAt: { gt: new Date() },
            },
            _sum: { quantity: true },
          });
          const availableQuantity = source
            ? source.stockQuantity - (reserved._sum.quantity ?? 0)
            : 0;
          if (!source || availableQuantity < item.quantity) {
            throw badRequest('PRODUCT_UNAVAILABLE', 'Un producto ya no tiene stock suficiente.');
          }
          resolved.push({
            type: item.type,
            id: source.id,
            clubId: source.clubId,
            clubName: source.club.name,
            name: source.name,
            price: source.priceCents,
            quantity: item.quantity,
            eventId: null,
            validUntil: null,
            productDeliveryMode: item.productDeliveryMode,
          });
        } else {
          const source = await tx.promotion.findFirst({
            where: {
              id: item.id,
              status: PromotionStatus.ACTIVE,
              club: { status: ClubStatus.ACTIVE },
            },
            include: { club: true, event: true },
          });
          if (!source) {
            throw badRequest('PROMOTION_UNAVAILABLE', 'Una promoción ya no está disponible.');
          }
          if (source.eventId) await this.assertEventForCheckout(tx, source.eventId);
          const now = new Date();
          if (
            (source.startsAt && source.startsAt > now) ||
            (source.eventId && source.event?.status !== EventStatus.SALE_ACTIVE) ||
            (source.endsAt && source.endsAt < now)
          ) {
            throw badRequest('PROMOTION_UNAVAILABLE', 'Una promoción está fuera de vigencia.');
          }
          resolved.push({
            type: item.type,
            id: source.id,
            clubId: source.clubId,
            clubName: source.club.name,
            name: source.name,
            price: source.finalPriceCents,
            quantity: item.quantity,
            eventId: source.eventId,
            validUntil: source.endsAt ?? source.event?.endsAt ?? null,
            productDeliveryMode: item.productDeliveryMode,
          });
        }
      }

      const clubs = new Set(resolved.map((item) => item.clubId));
      if (clubs.size !== 1) {
        throw badRequest(
          'MULTI_CLUB_CHECKOUT',
          'Para el MVP cada compra debe pertenecer a una sola discoteca.',
        );
      }
      const total = resolved.reduce((sum, item) => sum + item.price * item.quantity, 0);
      if (requestedPaymentMethod === 'BEERRY_WALLET') {
        const club = await tx.club.findUnique({
          where: { id: resolved[0].clubId },
          select: { acceptsWalletPayments: true },
        });
        if (!club?.acceptsWalletPayments)
          throw conflict(
            'WALLET_NOT_ACCEPTED',
            'Este negocio no acepta pagos con billetera Beerry.',
          );
      }
      if (total !== input.expectedTotalCents) {
        throw conflict(
          'CART_TOTAL_CHANGED',
          'El precio o la disponibilidad cambió. Revisa el carrito antes de continuar.',
        );
      }
      const promotionalCreditCents =
        requestedPaymentMethod === 'SIMULATED' ? (input.promotionalCreditCents ?? 0) : 0;
      if (promotionalCreditCents > total) {
        throw badRequest(
          'CREDIT_EXCEEDS_ORDER_TOTAL',
          'El crédito no puede superar el total de la compra.',
        );
      }
      if (requestedPaymentMethod === 'MERCADO_PAGO' && promotionalCreditCents > 0) {
        throw badRequest(
          'MIXED_PAYMENT_NOT_ALLOWED',
          'Elige pagar todo con la pasarela externa o todo con tu billetera.',
        );
      }
      const order = await tx.order.create({
        data: {
          userId: user.id,
          clubId: resolved[0].clubId,
          totalCents: total,
          promotionalCreditUsedCents: promotionalCreditCents,
          walletBalanceUsedCents: requestedPaymentMethod === 'BEERRY_WALLET' ? total : 0,
          customerFundedCents: total - promotionalCreditCents,
          status: 'PENDING',
          simulatedPayment: requestedPaymentMethod === 'SIMULATED',
          paymentMethod: requestedPaymentMethod,
          combineProducts: cart?.combineProducts ?? false,
        },
      });
      if (requestedPaymentMethod === 'BEERRY_WALLET' || promotionalCreditCents > 0) {
        if (!this.referrals) throw new Error('REFERRALS_SERVICE_NOT_AVAILABLE');
        const consumed =
          requestedPaymentMethod === 'BEERRY_WALLET'
            ? await this.referrals.consumeWalletBalance(tx, user.id, order.id, total)
            : { customerFundedCents: 0 };
        if (requestedPaymentMethod === 'BEERRY_WALLET') {
          await tx.order.update({
            where: { id: order.id },
            data: { customerFundedCents: consumed.customerFundedCents },
          });
          order.customerFundedCents = consumed.customerFundedCents;
        } else {
          await this.referrals.consumeCredits(tx, user.id, order.id, promotionalCreditCents, total);
        }
      }
      for (const item of resolved) {
        const purchasedEvent = item.eventId
          ? await tx.event.findUniqueOrThrow({ where: { id: item.eventId } })
          : null;
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            clubId: item.clubId,
            itemType: item.type,
            itemId: item.id,
            nameSnapshot: item.name,
            eventId: item.eventId,
            eventSnapshot: purchasedEvent ? {
              source: 'CHECKOUT', name: purchasedEvent.name,
              startsAt: purchasedEvent.startsAt.toISOString(),
              endsAt: purchasedEvent.endsAt.toISOString(),
            } : undefined,
            quantity: item.quantity,
            productDeliveryMode: item.productDeliveryMode,
            unitPriceCents: item.price,
            totalCents: item.price * item.quantity,
          },
        });
        if (item.type === CommerceItemType.TICKET || item.type === CommerceItemType.PRODUCT) {
          await tx.inventoryReservation.create({
            data: {
              orderId: order.id,
              resourceType: item.type,
              resourceId: item.id,
              quantity: item.quantity,
              expiresAt: reservationExpiresAt,
            },
          });
        }
      }
      const walletFee =
        requestedPaymentMethod === 'BEERRY_WALLET'
          ? await this.requiredMarketplaceFees().resolve(order.clubId, total)
          : null;
      const attempt = await tx.paymentAttempt.create({
        data: {
          orderId: order.id,
          ...(walletFee
            ? {
                marketplaceFeeBps: walletFee.marketplaceFeeBps,
                marketplaceFeeCents: walletFee.marketplaceFeeCents,
                sellerExpectedNetCents: walletFee.sellerExpectedNetCents,
                feeSource: walletFee.feeSource,
              }
            : {}),
          provider:
            requestedPaymentMethod === 'BEERRY_WALLET'
              ? 'beerry_wallet'
              : this.paymentGateway.provider,
          amountCents:
            requestedPaymentMethod === 'BEERRY_WALLET' ? total : total - promotionalCreditCents,
          currency: order.currency,
          expiresAt: reservationExpiresAt,
        },
      });
      return {
        order,
        attempt,
      };
    });

    if (requestedPaymentMethod === 'BEERRY_WALLET') {
      const externalPaymentId = `wallet:${created.attempt.id}`;
      await this.prisma.paymentAttempt.update({
        where: { id: created.attempt.id },
        data: { externalPaymentId },
      });
      await this.processPaymentEvent({
        provider: 'beerry_wallet',
        providerEventId: `wallet:${created.attempt.id}:approved`,
        externalPaymentId,
        outcome: 'APPROVED',
        payload: { paymentMethod: 'BEERRY_WALLET' },
      });
      return this.getPayment(user, created.order.id);
    }

    const payer = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, fullName: true },
    });
    let feeSnapshot = null;
    if (this.paymentGateway.provider === 'mercado_pago') {
      try {
        feeSnapshot = await this.requiredMarketplaceFees().resolve(
          created.order.clubId,
          created.attempt.amountCents,
        );
        this.logger.log(
          JSON.stringify({
            event: 'checkout.marketplace_fee.resolved',
            orderId: created.order.id,
            attemptId: created.attempt.id,
            clubId: created.order.clubId,
            amountCents: created.attempt.amountCents,
            marketplaceFeeBps: feeSnapshot.marketplaceFeeBps,
            marketplaceFeeCents: feeSnapshot.marketplaceFeeCents,
            feeSource: feeSnapshot.feeSource,
          }),
        );
      } catch (error) {
        this.logger.error(
          JSON.stringify({
            event: 'checkout.marketplace_fee.failed',
            orderId: created.order.id,
            attemptId: created.attempt.id,
            clubId: created.order.clubId,
            amountCents: created.attempt.amountCents,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
        throw error;
      }
    }
    if (feeSnapshot) {
      await this.prisma.paymentAttempt.update({
        where: { id: created.attempt.id },
        data: {
          grossAmountCents: created.order.totalCents,
          customerFundedSnapshotCents: created.attempt.amountCents,
          marketplaceFeeBps: feeSnapshot.marketplaceFeeBps,
          marketplaceFeeCents: feeSnapshot.marketplaceFeeCents,
          sellerExpectedNetCents: feeSnapshot.sellerExpectedNetCents,
          feeSource: feeSnapshot.feeSource,
        },
      });
    }
    const providerPayment = await this.paymentGateway.createPayment({
      attemptId: created.attempt.id,
      orderId: created.order.id,
      amountCents: created.attempt.amountCents,
      currency: created.order.currency,
      payerEmail: this.paymentPayerEmail(payer?.email),
      subject: `Compra Beerry - ${payer?.fullName ?? user.id}`,
      clubId: created.order.clubId,
      marketplaceFeeCents: feeSnapshot?.marketplaceFeeCents,
    });
    const attempt = await this.prisma.paymentAttempt.update({
      where: { id: created.attempt.id },
      data: {
        externalPaymentId: providerPayment.externalPaymentId,
        providerData: { ...providerPayment.providerData, checkoutUrl: providerPayment.checkoutUrl } as Prisma.InputJsonValue,
        externalCheckoutId:
          this.paymentGateway.provider === 'mercado_pago'
            ? providerPayment.externalPaymentId
            : undefined,
        sellerExternalId: providerPayment.sellerExternalId,
      },
    });
    return this.paymentResponse(created.order, attempt, providerPayment.checkoutUrl);
  }

  async getCart(user: AuthenticatedUser) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId: user.id },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!cart)
      return {
        id: null,
        clubId: null,
        combineProducts: false,
        items: [],
        totalCents: 0,
        currency: 'PEN',
      };

    const items = await Promise.all(
      cart.items.map(async (item) => {
        const source = await this.resolveCartSource(item.itemType, item.itemId, user.id);
        const isAvailable = Boolean(source?.available && item.quantity <= source.availableQuantity);
        return {
          cartItemId: item.id,
          id: item.itemId,
          type: item.itemType,
          quantity: item.quantity,
          productDeliveryMode: item.productDeliveryMode,
          combineProducts: cart.combineProducts,
          name: source?.name ?? 'Artículo no disponible',
          clubId: source?.clubId ?? cart.clubId,
          clubName: source?.clubName ?? '',
          priceCents: source?.priceCents ?? 0,
          currency: source?.currency ?? 'PEN',
          imageUrl: source?.imageUrl ?? null,
          available: isAvailable,
          availabilityMessage: isAvailable
            ? null
            : (source?.availabilityMessage ?? 'La cantidad solicitada ya no está disponible.'),
          lineTotalCents: isAvailable && source ? source.priceCents * item.quantity : 0,
        };
      }),
    );
    return {
      id: cart.id,
      clubId: cart.clubId,
      combineProducts: cart.combineProducts,
      items,
      totalCents: items.reduce((sum, item) => sum + item.lineTotalCents, 0),
      currency: items[0]?.currency ?? 'PEN',
      hasUnavailableItems: items.some((item) => !item.available),
    };
  }

  async createWalletTopUp(user: AuthenticatedUser, amountCents: number, idempotencyKey: string) {
    const minimum = Number(this.config.get<string>('WALLET_TOP_UP_MIN_CENTS', '200'));
    const maximum = Number(this.config.get<string>('WALLET_TOP_UP_MAX_CENTS', '100000'));
    if (amountCents < minimum || amountCents > maximum) {
      throw badRequest(
        'WALLET_TOP_UP_AMOUNT_OUT_OF_RANGE',
        `La recarga debe estar entre S/ ${(minimum / 100).toFixed(2)} y S/ ${(maximum / 100).toFixed(2)}.`,
      );
    }
    const existing = await this.prisma.walletTopUp.findUnique({
      where: { idempotencyKey },
      include: { paymentAttempt: true },
    });
    if (existing) {
      if (existing.userId !== user.id)
        throw conflict('IDEMPOTENCY_KEY_CONFLICT', 'La clave ya fue utilizada.');
      return this.topUpResponse(existing, existing.paymentAttempt);
    }
    const payer = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, fullName: true },
    });
    const created = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
      });
      const topUp = await tx.walletTopUp.create({
        data: { userId: user.id, walletId: wallet.id, amountCents, idempotencyKey },
      });
      const attempt = await tx.paymentAttempt.create({
        data: {
          walletTopUpId: topUp.id,
          purpose: 'WALLET_TOP_UP',
          provider: this.walletTopUpGateway().provider,
          amountCents,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
      return { topUp, attempt };
    });
    const providerPayment = await this.walletTopUpGateway().createPayment({
      attemptId: created.attempt.id,
      orderId: created.topUp.id,
      amountCents,
      currency: created.topUp.currency,
      payerEmail: this.paymentPayerEmail(payer?.email),
      subject: `Recarga de billetera Beerry - ${payer?.fullName ?? user.id}`,
    });
    const attempt = await this.prisma.paymentAttempt.update({
      where: { id: created.attempt.id },
      data: {
        externalPaymentId: providerPayment.externalPaymentId,
        externalCheckoutId:
          this.walletTopUpGateway().provider === 'mercado_pago'
            ? providerPayment.externalPaymentId
            : undefined,
        sellerExternalId: providerPayment.sellerExternalId,
        providerData: { ...providerPayment.providerData, checkoutUrl: providerPayment.checkoutUrl } as Prisma.InputJsonValue,
      },
    });
    return this.topUpResponse(created.topUp, attempt, providerPayment.checkoutUrl);
  }

  async listWalletTopUps(user: AuthenticatedUser) {
    const items = await this.prisma.walletTopUp.findMany({
      where: { userId: user.id },
      include: { paymentAttempt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { items: items.map((item) => this.topUpResponse(item, item.paymentAttempt)) };
  }

  async getWalletTopUp(user: AuthenticatedUser, topUpId: string) {
    let topUp = await this.prisma.walletTopUp.findFirst({
      where: { id: topUpId, userId: user.id },
      include: { paymentAttempt: true },
    });
    if (!topUp) throw notFound('WALLET_TOP_UP_NOT_FOUND', 'No se encontró la recarga.');
    if (
      topUp.status === 'PENDING' &&
      topUp.paymentAttempt?.provider === this.walletTopUpGateway().provider &&
      topUp.paymentAttempt.externalPaymentId &&
      this.walletTopUpGateway().verifyPaymentToken
    ) {
      try {
        const event = await this.walletTopUpGateway().verifyPaymentToken!(
          topUp.paymentAttempt.externalPaymentId,
        );
        await this.processPaymentEvent(event);
        topUp = await this.prisma.walletTopUp.findFirstOrThrow({
          where: { id: topUpId, userId: user.id },
          include: { paymentAttempt: true },
        });
      } catch {
        // La consulta del estado no debe impedir que el cliente vea su recarga pendiente.
      }
    }
    return this.topUpResponse(topUp, topUp.paymentAttempt);
  }

  async addCartItem(user: AuthenticatedUser, input: AddCartItemDto) {
    const source = await this.resolveCartSource(input.type, input.id, user.id);
    if (!source?.available) {
      throw badRequest(
        'CART_ITEM_UNAVAILABLE',
        source?.availabilityMessage ?? 'El artículo no está disponible.',
      );
    }
    if (input.quantity > source.availableQuantity) {
      throw badRequest(
        'CART_QUANTITY_UNAVAILABLE',
        'La cantidad solicitada supera la disponibilidad.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.upsert({
        where: { userId: user.id },
        create: { userId: user.id, clubId: source.clubId },
        update: {},
        include: { items: { select: { id: true } } },
      });
      if (cart.items.length > 0 && cart.clubId !== source.clubId) {
        throw badRequest(
          'MULTI_CLUB_CART',
          'Finaliza o vacía el carrito actual antes de comprar en otro negocio.',
        );
      }
      if (cart.clubId !== source.clubId) {
        await tx.cart.update({ where: { id: cart.id }, data: { clubId: source.clubId } });
      }
      await tx.cartItem.upsert({
        where: {
          cartId_itemType_itemId: { cartId: cart.id, itemType: input.type, itemId: input.id },
        },
        create: {
          cartId: cart.id,
          itemType: input.type,
          itemId: input.id,
          quantity: input.quantity,
        },
        update: { quantity: input.quantity },
      });
    });
    return this.getCart(user);
  }

  async updateCartItem(user: AuthenticatedUser, cartItemId: string, quantity: number) {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: cartItemId, cart: { userId: user.id } },
    });
    if (!item) throw notFound('CART_ITEM_NOT_FOUND', 'El artículo no pertenece a tu carrito.');
    const source = await this.resolveCartSource(item.itemType, item.itemId, user.id);
    if (!source?.available || quantity > source.availableQuantity) {
      throw badRequest(
        'CART_QUANTITY_UNAVAILABLE',
        'La cantidad solicitada ya no está disponible.',
      );
    }
    await this.prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
    return this.getCart(user);
  }

  async updateProductDelivery(user: AuthenticatedUser, input: UpdateProductDeliveryDto) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId: user.id },
      include: { items: true },
    });
    if (!cart) throw notFound('CART_NOT_FOUND', 'No se encontró tu carrito.');

    const requestedItems = input.items ?? [];
    const productItems = new Map(
      cart.items
        .filter((item) => item.itemType === CommerceItemType.PRODUCT)
        .map((item) => [item.id, item]),
    );
    if (requestedItems.some((item) => !productItems.has(item.cartItemId))) {
      throw badRequest(
        'INVALID_PRODUCT_DELIVERY_ITEM',
        'Solo puedes configurar productos que pertenecen a tu carrito.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (input.combineProducts !== undefined) {
        await tx.cart.update({
          where: { id: cart.id },
          data: { combineProducts: input.combineProducts },
        });
      }
      for (const item of requestedItems) {
        await tx.cartItem.update({
          where: { id: item.cartItemId },
          data: { productDeliveryMode: item.mode },
        });
      }
    });
    return this.getCart(user);
  }

  async deleteCartItem(user: AuthenticatedUser, cartItemId: string) {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: cartItemId, cart: { userId: user.id } },
      include: { cart: true },
    });
    if (!item) throw notFound('CART_ITEM_NOT_FOUND', 'El artículo no pertenece a tu carrito.');
    await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.delete({ where: { id: item.id } });
      const remaining = await tx.cartItem.count({ where: { cartId: item.cartId } });
      if (remaining === 0)
        await tx.cart.update({
          where: { id: item.cartId },
          data: { clubId: null, combineProducts: false },
        });
    });
    return this.getCart(user);
  }

  private async resolveCartSource(type: CommerceItemType, id: string, userId?: string) {
    if (type === CommerceItemType.TICKET) {
      const source = await this.prisma.ticketType.findUnique({
        where: { id },
        include: {
          event: { select: { status: true } },
          club: {
            include: { sellerConnections: { where: mercadoPagoReadyRelation().some } },
          },
        },
      });
      const now = new Date();
      const alreadyOwned =
        source?.perUserLimit && userId
          ? await this.prisma.ticket.count({
              where: { ownerUserId: userId, ticketTypeId: source.id },
            })
          : 0;
      const reserved = await this.prisma.inventoryReservation.aggregate({
        where: {
          resourceType: type,
          resourceId: id,
          status: 'ACTIVE',
          expiresAt: { gt: now },
        },
        _sum: { quantity: true },
      });
      const globalAvailable = source
        ? Math.max(0, source.quantityTotal - source.quantitySold - (source.replacementReserved ?? 0) - (reserved._sum.quantity ?? 0))
        : 0;
      const userAvailable = source?.perUserLimit
        ? Math.max(0, source.perUserLimit - alreadyOwned)
        : globalAvailable;
      const paymentsReady =
        this.paymentGateway.provider !== 'mercado_pago' ||
        Boolean(source?.club.sellerConnections.length);
      const eventAllowsPurchase =
        !source?.eventId || source.event?.status === EventStatus.SALE_ACTIVE;
      const available = Boolean(
        source &&
        paymentsReady &&
        eventAllowsPurchase &&
        source.status === TicketTypeStatus.ACTIVE &&
        source.club.status === ClubStatus.ACTIVE &&
        globalAvailable > 0 &&
        userAvailable > 0 &&
        (!source.saleStartAt || source.saleStartAt <= now) &&
        (!source.saleEndAt || source.saleEndAt >= now),
      );
      return source
        ? {
            name: source.name,
            clubId: source.clubId,
            clubName: source.club.name,
            priceCents: source.priceCents,
            currency: source.currency,
            imageUrl: null as string | null,
            available,
            availableQuantity: Math.min(globalAvailable, userAvailable),
            availabilityMessage: available
              ? null
              : !paymentsReady
                ? 'Este negocio todavía no ha habilitado sus pagos con Mercado Pago.'
                : !eventAllowsPurchase
                  ? source.event?.status === EventStatus.PUBLISHED
                    ? 'Las ventas de este evento todavía no están activas.'
                    : 'Las ventas de este evento no están activas.'
                  : 'La entrada ya no está disponible.',
          }
        : null;
    }
    if (type === CommerceItemType.PRODUCT) {
      const source = await this.prisma.product.findUnique({
        where: { id },
        include: {
          club: {
            include: { sellerConnections: { where: mercadoPagoReadyRelation().some } },
          },
        },
      });
      const reserved = await this.prisma.inventoryReservation.aggregate({
        where: {
          resourceType: type,
          resourceId: id,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
        _sum: { quantity: true },
      });
      const availableQuantity = Math.max(
        0,
        (source?.stockQuantity ?? 0) - (reserved._sum.quantity ?? 0),
      );
      const paymentsReady =
        this.paymentGateway.provider !== 'mercado_pago' ||
        Boolean(source?.club.sellerConnections.length);
      const available = Boolean(
        source &&
        paymentsReady &&
        source.status === ProductStatus.ACTIVE &&
        source.club.status === ClubStatus.ACTIVE &&
        availableQuantity > 0,
      );
      return source
        ? {
            name: source.name,
            clubId: source.clubId,
            clubName: source.club.name,
            priceCents: source.priceCents,
            currency: source.currency,
            imageUrl: source.imageUrl,
            available,
            availableQuantity,
            availabilityMessage: available
              ? null
              : !paymentsReady
                ? 'Este negocio todavía no ha habilitado sus pagos con Mercado Pago.'
                : 'El producto ya no tiene stock.',
          }
        : null;
    }
    const source = await this.prisma.promotion.findUnique({
      where: { id },
      include: {
        event: { select: { status: true } },
        club: {
          include: { sellerConnections: { where: mercadoPagoReadyRelation().some } },
        },
      },
    });
    const now = new Date();
    const paymentsReady =
      this.paymentGateway.provider !== 'mercado_pago' ||
      Boolean(source?.club.sellerConnections.length);
    const eventAllowsPurchase =
      !source?.eventId || source.event?.status === EventStatus.SALE_ACTIVE;
    const available = Boolean(
      source &&
      paymentsReady &&
      eventAllowsPurchase &&
      source.status === PromotionStatus.ACTIVE &&
      source.club.status === ClubStatus.ACTIVE &&
      (!source.startsAt || source.startsAt <= now) &&
      (!source.endsAt || source.endsAt >= now),
    );
    return source
      ? {
          name: source.name,
          clubId: source.clubId,
          clubName: source.club.name,
          priceCents: source.finalPriceCents,
          currency: source.currency,
          imageUrl: source.imageUrl,
          available,
          availableQuantity: 20,
          availabilityMessage: available
            ? null
            : !paymentsReady
              ? 'Este negocio todavía no ha habilitado sus pagos con Mercado Pago.'
              : !eventAllowsPurchase
                ? source.event?.status === EventStatus.PUBLISHED
                  ? 'Las ventas de este evento todavía no están activas.'
                  : 'Las ventas de este evento no están activas.'
                : 'La promoción ya no está disponible.',
        }
      : null;
  }

  async getPayment(user: AuthenticatedUser, orderId: string) {
    let order = await this.prisma.order.findFirst({
      where: { id: orderId, userId: user.id },
      include: { paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order) throw notFound('ORDER_NOT_FOUND', 'No se encontró la orden.');
    const attempt = order.paymentAttempts[0];
    if (
      order.status === 'PENDING' &&
      attempt?.status === 'PENDING' &&
      attempt.externalPaymentId &&
      this.paymentGateway.queryExternalPayment
    ) {
      try {
        const event = await this.paymentGateway.queryExternalPayment(
          attempt.externalPaymentId,
          attempt.sellerExternalId ?? undefined,
        );
        await this.processPaymentEvent(event);
        order = await this.prisma.order.findFirstOrThrow({
          where: { id: orderId, userId: user.id },
          include: { paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } },
        });
      } catch (error) {
        this.logger.warn(
          JSON.stringify({
            event: 'checkout.payment.reconciliation_failed',
            orderId,
            attemptId: attempt.id,
            externalPaymentId: attempt.externalPaymentId,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }
    return this.paymentResponse(order, order.paymentAttempts[0] ?? null);
  }

  async simulatePayment(user: AuthenticatedUser, attemptId: string, outcome: PaymentOutcome) {
    if (this.config.get('NODE_ENV') === 'production' || !this.paymentGateway.createSimulatedEvent) {
      throw forbidden('PAYMENT_SIMULATOR_DISABLED', 'El simulador de pagos no está disponible.');
    }
    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        id: attemptId,
        OR: [{ order: { userId: user.id } }, { walletTopUp: { userId: user.id } }],
      },
    });
    if (!attempt?.externalPaymentId) {
      throw notFound('PAYMENT_ATTEMPT_NOT_FOUND', 'No se encontró el intento de pago.');
    }
    const event = this.paymentGateway.createSimulatedEvent(attempt.externalPaymentId, outcome);
    await this.processPaymentEvent(event);
    return attempt.orderId
      ? this.getPayment(user, attempt.orderId)
      : this.getWalletTopUp(user, attempt.walletTopUpId!);
  }

  async bindAuthoritativeExternalPayment(event: VerifiedPaymentEvent) {
    if (!event.attemptId)
      throw conflict(
        'MERCADO_PAGO_ATTEMPT_REQUIRED',
        'El pago no contiene la referencia del intento.',
      );
    const attempt = await this.prisma.paymentAttempt.findUnique({ where: { id: event.attemptId } });
    if (!attempt || attempt.provider !== event.provider)
      throw notFound('PAYMENT_ATTEMPT_NOT_FOUND', 'El pago del proveedor no está registrado.');
    if (attempt.externalPaymentId === event.externalPaymentId) return;
    await this.prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { externalPaymentId: event.externalPaymentId },
    });
  }

  async processPaymentEvent(event: VerifiedPaymentEvent) {
    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: { externalPaymentId: event.externalPaymentId },
      include: {
        order: { include: { items: true, user: { select: { fullName: true } } } },
        walletTopUp: true,
      },
    });
    if (!attempt || attempt.provider !== event.provider) {
      throw notFound('PAYMENT_ATTEMPT_NOT_FOUND', 'El pago del proveedor no está registrado.');
    }
    if (event.provider === 'mercado_pago') {
      const mismatch =
        attempt.purpose === 'WALLET_TOP_UP'
          ? event.attemptId !== attempt.id ||
            event.orderId !== attempt.walletTopUpId ||
            event.clubId != null ||
            event.currency !== attempt.currency ||
            event.amountCents !== attempt.amountCents ||
            event.marketplaceFeeCents !== 0
          : event.attemptId !== attempt.id ||
            event.orderId !== attempt.orderId ||
            event.clubId !== attempt.order?.clubId ||
            event.currency !== attempt.currency ||
            event.amountCents !== attempt.amountCents ||
            event.sellerExternalId !== attempt.sellerExternalId ||
            event.marketplaceFeeCents !== attempt.marketplaceFeeCents;
      if (mismatch) {
        throw conflict(
          'MERCADO_PAGO_PAYMENT_MISMATCH',
          'El pago consultado no coincide con el snapshot registrado.',
        );
      }
    }
    if (attempt.purpose === 'WALLET_TOP_UP') {
      return this.processWalletTopUpEvent(attempt, event);
    }
    if (!attempt.order || !attempt.orderId) {
      throw notFound('ORDER_PAYMENT_NOT_FOUND', 'No se encontró la orden asociada al pago.');
    }
    const order = attempt.order;
    const orderId = attempt.orderId;
    try {
      await this.prisma.paymentProviderEvent.create({
        data: {
          paymentAttemptId: attempt.id,
          provider: event.provider,
          providerEventId: event.providerEventId,
          type: `PAYMENT_${event.outcome}`,
          payload: event.payload as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        const existing = await this.prisma.paymentProviderEvent.findUnique({
          where: {
            provider_providerEventId: {
              provider: event.provider,
              providerEventId: event.providerEventId,
            },
          },
        });
        if (existing?.status === 'PROCESSED' || existing?.status === 'IGNORED') return;
      } else {
        throw error;
      }
    }
    if (event.outcome === 'PENDING') {
      await this.finishProviderEvent(event, 'IGNORED');
      return;
    }
    if (event.outcome === 'REFUND_PENDING') {
      await this.prisma.paymentAttempt.updateMany({
        where: { id: attempt.id, status: 'APPROVED' },
        data: { status: 'REFUND_PENDING' },
      });
      await this.prisma.order.updateMany({
        where: { id: orderId, status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } },
        data: { status: 'REFUND_PENDING' },
      });
      await this.finishProviderEvent(event, 'PROCESSED');
      return;
    }
    if (event.outcome === 'PARTIALLY_REFUNDED') {
      const providerRefundedCents = event.refundedAmountCents ?? attempt.refundedAmountCents;
      const refundDeltaCents = providerRefundedCents - attempt.refundedAmountCents;
      if (refundDeltaCents <= 0 || providerRefundedCents >= attempt.amountCents) {
        await this.finishProviderEvent(event, 'IGNORED');
        return;
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`);
        const current = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
        const refundDeltaCents = providerRefundedCents - current.refundedAmountCents;
        if (refundDeltaCents <= 0) return;
        const feeDeltaCents = Math.round(providerRefundedCents * (attempt.marketplaceFeeCents ?? 0) / attempt.amountCents) - Math.round(current.refundedAmountCents * (attempt.marketplaceFeeCents ?? 0) / attempt.amountCents);
        await this.ledger?.reverseSalePartial(tx, {
          paymentAttemptId: attempt.id,
          providerEventId: event.providerEventId,
          amountCents: refundDeltaCents,
          marketplaceFeeCents: feeDeltaCents,
        });
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: { status: 'PARTIALLY_REFUNDED', refundedAmountCents: providerRefundedCents },
        });
        await tx.order.update({ where: { id: orderId }, data: { status: 'PARTIALLY_REFUNDED' } });
        await tx.refundRequest.updateMany({
          where: { orderId, status: 'PROCESSING', eventJob: { is: null }, approvedAmountCents: refundDeltaCents },
          data: {
            status: 'COMPLETED',
            processedAmountCents: refundDeltaCents,
            marketplaceFeeRefundedCents: feeDeltaCents,
            completedAt: new Date(),
          },
        });
        const wallet = await tx.wallet.findUnique({ where: { userId: order.userId } });
        if (wallet)
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { totalSpentCents: { decrement: refundDeltaCents } },
          });
        await this.notifications?.notifyFromTemplate(
          order.userId,
          'PAYMENT_PARTIALLY_REFUNDED',
          { amount: (refundDeltaCents / 100).toFixed(2), orderId },
          { orderId, paymentAttemptId: attempt.id },
          tx,
        );
      });
      await this.finishProviderEvent(event, 'PROCESSED');
      return;
    }
    if (event.outcome === 'REFUNDED' || event.outcome === 'CHARGEBACK') {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`);
        const current = await tx.paymentAttempt.findUnique({ where: { id: attempt.id } });
        if (!current || current.status === 'REFUNDED') return;
        if (!['APPROVED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED'].includes(current.status)) {
          throw conflict('PAYMENT_NOT_REFUNDABLE', 'Solo un pago aprobado puede reembolsarse.');
        }
        const remainingAmountCents = attempt.amountCents - current.refundedAmountCents;
        const remainingFeeCents =
          (attempt.marketplaceFeeCents ?? 0) -
          Math.round(
            (current.refundedAmountCents * (attempt.marketplaceFeeCents ?? 0)) /
              attempt.amountCents,
          );
        if (current.refundedAmountCents > 0) {
          await this.ledger?.reverseSalePartial(tx, {
            paymentAttemptId: attempt.id,
            providerEventId: event.providerEventId,
            amountCents: remainingAmountCents,
            marketplaceFeeCents: remainingFeeCents,
          });
        } else {
          await this.ledger?.reverseSale(tx, {
            paymentAttemptId: attempt.id,
            providerEventId: event.providerEventId,
            type: event.outcome === 'REFUNDED' ? 'REFUND' : 'CHARGEBACK',
          });
        }
        const refundedAt = new Date();
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: event.outcome === 'CHARGEBACK' ? 'CHARGEBACK' : 'REFUNDED',
            failedAt: refundedAt,
            refundedAmountCents: attempt.amountCents,
          },
        });
        await tx.order.update({
          where: { id: orderId },
          data: { status: event.outcome === 'CHARGEBACK' ? 'CHARGEBACK' : 'REFUNDED' },
        });
        if (event.outcome === 'REFUNDED') {
          await tx.refundRequest.updateMany({
            where: { orderId, status: { in: ['APPROVED', 'PROCESSING'] }, eventJob: { is: null }, approvedAmountCents: remainingAmountCents },
            data: {
              status: 'COMPLETED',
              processedAmountCents: remainingAmountCents,
              marketplaceFeeRefundedCents: remainingFeeCents,
              completedAt: refundedAt,
            },
          });
        }
        await this.referrals?.reverseOrderEffects(tx, orderId, event.outcome);
        const revokedReason =
          event.outcome === 'CHARGEBACK' ? 'PAYMENT_CHARGEBACK' : 'PAYMENT_REFUNDED';
        await Promise.all([
          tx.ticket.updateMany({
            where: { orderId, status: 'AVAILABLE' },
            data: { status: 'CANCELLED', revokedAt: refundedAt, revokedReason },
          }),
          tx.consumableRight.updateMany({
            where: { orderId, status: 'AVAILABLE' },
            data: { status: 'CANCELLED', revokedAt: refundedAt, revokedReason },
          }),
          tx.productDelivery.updateMany({
            where: { orderId, status: 'AVAILABLE' },
            data: { status: 'CANCELLED', revokedAt: refundedAt, revokedReason },
          }),
        ]);
        const wallet = await tx.wallet.findUnique({ where: { userId: order.userId } });
        if (wallet) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { totalSpentCents: { decrement: remainingAmountCents } },
          });
          await tx.walletMovement.create({
            data: {
              walletId: wallet.id,
              type: 'REFUND',
              status: 'COMPLETED',
              amountCents: remainingAmountCents,
              description:
                event.outcome === 'CHARGEBACK' ? 'Contracargo confirmado' : 'Reembolso confirmado',
              referenceId: orderId,
              completedAt: refundedAt,
            },
          });
        }
        await this.notifications?.notifyFromTemplate(
          order.userId,
          event.outcome === 'CHARGEBACK' ? 'PAYMENT_CHARGEBACK' : 'PAYMENT_REFUNDED',
          { amount: (remainingAmountCents / 100).toFixed(2), orderId },
          { orderId, paymentAttemptId: attempt.id },
          tx,
        );
      });
      await this.finishProviderEvent(event, 'PROCESSED');
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`);
      const current = await tx.paymentAttempt.findUnique({ where: { id: attempt.id } });
      if (!current || (current.status !== 'PENDING' && !(current.status === 'EXPIRED' && event.outcome === 'APPROVED'))) return;
      if (event.outcome === 'APPROVED') {
        const paidAt = new Date();
        const fulfilled = await this.confirmOrderReservations(tx, order, paidAt);
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: { status: 'APPROVED', approvedAt: paidAt,
            ...(event.provider === 'mercado_pago' && /^\d+$/.test(String(event.payload?.id ?? '')) ? { providerData: { ...(attempt.providerData as Prisma.JsonObject ?? {}), paymentId: String(event.payload!.id) } } : {}),
          },
        });
        await tx.order.update({ where: { id: orderId }, data: { status: 'PAID', paidAt } });
        const wallet = await tx.wallet.upsert({
          where: { userId: order.userId },
          create: { userId: order.userId, totalSpentCents: attempt.amountCents },
          update: { totalSpentCents: { increment: attempt.amountCents } },
        });
        if (event.provider !== 'beerry_wallet') {
          await tx.walletMovement.create({
            data: {
              walletId: wallet.id,
              type: 'PURCHASE',
              status: 'COMPLETED',
              amountCents: -attempt.amountCents,
              description: `Compra confirmada por ${event.provider}`,
              referenceId: orderId,
              completedAt: paidAt,
            },
          });
        }
        await this.ledger?.postSale(tx, {
          orderId,
          paymentAttemptId: attempt.id,
          providerEventId: event.providerEventId,
          customerUserId: order.userId,
          clubId: order.clubId,
          provider: event.provider,
          amountCents: order.totalCents,
          currency: attempt.currency,
          marketplaceFeeBps: attempt.marketplaceFeeBps ?? undefined,
          marketplaceFeeCents: attempt.marketplaceFeeCents ?? undefined,
        });
        if (fulfilled) {
          await this.referrals?.createRewardForPaidOrder(tx, orderId);
          await this.issueOrderResources(tx, order);
        } else {
          await tx.refundRequest.create({ data: { orderId, clubId: order.clubId, requestedByUserId: order.userId, reason: 'Pago confirmado después del vencimiento de la reserva. Requiere resolución de Beerry.', status: 'UNDER_REVIEW', requestedAmountCents: attempt.amountCents } });
          await tx.order.update({ where: { id: orderId }, data: { status: 'REFUND_PENDING' } });
          const reviewers = await tx.user.findMany({ where: { role: UserRole.SUPER_ADMIN, status: 'ACTIVE' }, select: { id: true } });
          if (reviewers.length) await tx.notification.createMany({ data: reviewers.map((reviewer) => ({ userId: reviewer.id, category: 'EVENT' as const, title: 'Pago recibido sin reserva vigente', body: 'Revisa la compra y su solicitud de devolución. No se emitieron QR.', data: { orderId } })) });
          await tx.notification.create({ data: { userId: order.userId, category: 'EVENT', title: 'Pago recibido: compra en revisión', body: 'El pago se confirmó cuando la reserva ya no estaba disponible. No se emitieron QR. Beerry revisará la solución.', data: { orderId } } });
        }
        await this.notifications?.notifyFromTemplate(
          order.userId,
          'PAYMENT_APPROVED',
          { amount: (attempt.amountCents / 100).toFixed(2), orderId },
          { orderId, paymentAttemptId: attempt.id },
          tx,
        );
        if (fulfilled) await this.notifications?.notifyFromTemplate(
          order.userId,
          'QR_AVAILABLE',
          { orderId },
          { orderId },
          tx,
        );
        await this.notifyClubSale(tx, order, order.totalCents, attempt.currency);
        const cart = await tx.cart.findUnique({ where: { userId: order.userId } });
        if (cart) {
          for (const orderedItem of order.items) {
            const cartItem = await tx.cartItem.findUnique({
              where: {
                cartId_itemType_itemId: {
                  cartId: cart.id,
                  itemType: orderedItem.itemType,
                  itemId: orderedItem.itemId,
                },
              },
            });
            if (!cartItem) continue;
            if (cartItem.quantity <= orderedItem.quantity) {
              await tx.cartItem.delete({ where: { id: cartItem.id } });
            } else {
              await tx.cartItem.update({
                where: { id: cartItem.id },
                data: { quantity: { decrement: orderedItem.quantity } },
              });
            }
          }
          const remaining = await tx.cartItem.count({ where: { cartId: cart.id } });
          if (remaining === 0)
            await tx.cart.update({
              where: { id: cart.id },
              data: { clubId: null, combineProducts: false },
            });
        }
      } else {
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status:
              event.outcome === 'EXPIRED'
                ? 'EXPIRED'
                : event.outcome === 'CANCELLED'
                  ? 'CANCELLED'
                  : 'REJECTED',
            failureCode: event.failureCode,
            failureMessage: event.failureMessage,
            failedAt: new Date(),
          },
        });
        await tx.order.update({
          where: { id: orderId },
          data: {
            status:
              event.outcome === 'EXPIRED'
                ? 'EXPIRED'
                : event.outcome === 'CANCELLED'
                  ? 'CANCELLED'
                  : 'FAILED',
          },
        });
        await this.releaseOrderReservations(
          tx,
          orderId,
          event.outcome === 'EXPIRED' ? 'EXPIRED' : 'RELEASED',
        );
        await this.notifications?.notifyFromTemplate(
          order.userId,
          event.outcome === 'EXPIRED' ? 'PAYMENT_EXPIRED' : 'PAYMENT_REJECTED',
          { orderId },
          { orderId, paymentAttemptId: attempt.id },
          tx,
        );
      }
    });
    await this.finishProviderEvent(event, 'PROCESSED');
  }

  async issueReplacementResources(tx: Prisma.TransactionClient, orderItemId: string, targetItemId: string, targetEventId: string) {
    const item = await tx.orderItem.findUniqueOrThrow({ where: { id: orderItemId }, include: { order: true } });
    // New resource IDs: a QR from the cancelled event remains cancelled forever.
    await this.issueOrderResources(tx, { id: item.orderId, userId: item.order.userId, combineProducts: false,
      items: [{ ...item, itemId: targetItemId, eventId: targetEventId }] });
  }

  private async issueOrderResources(
    tx: any,
    order: { id: string; userId: string; combineProducts: boolean; items: any[] },
  ) {
    // Cancellation and late payment issuance serialize on the same event lock.
    // Payment approval remains a financial fact; cancelled rights must not become usable.
    const eventStates = new Map<string, { status: string; startsAt: Date; endsAt: Date }>();
    const eventIds = [...new Set<string>(order.items.map((item) => item.eventId).filter(Boolean))].sort();
    for (const eventId of eventIds) {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR SHARE`);
      eventStates.set(eventId, await tx.event.findUniqueOrThrow({ where: { id: eventId } }));
    }
    const productItems = order.items.filter((item) => item.itemType === CommerceItemType.PRODUCT);
    for (const group of buildProductDeliveryPlan(order.combineProducts, productItems)) {
      await this.createProductDelivery(tx, order, group);
    }

    for (const item of order.items) {
      if (item.itemType === CommerceItemType.PRODUCT) continue;
      for (let index = 0; index < item.quantity; index++) {
        const id = randomUUID();
        const code = this.backupCode();
        if (item.itemType === CommerceItemType.TICKET) {
          const ticketType = await tx.ticketType.findUnique({
            where: { id: item.itemId },
            include: { event: true },
          });
          const eventId = item.eventId ?? ticketType?.eventId;
          const event = eventStates.get(eventId) ?? ticketType?.event;
          const cancelled = event?.status === 'CANCELLED';
          await tx.ticket.create({
            data: {
              id,
              orderId: order.id,
              orderItemId: item.id,
              clubId: item.clubId,
              eventId,
              ticketTypeId: item.itemId,
              ownerUserId: order.userId,
              code,
              qrPayload: this.qr('TICKET', id, item.clubId, eventId),
              signatureVersion: this.activeSigningVersion(),
              validFrom: event?.startsAt ?? null,
              validUntil: event?.endsAt ?? ticketType?.saleEndAt,
              ...(cancelled ? { status: 'CANCELLED', revokedAt: new Date(), revokedReason: `EVENT_CANCELLED:${eventId}` } : {}),
            },
          });
        } else {
          const promotion = await tx.promotion.findUnique({
            where: { id: item.itemId },
            include: { event: true },
          });
          const eventId = item.eventId ?? promotion?.eventId;
          const event = eventStates.get(eventId) ?? promotion?.event;
          const cancelled = event?.status === 'CANCELLED';
          await tx.consumableRight.create({
            data: {
              id,
              orderId: order.id,
              orderItemId: item.id,
              clubId: item.clubId,
              eventId,
              ownerUserId: order.userId,
              sourceType: item.itemType,
              sourceId: item.itemId,
              promotionId: item.itemId,
              code,
              qrPayload: this.qr('PROMOTION', id, item.clubId, eventId),
              signatureVersion: this.activeSigningVersion(),
              validFrom: promotion?.startsAt ?? promotion?.event?.startsAt ?? null,
              validUntil: promotion?.endsAt ?? promotion?.event?.endsAt ?? null,
              ...(cancelled ? { status: 'CANCELLED', revokedAt: new Date(), revokedReason: `EVENT_CANCELLED:${eventId}` } : {}),
            },
          });
        }
      }
    }
    if ([...eventStates.values()].some((event) => event.status === 'CANCELLED')) {
      await tx.notification.create({ data: { userId: order.userId, category: 'EVENT',
        title: 'Compra recibida después de una cancelación',
        body: 'El pago fue recibido, pero el evento está cancelado. Los QR afectados no son válidos. Revisa el estado de tu compra; aún no hay una devolución confirmada.',
        data: { orderId: order.id },
      } });
      await tx.auditLogEntry.create({ data: { action: 'PAYMENT_APPROVED_AFTER_EVENT_CANCELLATION',
        resourceType: 'ORDER', resourceId: order.id, metadata: { eventIds },
      } });
    }
  }

  private async createProductDelivery(
    tx: any,
    order: { id: string; userId: string },
    items: Array<{
      id: string;
      itemId: string;
      clubId: string;
      nameSnapshot: string;
      quantity: number;
    }>,
  ) {
    const id = randomUUID();
    await tx.productDelivery.create({
      data: {
        id,
        orderId: order.id,
        clubId: items[0].clubId,
        ownerUserId: order.userId,
        code: this.backupCode(),
        qrPayload: this.qr('PRODUCT', id, items[0].clubId),
        signatureVersion: this.activeSigningVersion(),
        items: {
          create: items.map((item) => ({
            orderItemId: item.id,
            productId: item.itemId,
            nameSnapshot: item.nameSnapshot,
            quantity: item.quantity,
          })),
        },
      },
    });
  }

  private async notifyClubSale(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      clubId: string;
      user: { fullName: string };
      items: Array<{ itemType: CommerceItemType; nameSnapshot: string; quantity: number }>;
    },
    amountCents: number,
    currency: string,
  ) {
    if (!this.notifications) return;
    const [admins, workers] = await Promise.all([
      tx.clubAdmin.findMany({ where: { clubId: order.clubId }, select: { userId: true } }),
      tx.clubWorker.findMany({
        where: {
          clubId: order.clubId,
          status: ClubWorkerStatus.ACTIVE,
          permissions: { has: WorkerPermission.VIEW_SALES },
        },
        select: { userId: true },
      }),
    ]);
    const kinds = new Set(order.items.map((item) => item.itemType));
    const saleType =
      kinds.size > 1
        ? 'compra mixta'
        : kinds.has(CommerceItemType.TICKET)
          ? 'entrada'
          : kinds.has(CommerceItemType.PRODUCT)
            ? 'producto'
            : 'promoción';
    const itemSummary = order.items
      .map((item) => `${item.nameSnapshot} x${item.quantity}`)
      .join(', ');
    const recipientIds = [...new Set([...admins, ...workers].map((recipient) => recipient.userId))];
    await Promise.all(
      recipientIds.map((userId) =>
        this.notifications!.notifyFromTemplate(
          userId,
          'ADMIN_NEW_SALE',
          {
            saleType,
            customerName: order.user.fullName,
            amount: (amountCents / 100).toFixed(2),
            itemSummary,
          },
          {
            orderId: order.id,
            clubId: order.clubId,
            saleType,
            amountCents,
            currency,
            itemTypes: [...kinds],
          },
          tx,
        ),
      ),
    );
  }

  private async assertEventForCheckout(tx: Prisma.TransactionClient, eventId: string) {
    // Serialize with changes to the event, retaining the lock until checkout commits.
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR SHARE`);
    const event = await tx.event.findUnique({ where: { id: eventId }, select: { status: true, endsAt: true } });
    if (!event || !eventAllowsSales(event)) {
      throw badRequest('EVENT_SALES_UNAVAILABLE', 'Este evento no admite nuevas compras en este momento.');
    }
  }

  private async lockInventoryResource(
    tx: Prisma.TransactionClient,
    type: CommerceItemType,
    resourceId: string,
  ) {
    const key = `${type}:${resourceId}`;
    await tx.$queryRaw(Prisma.sql`
      SELECT 1 AS "locked"
      FROM pg_advisory_xact_lock(hashtext(${key}))
    `);
  }

  private async confirmOrderReservations(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      items: Array<{ itemType: CommerceItemType; itemId: string; quantity: number }>;
    },
    confirmedAt: Date,
  ) {
    const expectedItems = order.items.filter(
      (item) =>
        item.itemType === CommerceItemType.TICKET || item.itemType === CommerceItemType.PRODUCT,
    );
    const reservations = await tx.inventoryReservation.findMany({
      where: { orderId: order.id, status: 'ACTIVE' },
      orderBy: [{ resourceType: 'asc' }, { resourceId: 'asc' }],
    });
    if (reservations.length !== expectedItems.length) {
      return false;
    }
    if (reservations.some((reservation) => reservation.expiresAt <= confirmedAt)) return false;
    // Lock and validate every resource before consuming any of them. An already
    // approved payment must be recorded for manual refund when stock is missing.
    for (const reservation of reservations) {
      await this.lockInventoryResource(tx, reservation.resourceType, reservation.resourceId);
      if (reservation.resourceType === CommerceItemType.TICKET) {
        const rows = await tx.$queryRaw<Array<{ available: number }>>(Prisma.sql`
          SELECT "quantityTotal" - "quantitySold" - "replacementReserved" AS available
          FROM "TicketType" WHERE id = ${reservation.resourceId} FOR UPDATE`);
        if (!rows.length || rows[0].available < reservation.quantity) return false;
      } else if (reservation.resourceType === CommerceItemType.PRODUCT) {
        const rows = await tx.$queryRaw<Array<{ available: number }>>(Prisma.sql`
          SELECT "stockQuantity" AS available FROM "Product" WHERE id = ${reservation.resourceId} FOR UPDATE`);
        if (!rows.length || rows[0].available < reservation.quantity) return false;
      }
    }
    for (const reservation of reservations) {
      await this.lockInventoryResource(tx, reservation.resourceType, reservation.resourceId);
      const claimed = await tx.inventoryReservation.updateMany({
        where: { id: reservation.id, status: 'ACTIVE', expiresAt: { gt: confirmedAt } },
        data: { status: 'CONFIRMED', confirmedAt },
      });
      if (claimed.count !== 1) {
        throw conflict('RESERVATION_EXPIRED', 'La reserva venció antes de confirmar el pago.');
      }
      if (reservation.resourceType === CommerceItemType.TICKET) {
        const updated = await tx.ticketType.updateMany({
          where: {
            id: reservation.resourceId,
            quantitySold: {
              lte:
                (await tx.ticketType.findUniqueOrThrow({ where: { id: reservation.resourceId } }))
                  .quantityTotal - reservation.quantity,
            },
          },
          data: { quantitySold: { increment: reservation.quantity } },
        });
        if (updated.count !== 1)
          throw conflict('TICKET_OVERSOLD', 'No se pudo confirmar la entrada reservada.');
      } else if (reservation.resourceType === CommerceItemType.PRODUCT) {
        const updated = await tx.product.updateMany({
          where: { id: reservation.resourceId, stockQuantity: { gte: reservation.quantity } },
          data: { stockQuantity: { decrement: reservation.quantity } },
        });
        if (updated.count !== 1)
          throw conflict('PRODUCT_OVERSOLD', 'No se pudo confirmar el producto reservado.');
      }
    }
    return true;
  }

  private async releaseOrderReservations(
    tx: Prisma.TransactionClient,
    orderId: string,
    status: 'RELEASED' | 'EXPIRED',
  ) {
    await tx.inventoryReservation.updateMany({
      where: { orderId, status: 'ACTIVE' },
      data: { status, releasedAt: new Date() },
    });
  }

  async expirePendingOrders() {
    const now = new Date();
    const attempts = await this.prisma.paymentAttempt.findMany({
      where: { purpose: 'ORDER_PAYMENT', status: 'PENDING', expiresAt: { lte: now } },
      select: { id: true, orderId: true, order: { select: { userId: true } } },
      take: 100,
    });
    for (const attempt of attempts) {
      if (!attempt.orderId || !attempt.order) continue;
      const orderId = attempt.orderId;
      const order = attempt.order;
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`);
        const expired = await tx.paymentAttempt.updateMany({
          where: { id: attempt.id, status: 'PENDING', expiresAt: { lte: now } },
          data: { status: 'EXPIRED', failedAt: now, failureCode: 'PAYMENT_TIMEOUT' },
        });
        if (expired.count !== 1) return;
        await tx.order.updateMany({
          where: { id: orderId, status: 'PENDING' },
          data: { status: 'EXPIRED' },
        });
        await this.releaseOrderReservations(tx, orderId, 'EXPIRED');
        await this.notifications?.notifyFromTemplate(
          order.userId,
          'PAYMENT_EXPIRED',
          { orderId },
          { orderId, paymentAttemptId: attempt.id },
          tx,
        );
      });
    }
    return { expiredOrders: attempts.length };
  }

  async getReservationMetrics(user: AuthenticatedUser, clubId: string) {
    if (user.role !== UserRole.SUPER_ADMIN) {
      const [admin, worker] = await Promise.all([
        this.prisma.clubAdmin.findUnique({
          where: { clubId_userId: { clubId, userId: user.id } },
          select: { id: true },
        }),
        this.prisma.clubWorker.findFirst({
          where: {
            clubId,
            userId: user.id,
            status: ClubWorkerStatus.ACTIVE,
            permissions: { has: WorkerPermission.VIEW_DASHBOARD },
          },
          select: { id: true },
        }),
      ]);
      if (!admin && !worker) {
        throw forbidden('RESERVATION_METRICS_FORBIDDEN', 'No puedes consultar estas reservas.');
      }
    }
    const grouped = await this.prisma.inventoryReservation.groupBy({
      by: ['status'],
      where: { order: { clubId } },
      _count: { _all: true },
      _sum: { quantity: true },
    });
    return {
      clubId,
      statuses: Object.fromEntries(
        grouped.map((item) => [
          item.status,
          { reservations: item._count._all, units: item._sum.quantity ?? 0 },
        ]),
      ),
    };
  }

  private async finishProviderEvent(event: VerifiedPaymentEvent, status: 'PROCESSED' | 'IGNORED') {
    await this.prisma.paymentProviderEvent.update({
      where: {
        provider_providerEventId: {
          provider: event.provider,
          providerEventId: event.providerEventId,
        },
      },
      data: { status, processedAt: new Date() },
    });
  }

  private async processWalletTopUpEvent(attempt: any, event: VerifiedPaymentEvent) {
    if (!attempt.walletTopUp)
      throw notFound('WALLET_TOP_UP_NOT_FOUND', 'No se encontró la recarga asociada.');
    try {
      await this.prisma.paymentProviderEvent.create({
        data: {
          paymentAttemptId: attempt.id,
          provider: event.provider,
          providerEventId: event.providerEventId,
          type: `WALLET_TOP_UP_${event.outcome}`,
          payload: event.payload as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        const existing = await this.prisma.paymentProviderEvent.findUnique({
          where: {
            provider_providerEventId: {
              provider: event.provider,
              providerEventId: event.providerEventId,
            },
          },
        });
        if (existing?.status === 'PROCESSED' || existing?.status === 'IGNORED') return;
      } else {
        throw error;
      }
    }
    if (event.outcome === 'PENDING') {
      await this.finishProviderEvent(event, 'IGNORED');
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.paymentAttempt.findUnique({ where: { id: attempt.id } });
      if (!current || current.status !== 'PENDING') return;
      const now = new Date();
      if (event.outcome === 'APPROVED') {
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: { status: 'APPROVED', approvedAt: now },
        });
        await tx.walletTopUp.update({
          where: { id: attempt.walletTopUp.id },
          data: { status: 'APPROVED', approvedAt: now },
        });
        await tx.wallet.update({
          where: { id: attempt.walletTopUp.walletId },
          data: { balanceCents: { increment: attempt.amountCents } },
        });
        await tx.walletCreditLot.create({
          data: {
            walletId: attempt.walletTopUp.walletId,
            source: 'TOP_UP',
            sourceReferenceId: attempt.walletTopUp.id,
            originalAmountCents: attempt.amountCents,
            remainingAmountCents: attempt.amountCents,
          },
        });
        await tx.walletMovement.create({
          data: {
            walletId: attempt.walletTopUp.walletId,
            type: 'TOP_UP',
            status: 'COMPLETED',
            amountCents: attempt.amountCents,
            description: `Recarga confirmada por ${event.provider}`,
            referenceId: attempt.walletTopUp.id,
            completedAt: now,
          },
        });
        await this.ledger?.postWalletTopUp(tx, {
          topUpId: attempt.walletTopUp.id,
          paymentAttemptId: attempt.id,
          providerEventId: event.providerEventId,
          customerUserId: attempt.walletTopUp.userId,
          provider: event.provider,
          amountCents: attempt.amountCents,
          currency: attempt.currency,
        });
      } else {
        const expired = event.outcome === 'EXPIRED';
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: expired ? 'EXPIRED' : 'REJECTED',
            failureCode: event.failureCode,
            failureMessage: event.failureMessage,
            failedAt: now,
          },
        });
        await tx.walletTopUp.update({
          where: { id: attempt.walletTopUp.id },
          data: {
            status: expired ? 'EXPIRED' : 'REJECTED',
            rejectedAt: now,
            failureCode: event.failureCode,
            failureMessage: event.failureMessage,
          },
        });
      }
    });
    await this.finishProviderEvent(event, 'PROCESSED');
  }

  private paymentResponse(order: any, attempt: any, checkoutUrl?: string) {
    const storedProviderData =
      attempt?.providerData && typeof attempt.providerData === 'object'
        ? (attempt.providerData as Record<string, unknown>)
        : undefined;
    return {
      message:
        order.status === 'PENDING'
          ? 'Orden creada. El pago está pendiente.'
          : 'Estado del pago actualizado.',
      orderId: order.id,
      orderStatus: order.status,
      paymentAttemptId: attempt?.id ?? null,
      paymentStatus: attempt?.status ?? null,
      paymentProvider: attempt?.provider ?? null,
      paymentMethod: order.paymentMethod ?? null,
      checkoutUrl: checkoutUrl ?? storedProviderData?.checkoutUrl ?? null,
      total: order.totalCents / 100,
      currency: order.currency,
      generatedCount: order.status === 'PAID' ? undefined : 0,
    };
  }

  private topUpResponse(topUp: any, attempt: any, checkoutUrl?: string) {
    const storedProviderData =
      attempt?.providerData && typeof attempt.providerData === 'object'
        ? (attempt.providerData as Record<string, unknown>)
        : undefined;
    return {
      topUpId: topUp.id,
      status: topUp.status,
      amountCents: topUp.amountCents,
      currency: topUp.currency,
      paymentAttemptId: attempt?.id ?? null,
      paymentStatus: attempt?.status ?? null,
      paymentProvider: attempt?.provider ?? null,
      checkoutUrl: checkoutUrl ?? storedProviderData?.checkoutUrl ?? null,
      createdAt: topUp.createdAt,
      approvedAt: topUp.approvedAt,
    };
  }

  private paymentPayerEmail(optionalEmail?: string | null) {
    if (optionalEmail?.trim()) return optionalEmail.trim().toLowerCase();
    return undefined;
  }

  private walletTopUpGateway() {
    return this.configuredWalletTopUpGateway ?? this.paymentGateway;
  }
  private requiredMarketplaceFees() {
    if (!this.marketplaceFees) throw new Error('MARKETPLACE_FEE_SERVICE_NOT_AVAILABLE');
    return this.marketplaceFees;
  }

  async validateCode(
    user: AuthenticatedUser,
    clubId: string,
    kind: ValidationKind,
    rawCode: string,
    confirmUse: boolean,
  ) {
    await this.assertValidationPermission(user, clubId, kind);
    const code = rawCode.trim();
    if (!code) {
      throw badRequest('VALIDATION_CODE_REQUIRED', 'Ingresa un código válido.');
    }
    if (kind === 'PRODUCT') {
      const delivery = await this.validateProductDelivery(user, clubId, code, confirmUse);
      if (delivery) return delivery;
    }
    const signedResourceId = code.includes('.') ? this.untrustedSignedResourceId(code) : null;

    const ticket =
      kind === 'TICKET'
        ? await this.prisma.ticket.findFirst({
            where: {
              clubId,
              OR: [
                { code: code.toUpperCase() },
                { qrPayload: code },
                ...(signedResourceId ? [{ id: signedResourceId }] : []),
              ],
            },
            include: {
              owner: true,
              ticketType: true,
              event: true,
              club: true,
              order: true,
            },
          })
        : null;
    const consumable =
      kind !== 'TICKET'
        ? await this.prisma.consumableRight.findFirst({
            where: {
              clubId,
              sourceType:
                kind === 'PRODUCT' ? CommerceItemType.PRODUCT : CommerceItemType.PROMOTION,
              OR: [
                { code: code.toUpperCase() },
                { qrPayload: code },
                ...(signedResourceId ? [{ id: signedResourceId }] : []),
              ],
            },
            include: {
              owner: true,
              product: true,
              promotion: true,
              event: true,
              club: true,
              order: true,
            },
          })
        : null;
    const resource = ticket ?? consumable;

    if (!resource) {
      await this.recordValidationAttempt(user, clubId, code, 'INVALID', kind, null, 'NOT_FOUND');
      return this.invalidValidation(
        'CÓDIGO NO ENCONTRADO',
        'El código no pertenece a este local o al tipo seleccionado.',
      );
    }
    if (code.includes('.') && !this.isSignedQrValid(code, kind, resource.id, clubId)) {
      await this.recordValidationAttempt(
        user,
        clubId,
        code,
        'INVALID',
        kind,
        resource.id,
        'INVALID_SIGNATURE',
      );
      return this.invalidValidation('QR INVÁLIDO', 'La firma del código QR no es válida.');
    }
    const accessName = ticket
      ? ticket.ticketType.name
      : (consumable?.product?.name ?? consumable?.promotion?.name ?? 'Producto o promoción');
    const eventDate = resource.event?.startsAt ?? resource.validUntil;
    const attendeeImageUrl = await this.uploadsService.createReadableImageUrl(
      resource.owner.profileImageUrl,
    );
    if (resource.status !== RedeemableStatus.AVAILABLE) {
      if (resource.status === RedeemableStatus.USED) {
        await this.recordValidationAttempt(
          user,
          clubId,
          code,
          'REPEATED',
          kind,
          resource.id,
          'ALREADY_REDEEMED',
        );
        const audit = await this.prisma.auditLogEntry.findFirst({
          where: {
            clubId,
            resourceType: kind,
            resourceId: resource.id,
            action: this.validationAction(kind),
          },
          include: { actor: true },
          orderBy: { createdAt: 'desc' },
        });
        const usedAt = audit?.createdAt ?? resource.usedAt;
        const validatorName = audit?.actor.fullName ?? 'Trabajador no identificado';
        return {
          validation: {
            isValid: false,
            statusLabel: 'CÓDIGO YA UTILIZADO',
            title: 'Este código ya fue canjeado',
            message: usedAt
              ? `Fue confirmado por ${validatorName} el ${this.dateTimeLabel(usedAt)}.`
              : 'Este código ya fue canjeado y no puede volver a utilizarse.',
            attendeeName: resource.owner.fullName,
            attendeeReference: `${resource.owner.phoneCountryCode} ${resource.owner.phoneNumber}`,
            attendeeImageUrl,
            accessTypeLabel:
              kind === 'TICKET' ? 'ENTRADA' : kind === 'PRODUCT' ? 'PRODUCTO' : 'PROMOCIÓN',
            accessName,
            eventDateLabel: this.dateLabel(eventDate),
            scanTimeLabel: usedAt ? this.timeLabel(usedAt) : 'Hora no disponible',
            transactionId: `#${resource.order.id.slice(0, 12).toUpperCase()}`,
            validatedByName: validatorName,
            validatedAt: usedAt?.toISOString() ?? null,
          },
        };
      }
      await this.recordValidationAttempt(
        user,
        clubId,
        code,
        'INVALID',
        kind,
        resource.id,
        `STATUS_${resource.status}`,
      );
      return this.invalidValidation(
        'CÓDIGO NO DISPONIBLE',
        'Este código ya no se encuentra disponible.',
      );
    }
    if (resource.revokedAt) {
      await this.recordValidationAttempt(
        user,
        clubId,
        code,
        'INVALID',
        kind,
        resource.id,
        'REVOKED',
      );
      return this.invalidValidation(
        'CÓDIGO REVOCADO',
        resource.revokedReason ?? 'Este derecho fue cancelado o reembolsado.',
      );
    }
    if (resource.validFrom && resource.validFrom.getTime() > Date.now()) {
      await this.recordValidationAttempt(
        user,
        clubId,
        code,
        'INVALID',
        kind,
        resource.id,
        'NOT_YET_VALID',
      );
      return this.invalidValidation(
        'CÓDIGO AÚN NO VIGENTE',
        'Este código todavía no se puede utilizar.',
      );
    }
    if (resource.validUntil && resource.validUntil.getTime() < Date.now()) {
      await this.recordValidationAttempt(
        user,
        clubId,
        code,
        'INVALID',
        kind,
        resource.id,
        'EXPIRED',
      );
      return this.invalidValidation('CÓDIGO VENCIDO', 'La vigencia de este código ya finalizó.');
    }
    if (
      resource.event &&
      !eventAllowsRedemption(resource.event)
    ) {
      await this.recordValidationAttempt(
        user,
        clubId,
        code,
        'INVALID',
        kind,
        resource.id,
        'EVENT_UNAVAILABLE',
      );
      return this.invalidValidation(
        'EVENTO NO DISPONIBLE',
        'El evento asociado no permite canjes en este momento.',
      );
    }

    if (confirmUse) {
      const usedAt = new Date();
      let redeemed = false;
      await this.prisma.$transaction(async (tx) => {
        await this.assertOrderAllowsRedemption(tx, resource.order.id);
        if (resource.eventId) {
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Event" WHERE "id" = ${resource.eventId} FOR SHARE`);
          const currentEvent = await tx.event.findUnique({ where: { id: resource.eventId }, select: { status: true, endsAt: true } });
          if (!currentEvent || !eventAllowsRedemption(currentEvent)) {
            throw conflict('EVENT_UNAVAILABLE', 'El evento cambió y ya no permite canjear este código.');
          }
        }
        const nextRedemptionCount = resource.redemptionCount + 1;
        const result =
          kind === 'TICKET'
            ? await tx.ticket.updateMany({
                where: {
                  id: resource.id,
                  status: RedeemableStatus.AVAILABLE,
                  redemptionCount: resource.redemptionCount,
                },
                data: {
                  redemptionCount: { increment: 1 },
                  status:
                    nextRedemptionCount >= resource.maxRedemptions
                      ? RedeemableStatus.USED
                      : RedeemableStatus.AVAILABLE,
                  usedAt,
                },
              })
            : await tx.consumableRight.updateMany({
                where: {
                  id: resource.id,
                  status: RedeemableStatus.AVAILABLE,
                  redemptionCount: resource.redemptionCount,
                },
                data: {
                  redemptionCount: { increment: 1 },
                  status:
                    nextRedemptionCount >= resource.maxRedemptions
                      ? RedeemableStatus.USED
                      : RedeemableStatus.AVAILABLE,
                  usedAt,
                },
              });
        if (result.count !== 1) return;
        if (kind === 'TICKET' && resource.eventId && this.capacity) {
          const activeShift = await tx.workerShift.findFirst({
            where: { worker: { userId: user.id, clubId }, status: 'ACTIVE' },
            select: { id: true },
          });
          await this.capacity.registerEntry(tx, {
            eventId: resource.eventId,
            clubId,
            actorUserId: user.id,
            ticketId: resource.id,
            workerShiftId: activeShift?.id,
          });
        }
        redeemed = true;
        await tx.auditLogEntry.create({
          data: {
            actorUserId: user.id,
            clubId,
            action: this.validationAction(kind),
            resourceType: kind,
            resourceId: resource.id,
            metadata: {
              accessName,
              ownerUserId: resource.ownerUserId,
              orderId: resource.order.id,
              eventId: resource.eventId,
              eventName: resource.event?.name ?? null,
              validatedAt: usedAt.toISOString(),
            },
          },
        });
        await this.recordValidationAttempt(
          user,
          clubId,
          code,
          'VALID',
          kind,
          resource.id,
          null,
          tx,
        );
      });
      if (!redeemed) {
        await this.recordValidationAttempt(
          user,
          clubId,
          code,
          'REPEATED',
          kind,
          resource.id,
          'CONCURRENT_REDEMPTION',
        );
        throw conflict('CODE_ALREADY_REDEEMED', 'El código fue canjeado por otro trabajador.');
      }
    }

    return {
      validation: {
        isValid: true,
        statusLabel: confirmUse ? 'CANJEADO CORRECTAMENTE' : 'PENDIENTE DE VALIDACIÓN',
        title: confirmUse ? 'Código utilizado' : 'Código listo para confirmar',
        message: confirmUse
          ? 'El canje se registró correctamente.'
          : 'Confirma el canje para marcar este código como utilizado.',
        attendeeName: resource.owner.fullName,
        attendeeReference: `${resource.owner.phoneCountryCode} ${resource.owner.phoneNumber}`,
        attendeeImageUrl,
        accessTypeLabel:
          kind === 'TICKET' ? 'ENTRADA' : kind === 'PRODUCT' ? 'PRODUCTO' : 'PROMOCIÓN',
        accessName,
        eventDateLabel: this.dateLabel(eventDate),
        scanTimeLabel: this.timeLabel(new Date()),
        transactionId: `#${resource.order.id.slice(0, 12).toUpperCase()}`,
      },
    };
  }

  private async validateProductDelivery(
    user: AuthenticatedUser,
    clubId: string,
    code: string,
    confirmUse: boolean,
  ) {
    const signedResourceId = code.includes('.') ? this.untrustedSignedResourceId(code) : null;
    const delivery = await this.prisma.productDelivery.findFirst({
      where: {
        clubId,
        OR: [
          { code: code.toUpperCase() },
          { qrPayload: code },
          ...(signedResourceId ? [{ id: signedResourceId }] : []),
        ],
      },
      include: { owner: true, club: true, order: true, items: { include: { product: true } } },
    });
    if (!delivery) return null;

    const accessItems = delivery.items.map((item) => ({
      productId: item.productId,
      name: item.nameSnapshot || item.product.name,
      quantity: item.quantity,
    }));
    const accessName = accessItems.map((item) => `${item.quantity} × ${item.name}`).join(' · ');
    const attendeeImageUrl = await this.uploadsService.createReadableImageUrl(
      delivery.owner.profileImageUrl,
    );
    const response = (overrides: Record<string, unknown>) => ({
      validation: {
        isValid: true,
        statusLabel: confirmUse ? 'ENTREGADO CORRECTAMENTE' : 'LISTO PARA ENTREGAR',
        title: confirmUse ? 'Productos entregados' : 'Entrega lista para confirmar',
        message: confirmUse
          ? 'La entrega se registró correctamente.'
          : 'Confirma para entregar todos los productos de este QR.',
        attendeeName: delivery.owner.fullName,
        attendeeReference: `${delivery.owner.phoneCountryCode} ${delivery.owner.phoneNumber}`,
        attendeeImageUrl,
        accessTypeLabel: 'PRODUCTOS',
        accessName,
        accessItems,
        eventDateLabel: 'Sin fecha de evento',
        scanTimeLabel: this.timeLabel(new Date()),
        transactionId: `#${delivery.order.id.slice(0, 12).toUpperCase()}`,
        ...overrides,
      },
    });

    if (code.includes('.') && !this.isSignedQrValid(code, 'PRODUCT', delivery.id, clubId)) {
      await this.recordValidationAttempt(
        user,
        clubId,
        code,
        'INVALID',
        'PRODUCT',
        delivery.id,
        'INVALID_SIGNATURE',
      );
      return this.invalidValidation('QR INVÁLIDO', 'La firma del código QR no es válida.');
    }
    if (delivery.status !== RedeemableStatus.AVAILABLE || delivery.revokedAt) {
      const alreadyUsed = delivery.status === RedeemableStatus.USED;
      await this.recordValidationAttempt(
        user,
        clubId,
        code,
        alreadyUsed ? 'REPEATED' : 'INVALID',
        'PRODUCT',
        delivery.id,
        alreadyUsed ? 'ALREADY_REDEEMED' : `STATUS_${delivery.status}`,
      );
      return response({
        isValid: false,
        statusLabel: alreadyUsed ? 'PEDIDO YA ENTREGADO' : 'QR NO DISPONIBLE',
        title: alreadyUsed ? 'Estos productos ya fueron entregados' : 'Entrega no autorizada',
        message: alreadyUsed
          ? 'Este QR no puede utilizarse nuevamente.'
          : 'Este QR fue cancelado o ya no se encuentra disponible.',
      });
    }

    if (confirmUse) {
      const usedAt = new Date();
      let redeemed = false;
      await this.prisma.$transaction(async (tx) => {
        await this.assertOrderAllowsRedemption(tx, delivery.orderId);
        const result = await tx.productDelivery.updateMany({
          where: { id: delivery.id, status: RedeemableStatus.AVAILABLE, usedAt: null },
          data: { status: RedeemableStatus.USED, usedAt },
        });
        if (result.count !== 1) return;
        redeemed = true;
        await tx.auditLogEntry.create({
          data: {
            actorUserId: user.id,
            clubId,
            action: 'DELIVER_PRODUCT',
            resourceType: 'PRODUCT',
            resourceId: delivery.id,
            metadata: {
              accessName,
              accessItems,
              ownerUserId: delivery.ownerUserId,
              orderId: delivery.orderId,
              validatedAt: usedAt.toISOString(),
            },
          },
        });
        await this.recordValidationAttempt(
          user,
          clubId,
          code,
          'VALID',
          'PRODUCT',
          delivery.id,
          null,
          tx,
        );
      });
      if (!redeemed) {
        throw conflict('CODE_ALREADY_REDEEMED', 'El pedido fue entregado por otro trabajador.');
      }
    }
    return response({});
  }

  async validateDetectedCode(
    user: AuthenticatedUser,
    clubId: string,
    rawCode: string,
    confirmUse: boolean,
  ) {
    const code = rawCode.trim();
    if (!code) {
      throw badRequest('VALIDATION_CODE_REQUIRED', 'Ingresa un código válido.');
    }
    const normalizedCode = code.toUpperCase();
    const signedResourceId = code.includes('.') ? this.untrustedSignedResourceId(code) : null;
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        clubId,
        OR: [
          { code: normalizedCode },
          { qrPayload: code },
          ...(signedResourceId ? [{ id: signedResourceId }] : []),
        ],
      },
      select: { id: true },
    });
    if (ticket) {
      return this.validateCode(user, clubId, 'TICKET', code, confirmUse);
    }
    const productDelivery = await this.prisma.productDelivery.findFirst({
      where: {
        clubId,
        OR: [
          { code: normalizedCode },
          { qrPayload: code },
          ...(signedResourceId ? [{ id: signedResourceId }] : []),
        ],
      },
      select: { id: true },
    });
    if (productDelivery) {
      return this.validateCode(user, clubId, 'PRODUCT', code, confirmUse);
    }
    const consumable = await this.prisma.consumableRight.findFirst({
      where: {
        clubId,
        OR: [
          { code: normalizedCode },
          { qrPayload: code },
          ...(signedResourceId ? [{ id: signedResourceId }] : []),
        ],
      },
      select: { sourceType: true },
    });
    if (consumable?.sourceType === CommerceItemType.PRODUCT) {
      return this.validateCode(user, clubId, 'PRODUCT', code, confirmUse);
    }
    if (consumable?.sourceType === CommerceItemType.PROMOTION) {
      return this.validateCode(user, clubId, 'PROMOTION', code, confirmUse);
    }
    await this.recordValidationAttempt(user, clubId, code, 'INVALID', null, null, 'NOT_FOUND');
    return this.invalidValidation('CÓDIGO NO ENCONTRADO', 'El código no pertenece a este local.');
  }

  async listValidationLogs(user: AuthenticatedUser, clubId: string) {
    const canViewAll = await this.canViewAllClubAudit(user, clubId);
    const logs = await this.prisma.auditLogEntry.findMany({
      where: {
        clubId,
        action: {
          in: ['VALIDATE_TICKET', 'DELIVER_PRODUCT', 'VALIDATE_PROMOTION'],
        },
        ...(canViewAll ? {} : { actorUserId: user.id }),
      },
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      items: logs.map((log) => {
        const metadata = (log.metadata ?? {}) as Record<string, unknown>;
        return {
          id: log.id,
          actorUserId: log.actorUserId,
          actorName: log.actor.fullName,
          actorRole: log.actor.role,
          action: log.action,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          accessName: metadata.accessName?.toString() ?? 'Canje',
          eventName: metadata.eventName?.toString() ?? null,
          createdAt: log.createdAt,
        };
      }),
    };
  }

  async reverseRedemption(
    user: AuthenticatedUser,
    clubId: string,
    rawKind: string,
    resourceId: string,
    reason: string,
  ) {
    const kind = rawKind.toUpperCase() as ValidationKind;
    if (!['TICKET', 'PRODUCT', 'PROMOTION'].includes(kind)) {
      throw badRequest('INVALID_REDEMPTION_KIND', 'El tipo de canje no es válido.');
    }
    if (user.role !== UserRole.SUPER_ADMIN) {
      const admin = await this.prisma.clubAdmin.findUnique({
        where: { clubId_userId: { clubId, userId: user.id } },
        select: { id: true },
      });
      if (!admin) {
        throw forbidden(
          'REDEMPTION_REVERSAL_FORBIDDEN',
          'Solo un administrador puede revertir un canje.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (kind === 'PRODUCT') {
        const delivery = await tx.productDelivery.findFirst({
          where: { id: resourceId, clubId },
        });
        if (delivery) {
          if (delivery.status !== RedeemableStatus.USED) {
            throw conflict(
              'REDEMPTION_NOT_USED',
              'Esta entrega no tiene un canje que pueda revertirse.',
            );
          }
          await tx.productDelivery.update({
            where: { id: resourceId },
            data: { status: RedeemableStatus.AVAILABLE, usedAt: null },
          });
          await tx.auditLogEntry.create({
            data: {
              actorUserId: user.id,
              clubId,
              action: 'REVERSE_REDEMPTION',
              resourceType: kind,
              resourceId,
              metadata: { reason: reason.trim(), previousStatus: delivery.status },
            },
          });
          await this.recordValidationAttempt(
            user,
            clubId,
            delivery.code,
            'REVERSED',
            kind,
            resourceId,
            'SUPERVISED_REVERSAL',
            tx,
          );
          return { resourceId, kind, status: 'AVAILABLE', redemptionCount: 0, reversed: true };
        }
      }
      const resource =
        kind === 'TICKET'
          ? await tx.ticket.findFirst({ where: { id: resourceId, clubId } })
          : await tx.consumableRight.findFirst({
              where: {
                id: resourceId,
                clubId,
                sourceType:
                  kind === 'PRODUCT' ? CommerceItemType.PRODUCT : CommerceItemType.PROMOTION,
              },
            });
      if (!resource)
        throw notFound('REDEEMABLE_NOT_FOUND', 'No se encontró el derecho a revertir.');
      if (resource.redemptionCount < 1) {
        throw conflict(
          'REDEMPTION_NOT_USED',
          'Este derecho no tiene un canje que pueda revertirse.',
        );
      }
      const nextCount = resource.redemptionCount - 1;
      if (kind === 'TICKET') {
        await tx.ticket.update({
          where: { id: resourceId },
          data: {
            redemptionCount: { decrement: 1 },
            status: RedeemableStatus.AVAILABLE,
            usedAt: nextCount === 0 ? null : resource.usedAt,
          },
        });
      } else {
        await tx.consumableRight.update({
          where: { id: resourceId },
          data: {
            redemptionCount: { decrement: 1 },
            status: RedeemableStatus.AVAILABLE,
            usedAt: nextCount === 0 ? null : resource.usedAt,
          },
        });
      }
      await tx.auditLogEntry.create({
        data: {
          actorUserId: user.id,
          clubId,
          action: 'REVERSE_REDEMPTION',
          resourceType: kind,
          resourceId,
          metadata: { reason: reason.trim(), previousRedemptionCount: resource.redemptionCount },
        },
      });
      await this.recordValidationAttempt(
        user,
        clubId,
        resource.code,
        'REVERSED',
        kind,
        resourceId,
        'SUPERVISED_REVERSAL',
        tx,
      );
      return { resourceId, kind, status: 'AVAILABLE', redemptionCount: nextCount, reversed: true };
    });
  }

  private invalidValidation(statusLabel: string, message: string) {
    return {
      validation: {
        isValid: false,
        statusLabel,
        title: 'Canje no autorizado',
        message,
        attendeeName: 'No disponible',
        attendeeReference: '',
        accessTypeLabel: '',
        accessName: '',
        eventDateLabel: '',
        scanTimeLabel: '',
        transactionId: '',
      },
    };
  }

  private recordValidationAttempt(
    user: AuthenticatedUser,
    clubId: string,
    code: string,
    outcome: 'VALID' | 'INVALID' | 'REPEATED' | 'REVERSED',
    resourceType: ValidationKind | null,
    resourceId: string | null,
    reasonCode: string | null,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    return (tx as any).qrValidationAttempt.create({
      data: {
        clubId,
        actorUserId: user.id,
        resourceType,
        resourceId,
        outcome,
        codeFingerprint: createHash('sha256').update(code).digest('hex'),
        reasonCode,
      },
    });
  }

  private validationAction(kind: ValidationKind) {
    return kind === 'TICKET'
      ? 'VALIDATE_TICKET'
      : kind === 'PRODUCT'
        ? 'DELIVER_PRODUCT'
        : 'VALIDATE_PROMOTION';
  }

  private dateLabel(value: Date | null | undefined) {
    return value
      ? new Intl.DateTimeFormat('es-PE', {
          timeZone: 'America/Lima',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }).format(value)
      : 'Sin vencimiento';
  }

  private timeLabel(value: Date) {
    return new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(value);
  }

  private dateTimeLabel(value: Date) {
    return `${this.dateLabel(value)}, ${this.timeLabel(value)}`;
  }

  private async canViewAllClubAudit(user: AuthenticatedUser, clubId: string) {
    if (user.role === UserRole.SUPER_ADMIN) return true;
    const admin = await this.prisma.clubAdmin.findUnique({
      where: { clubId_userId: { clubId, userId: user.id } },
      select: { id: true },
    });
    if (admin) return true;
    const worker = await this.prisma.clubWorker.findFirst({
      where: {
        clubId,
        userId: user.id,
        status: ClubWorkerStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!worker) {
      throw forbidden('CLUB_AUDIT_FORBIDDEN', 'No puedes consultar los canjes de este local.');
    }
    return false;
  }

  private isSignedQrValid(
    value: string,
    expectedKind: ValidationKind,
    expectedId: string,
    expectedClubId: string,
  ) {
    try {
      const [encoded, suppliedSignature, extra] = value.split('.');
      if (!encoded || !suppliedSignature || extra) return false;
      const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
        v?: string;
        resource?: string;
        id?: string;
        clubId?: string;
      };
      const expectedSignature = createHmac('sha256', this.signingKey(payload.v ?? 'legacy'))
        .update(encoded)
        .digest('base64url');
      const supplied = Buffer.from(suppliedSignature);
      const expected = Buffer.from(expectedSignature);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
        return false;
      }
      const acceptedResource =
        payload.resource === expectedKind ||
        (payload.resource === 'CONSUMABLE' && expectedKind !== 'TICKET');
      return acceptedResource && payload.id === expectedId && payload.clubId === expectedClubId;
    } catch {
      return false;
    }
  }

  private untrustedSignedResourceId(value: string): string | null {
    try {
      const [encoded, signature, extra] = value.split('.');
      if (!encoded || !signature || extra) return null;
      const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
        id?: unknown;
      };
      return typeof payload.id === 'string' && payload.id.length <= 100 ? payload.id : null;
    } catch {
      return null;
    }
  }

  private async assertValidationPermission(
    user: AuthenticatedUser,
    clubId: string,
    kind: ValidationKind,
  ) {
    if (user.role === UserRole.SUPER_ADMIN) return;
    const admin = await this.prisma.clubAdmin.findUnique({
      where: { clubId_userId: { clubId, userId: user.id } },
      select: { id: true },
    });
    if (admin) return;

    const permission =
      kind === 'TICKET'
        ? WorkerPermission.VALIDATE_TICKETS
        : kind === 'PRODUCT'
          ? WorkerPermission.VALIDATE_PRODUCTS
          : WorkerPermission.VALIDATE_PROMOTIONS;
    const worker = await this.prisma.clubWorker.findFirst({
      where: {
        clubId,
        userId: user.id,
        status: ClubWorkerStatus.ACTIVE,
        permissions: { has: permission },
      },
      select: { id: true },
    });
    if (!worker) {
      throw forbidden(
        'VALIDATION_PERMISSION_REQUIRED',
        `No tienes permiso para validar ${
          kind === 'TICKET' ? 'entradas' : kind === 'PRODUCT' ? 'productos' : 'promociones'
        }.`,
      );
    }
    const authorizedDevices = await this.prisma.workerAuthorizedDevice.count({
      where: { workerId: worker.id, status: 'AUTHORIZED' },
    });
    if (authorizedDevices > 0) {
      const activeShift = await this.prisma.workerShift.findFirst({
        where: { workerId: worker.id, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!activeShift) {
        throw forbidden(
          'ACTIVE_WORKER_SHIFT_REQUIRED',
          'Debes iniciar un turno desde un dispositivo autorizado antes de validar códigos.',
        );
      }
    }
  }

  private async assertClubPermission(
    user: AuthenticatedUser,
    clubId: string,
    permission: WorkerPermission,
  ) {
    if (user.role === UserRole.SUPER_ADMIN) return;
    const admin = await this.prisma.clubAdmin.findUnique({
      where: { clubId_userId: { clubId, userId: user.id } },
      select: { id: true },
    });
    if (admin) return;
    const worker = await this.prisma.clubWorker.findFirst({
      where: {
        clubId,
        userId: user.id,
        status: ClubWorkerStatus.ACTIVE,
        permissions: { has: permission },
      },
      select: { id: true },
    });
    if (!worker) {
      throw forbidden('CLUB_PERMISSION_REQUIRED', 'No tienes permiso para realizar esta acción.');
    }
  }

  private clubOrderWhere(clubId: string, query: ClubOrdersQueryDto): Prisma.OrderWhereInput {
    const createdAt =
      query.from || query.to
        ? {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          }
        : undefined;
    return {
      clubId,
      ...(query.status ? { status: query.status as OrderStatus } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(query.eventId
        ? {
            items: {
              some: {
                OR: [
                  { tickets: { some: { eventId: query.eventId } } },
                  { consumableRights: { some: { eventId: query.eventId } } },
                ],
              },
            },
          }
        : {}),
      ...(query.productId
        ? { items: { some: { itemType: CommerceItemType.PRODUCT, itemId: query.productId } } }
        : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { id: { contains: query.search.trim(), mode: 'insensitive' } },
              { user: { fullName: { contains: query.search.trim(), mode: 'insensitive' } } },
              { user: { email: { contains: query.search.trim(), mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  private orderInclude() {
    return {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneCountryCode: true,
          phoneNumber: true,
        },
      },
      items: { orderBy: { createdAt: 'asc' as const } },
      paymentAttempts: { orderBy: { createdAt: 'desc' as const }, take: 1 },
      refundRequests: { orderBy: { createdAt: 'desc' as const }, take: 1 },
    };
  }

  async listClubOrders(user: AuthenticatedUser, clubId: string, query: ClubOrdersQueryDto) {
    await this.assertClubPermission(user, clubId, WorkerPermission.VIEW_SALES);
    const where = this.clubOrderWhere(clubId, query);
    const [orders, aggregate] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: this.orderInclude(),
        orderBy: { createdAt: 'desc' },
        take: 250,
      }),
      this.prisma.order.aggregate({
        where: { ...where, status: 'PAID' },
        _sum: { totalCents: true },
        _count: true,
      }),
    ]);
    return {
      summary: {
        salesCents: aggregate._sum.totalCents ?? 0,
        paidOrders: aggregate._count,
        currency: 'PEN',
      },
      items: orders,
    };
  }

  async getClubOrder(user: AuthenticatedUser, clubId: string, orderId: string) {
    await this.assertClubPermission(user, clubId, WorkerPermission.VIEW_SALES);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, clubId },
      include: this.orderInclude(),
    });
    if (!order) throw notFound('ORDER_NOT_FOUND', 'No se encontró la orden del negocio.');
    return { order };
  }

  async exportClubOrders(user: AuthenticatedUser, clubId: string, query: ClubOrdersQueryDto) {
    const result = await this.listClubOrders(user, clubId, query);
    const csv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['orden', 'fecha', 'cliente', 'email', 'estado', 'pago', 'moneda', 'items'],
      ...result.items.map((order) => [
        order.id,
        order.createdAt.toISOString(),
        order.user.fullName,
        order.user.email ?? '',
        order.status,
        (order.totalCents / 100).toFixed(2),
        order.currency,
        order.items.map((item) => `${item.nameSnapshot} x${item.quantity}`).join(' | '),
      ]),
    ];
    return `\uFEFF${rows.map((row) => row.map(csv).join(',')).join('\r\n')}`;
  }

  async requestOrderRefund(
    user: AuthenticatedUser,
    clubId: string,
    orderId: string,
    reason: string,
    requestedAmountCents?: number,
  ) {
    await this.assertClubPermission(user, clubId, WorkerPermission.REQUEST_REFUNDS);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${orderId} AND "clubId" = ${clubId} FOR UPDATE`);
      const order = await tx.order.findFirst({
        where: { id: orderId, clubId },
        include: {
          paymentAttempts: {
            where: { status: { in: ['APPROVED', 'PARTIALLY_REFUNDED'] } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      if (!order) throw notFound('ORDER_NOT_FOUND', 'No se encontró la orden del negocio.');
      if (order.status !== 'PAID' && order.status !== 'PARTIALLY_REFUNDED') {
        throw conflict('ORDER_NOT_REFUNDABLE', 'Solo una orden pagada puede solicitar devolución.');
      }
      const attempt = order.paymentAttempts[0];
      if (!attempt)
        throw conflict('PAYMENT_NOT_REFUNDABLE', 'No existe un pago aprobado para devolver.');
      const refundableCents = attempt.amountCents - attempt.refundedAmountCents;
      const amountCents = requestedAmountCents ?? refundableCents;
      if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > refundableCents)
        throw conflict(
          'REFUND_AMOUNT_EXCEEDS_AVAILABLE',
          'El monto solicitado supera el saldo reembolsable.',
        );
      const pending = await tx.refundRequest.findFirst({
        where: { orderId, status: { in: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING'] } },
      });
      if (pending)
        throw conflict('REFUND_ALREADY_REQUESTED', 'La orden ya tiene una devolución en proceso.');
      const requiresManualReview = await this.orderHasUsedResources(tx, orderId);
      const request = await tx.refundRequest.create({
        data: {
          orderId,
          clubId,
          requestedByUserId: user.id,
          reason: reason.trim(),
          requestedAmountCents: amountCents,
          status: requiresManualReview ? 'UNDER_REVIEW' : 'REQUESTED',
        },
      });
      await tx.order.update({ where: { id: orderId }, data: { status: 'REFUND_PENDING' } });
      await tx.auditLogEntry.create({
        data: {
          actorUserId: user.id,
          clubId,
          action: 'REQUEST_ORDER_REFUND',
          resourceType: 'ORDER',
          resourceId: orderId,
          metadata: {
            refundRequestId: request.id,
            reason: reason.trim(),
            requestedAmountCents: amountCents,
            refundableCents,
            requiresManualReview,
          },
        },
      });
      return { message: 'Solicitud de devolución registrada.', refundRequest: request };
    });
  }

  async processRefundRequest(
    user: AuthenticatedUser,
    refundRequestId: string,
    approvedAmountCents?: number,
    resolutionNote?: string,
    recoverEventJob = false,
  ) {
    if (user.role !== UserRole.SUPER_ADMIN) {
      throw forbidden('SUPER_ADMIN_REQUIRED', 'Solo la plataforma puede procesar devoluciones.');
    }
    const request = await this.prisma.refundRequest.findUnique({
      where: { id: refundRequestId },
      include: {
        eventJob: true,
        order: { include: { paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } } },
      },
    });
    if (!request)
      throw notFound('REFUND_REQUEST_NOT_FOUND', 'No se encontró la solicitud de devolución.');
    if ((request.status === 'PROCESSING' && !(recoverEventJob && request.approvedAmountCents != null)) || request.status === 'COMPLETED') {
      return { message: 'La devolución ya fue enviada.', refundRequest: request };
    }
    if (!['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'FAILED', ...(recoverEventJob && request.approvedAmountCents != null ? ['PROCESSING'] : [])].includes(request.status)) {
      throw conflict(
        'REFUND_REQUEST_NOT_PROCESSABLE',
        'La solicitud no se puede procesar en su estado actual.',
      );
    }
    const requiresManualReview = await this.orderHasUsedResources(this.prisma, request.orderId);
    const unresolvedCancellation = await this.prisma.eventCancellation.findFirst({ where: {
      status: { not: 'AUTHORIZED' }, event: { OR: [
        { purchasedItems: { some: { orderId: request.orderId } } },
        { tickets: { some: { orderId: request.orderId } } },
        { consumableRights: { some: { orderId: request.orderId } } },
      ] },
    }, select: { id: true } });
    if (unresolvedCancellation && !request.eventJob) {
      throw conflict('EVENT_REFUND_NOT_AUTHORIZED', 'La cancelación todavía no tiene autorización de devolución de Beerry.');
    }
    if (requiresManualReview && (!resolutionNote?.trim() || approvedAmountCents === undefined)) {
      throw conflict(
        'REFUND_MANUAL_REVIEW_REQUIRED',
        'La compra tiene entradas o consumos utilizados. Beerry debe indicar expresamente el monto aprobado y el motivo de la resolución.',
      );
    }
    const attempt = request.order.paymentAttempts[0];
    if (attempt?.provider === 'beerry_wallet') {
      return this.processWalletRefund(user, request.id, approvedAmountCents, resolutionNote);
    }
    if (
      !attempt ||
      attempt.provider !== 'mercado_pago' ||
      !attempt.externalPaymentId ||
      !attempt.sellerExternalId
    ) {
      throw conflict(
        'REFUND_PROVIDER_NOT_SUPPORTED',
        'Este pago no puede devolverse automáticamente con Mercado Pago.',
      );
    }
    const requested = request.requestedAmountCents ?? attempt.amountCents;
    const amountCents = approvedAmountCents ?? request.approvedAmountCents ?? requested;
    if (request.approvedAmountCents != null && request.approvedAmountCents !== amountCents) throw conflict('REFUND_AMOUNT_IMMUTABLE', 'No se puede cambiar el importe de un envío de devolución.');
    const refundableCents = attempt.amountCents - attempt.refundedAmountCents;
    if (
      !Number.isInteger(amountCents) ||
      amountCents <= 0 ||
      amountCents > requested ||
      amountCents > refundableCents
    ) {
      throw conflict(
        'REFUND_AMOUNT_EXCEEDS_AVAILABLE',
        'El monto aprobado supera el saldo reembolsable o lo solicitado.',
      );
    }
    if (!this.refundGateway || this.refundGateway.provider !== 'mercado_pago') {
      throw conflict(
        'REFUND_GATEWAY_UNAVAILABLE',
        'La devolución de Mercado Pago no está configurada.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Order" WHERE id = ${request.orderId} FOR UPDATE`);
      const other = await tx.refundRequest.findFirst({ where: { orderId: request.orderId, id: { not: request.id }, status: { in: ['PROCESSING','APPROVED','FAILED'] } }, select: { id: true } });
      if (other) throw conflict('REFUND_IN_FLIGHT', 'Debe conciliarse la devolución anterior antes de enviar otra.');
      const updated = await tx.refundRequest.updateMany({ where: { id: request.id, status: request.status }, data: { status: 'PROCESSING', approvedAmountCents: amountCents, resolutionNote: resolutionNote?.trim(), reviewedAt: new Date() } });
      if (updated.count !== 1) throw conflict('REFUND_CHANGED', 'La devolución cambió; actualiza su estado.');
    });
    try {
      const providerRefund = await this.refundGateway.createRefund({
        paymentId: await this.refundPaymentId(attempt),
        sellerExternalId: attempt.sellerExternalId,
        amountCents,
        idempotencyKey: `refund-${request.id}`,
      });
      const updated = await this.prisma.refundRequest.update({
        where: { id: request.id },
        data: { externalRefundId: providerRefund.externalRefundId },
      });
      await this.prisma.auditLogEntry.create({
        data: {
          actorUserId: user.id,
          clubId: request.clubId,
          action: 'PROCESS_ORDER_REFUND',
          resourceType: 'REFUND_REQUEST',
          resourceId: request.id,
          metadata: {
            orderId: request.orderId,
            amountCents,
            externalRefundId: providerRefund.externalRefundId,
          },
        },
      });
      return {
        message: 'La devolución fue enviada y espera confirmación del proveedor.',
        refundRequest: updated,
      };
    } catch (error) {
      await this.prisma.refundRequest.update({
        where: { id: request.id },
        data: {
          status: 'FAILED',
          resolutionNote: 'Mercado Pago rechazó o no pudo procesar la solicitud.',
        },
      });
      throw error;
    }
  }

  async refundPaymentId(attempt: { id: string; externalPaymentId: string | null; providerData: unknown }) {
    const stored = (attempt.providerData as Record<string, unknown> | null)?.paymentId;
    if (/^\d+$/.test(String(stored ?? ''))) return String(stored);
    if (/^\d+$/.test(attempt.externalPaymentId ?? '')) return attempt.externalPaymentId!;
    const events = await this.prisma.paymentProviderEvent.findMany({ where: { paymentAttemptId: attempt.id, type: 'PAYMENT_APPROVED' }, orderBy: { createdAt: 'desc' }, take: 10 });
    const ids = [...new Set(events.map((event) => String((event.payload as Prisma.JsonObject | null)?.id ?? '')).filter((id) => /^\d+$/.test(id)))];
    if (ids.length !== 1) throw conflict('PAYMENT_ID_UNRESOLVED', 'Debe conciliarse el identificador del pago real antes de devolver. Una preferencia no es un pago.');
    return ids[0];
  }

  async reconcileEventRefund(requestId: string) {
    const request = await this.prisma.refundRequest.findUniqueOrThrow({ where: { id: requestId }, include: { eventJob: true, order: { include: { paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } } } } });
    if (request.status === 'COMPLETED') return true;
    const attempt = request.order.paymentAttempts[0];
    if (!request.externalRefundId || !attempt?.sellerExternalId || !this.refundGateway?.queryRefund) return false;
    const verified = await this.refundGateway.queryRefund({ paymentId: await this.refundPaymentId(attempt), sellerExternalId: attempt.sellerExternalId, refundId: request.externalRefundId });
    if (verified.amountCents !== request.approvedAmountCents) throw new Error('REFUND_AMOUNT_MISMATCH');
    if (verified.status !== 'approved') return false;
    await this.processPaymentEvent(verified.payment);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Order" WHERE id = ${request.orderId} FOR UPDATE`);
      await tx.refundRequest.updateMany({ where: { id: requestId, status: { not: 'COMPLETED' } }, data: { status: 'COMPLETED', processedAmountCents: verified.amountCents, completedAt: new Date() } });
    });
    return true;
  }

  private async assertOrderAllowsRedemption(tx: Prisma.TransactionClient, orderId: string) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`);
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
    const allocatedPartial = order?.status === 'PARTIALLY_REFUNDED' && !await tx.refundRequest.findFirst({ where: { orderId, status: 'COMPLETED', eventJob: { is: null } }, select: { id: true } });
    if (!order || (order.status !== 'PAID' && !allocatedPartial)) {
      throw conflict('ORDER_NOT_REDEEMABLE', 'La compra está en revisión o ya no permite canjes.');
    }
  }

  private async orderHasUsedResources(tx: Prisma.TransactionClient, orderId: string): Promise<boolean> {
    const used = { OR: [{ status: RedeemableStatus.USED }, { usedAt: { not: null } }, { redemptionCount: { gt: 0 } }] };
    const [ticket, consumable, delivery] = await Promise.all([
      tx.ticket.findFirst({ where: { orderId, ...used }, select: { id: true } }),
      tx.consumableRight.findFirst({ where: { orderId, ...used }, select: { id: true } }),
      tx.productDelivery.findFirst({ where: { orderId, OR: [{ status: RedeemableStatus.USED }, { usedAt: { not: null } }] }, select: { id: true } }),
    ]);
    return !!(ticket || consumable || delivery);
  }

  private async processWalletRefund(
    user: AuthenticatedUser,
    requestId: string,
    approvedAmountCents?: number,
    note?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const request = await tx.refundRequest.findUniqueOrThrow({
          where: { id: requestId },
          include: {
            eventJob: true,
            order: { include: { paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } } },
          },
        });
        if (request.status === 'COMPLETED')
          return { message: 'La devolución ya fue completada.', refundRequest: request };
        if (!['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'FAILED'].includes(request.status))
          throw conflict('REFUND_REQUEST_NOT_PROCESSABLE', 'La devolución está en proceso.');
        const attempt = request.order.paymentAttempts[0];
        if (!attempt || attempt.provider !== 'beerry_wallet' || !['APPROVED', 'PARTIALLY_REFUNDED'].includes(attempt.status))
          throw conflict('PAYMENT_NOT_REFUNDABLE', 'La compra de billetera no está aprobada.');
        const amount =
          approvedAmountCents ??
          request.approvedAmountCents ??
          request.requestedAmountCents ??
          attempt.amountCents;
        // Partial refunds require an authorized line allocation; generic requests stay full-only.
        if (
          (!request.eventJob && (amount !== attempt.amountCents || attempt.refundedAmountCents !== 0)) ||
          !Number.isSafeInteger(amount) || amount <= 0 || amount > attempt.amountCents - attempt.refundedAmountCents ||
          (request.requestedAmountCents != null && amount > request.requestedAmountCents)
        )
          throw conflict(
            'WALLET_FULL_REFUND_REQUIRED',
            'Por ahora la devolución de billetera debe ser por el total de la compra.',
          );
        if (!this.referrals || !this.ledger) throw new Error('WALLET_REFUND_SERVICES_REQUIRED');
        const now = new Date();
        const cumulative = attempt.refundedAmountCents + amount;
        const full = cumulative === attempt.amountCents;
        const fee = Math.round(cumulative * (attempt.marketplaceFeeCents ?? 0) / attempt.amountCents) - Math.round(attempt.refundedAmountCents * (attempt.marketplaceFeeCents ?? 0) / attempt.amountCents);
        if (amount === attempt.amountCents) {
          await this.ledger.reverseSale(tx, { paymentAttemptId: attempt.id, providerEventId: `wallet-refund:${request.id}`, type: 'REFUND' });
        } else {
          await this.ledger.reverseSalePartial(tx, { paymentAttemptId: attempt.id, providerEventId: `wallet-refund:${request.id}`, amountCents: amount, marketplaceFeeCents: fee });
        }
        if (full) await this.referrals.reverseOrderEffects(tx, request.orderId, 'REFUNDED');
        else await this.referrals.restoreOrderCredits(tx, request.orderId, cumulative, attempt.amountCents);
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: { status: full ? 'REFUNDED' : 'PARTIALLY_REFUNDED', refundedAmountCents: cumulative },
        });
        await tx.order.update({ where: { id: request.orderId }, data: { status: full ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
        const revoke = {
          status: 'CANCELLED' as const,
          revokedAt: now,
          revokedReason: 'PAYMENT_REFUNDED',
        };
        await tx.ticket.updateMany({
          where: { orderId: request.orderId, status: 'AVAILABLE', ...(!full && request.eventJob ? { orderItemId: request.eventJob.orderItemId } : {}) },
          data: revoke,
        });
        await tx.consumableRight.updateMany({
          where: { orderId: request.orderId, status: 'AVAILABLE', ...(!full && request.eventJob ? { orderItemId: request.eventJob.orderItemId } : {}) },
          data: revoke,
        });
        await tx.productDelivery.updateMany({
          where: { orderId: request.orderId, status: 'AVAILABLE', ...(!full ? { id: '__no_product_in_event_refund__' } : {}) },
          data: revoke,
        });
        await tx.wallet.update({
          where: { userId: request.order.userId },
          data: { totalSpentCents: { decrement: amount } },
        });
        const updated = await tx.refundRequest.update({
          where: { id: request.id },
          data: {
            status: 'COMPLETED',
            approvedAmountCents: amount,
            processedAmountCents: amount,
            marketplaceFeeRefundedCents: fee,
            reviewedAt: now,
            completedAt: now,
            resolutionNote: note?.trim(),
          },
        });
        await tx.auditLogEntry.create({
          data: {
            actorUserId: user.id,
            clubId: request.order.clubId,
            action: 'PROCESS_WALLET_REFUND',
            resourceType: 'REFUND_REQUEST',
            resourceId: request.id,
            metadata: { orderId: request.orderId, amountCents: amount },
          },
        });
        return { message: 'La compra fue devuelta a la billetera.', refundRequest: updated };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async getClubOperations(user: AuthenticatedUser, clubId: string) {
    await this.assertClubPermission(user, clubId, WorkerPermission.VIEW_OPERATIONS);
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const [products, events, validationCounts, workers, devices, sales] = await Promise.all([
      this.prisma.product.findMany({
        where: { clubId, status: { in: ['ACTIVE', 'OUT_OF_STOCK'] } },
        orderBy: { stockQuantity: 'asc' },
      }),
      this.prisma.event.findMany({
        where: { clubId, status: { in: ['PUBLISHED', 'SALE_ACTIVE', 'SOLD_OUT', 'IN_PROGRESS'] } },
        include: { occupancy: true },
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.qrValidationAttempt.groupBy({
        by: ['outcome'],
        where: { clubId, createdAt: { gte: dayStart } },
        _count: true,
      }),
      this.prisma.clubWorker.findMany({
        where: { clubId },
        include: { user: { select: { id: true, fullName: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.deviceToken.findMany({
        where: { user: { clubWorkers: { some: { clubId } } } },
        select: { id: true, userId: true, platform: true, enabled: true, lastSeenAt: true },
        orderBy: { lastSeenAt: 'desc' },
      }),
      this.prisma.order.aggregate({
        where: { clubId, status: 'PAID', paidAt: { gte: dayStart } },
        _sum: { totalCents: true },
        _count: true,
      }),
    ]);
    return {
      generatedAt: now,
      salesToday: {
        amountCents: sales._sum.totalCents ?? 0,
        orders: sales._count,
        currency: 'PEN',
      },
      inventory: {
        lowStock: products.filter((item) => item.stockQuantity > 0 && item.stockQuantity <= 5),
        outOfStock: products.filter((item) => item.stockQuantity <= 0),
      },
      events: events.map((event) => ({
        ...(() => {
          const admitted = event.occupancy?.currentCount ?? 0;
          return {
            id: event.id,
            name: event.name,
            capacity: event.capacity,
            admitted,
            available: Math.max(0, event.capacity - admitted),
            occupancyPercent:
              event.capacity > 0 ? Math.round((admitted / event.capacity) * 100) : 0,
            status: event.status,
          };
        })(),
      })),
      validationsToday: Object.fromEntries(
        validationCounts.map((item) => [item.outcome, item._count]),
      ),
      workers: workers.map((worker) => ({
        id: worker.id,
        name: worker.user.fullName,
        status: worker.status,
        permissions: worker.permissions,
        updatedAt: worker.updatedAt,
      })),
      devices: devices.map((device) => ({
        ...device,
        online: device.enabled && device.lastSeenAt >= new Date(now.getTime() - 15 * 60_000),
      })),
    };
  }

  async listTickets(user: AuthenticatedUser) {
    return {
      items: await this.prisma.ticket.findMany({
        where: { ownerUserId: user.id },
        include: { ticketType: true, club: true, event: true },
        orderBy: { createdAt: 'desc' },
      }),
    };
  }

  async listConsumables(user: AuthenticatedUser) {
    const [rights, deliveries] = await Promise.all([
      this.prisma.consumableRight.findMany({
        where: { ownerUserId: user.id },
        include: { product: true, promotion: true, club: true, event: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.productDelivery.findMany({
        where: { ownerUserId: user.id },
        include: { club: true, items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      items: [
        ...rights,
        ...deliveries.map((delivery) => ({
          ...delivery,
          sourceType: CommerceItemType.PRODUCT,
          title:
            delivery.items.length === 1
              ? `${delivery.items[0].nameSnapshot} ×${delivery.items[0].quantity}`
              : 'Entrega de productos',
          contents: delivery.items.map((item) => ({
            productId: item.productId,
            name: item.nameSnapshot,
            quantity: item.quantity,
            imageUrl: item.product.imageUrl,
          })),
          product: delivery.items.length === 1 ? delivery.items[0].product : null,
          promotion: null,
          event: null,
        })),
      ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
    };
  }
}
