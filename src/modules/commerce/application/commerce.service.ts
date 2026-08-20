import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
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
  PromotionStatus,
  Prisma,
  RedeemableStatus,
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
import { CapacityService } from '../../events/application/capacity.service';
import { ReferralsService } from '../../referrals/application/referrals.service';
import {
  PAYMENT_GATEWAY,
  PaymentGateway,
  PaymentOutcome,
  VerifiedPaymentEvent,
} from './ports/payment-gateway.port';

type ValidationKind = 'TICKET' | 'PRODUCT' | 'PROMOTION';

@Injectable()
export class CommerceService implements OnModuleInit, OnModuleDestroy {
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

  async checkout(user: AuthenticatedUser, input: CheckoutDto) {
    const requestedPaymentMethod =
      input.paymentMethod === 'FLOW' && this.paymentGateway.provider === 'simulated'
        ? 'SIMULATED'
        : (input.paymentMethod ?? (this.paymentGateway.provider === 'flow' ? 'FLOW' : 'SIMULATED'));
    const created = await this.prisma.$transaction(async (tx) => {
      const reservationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const checkoutItems =
        (
          await tx.cart.findUnique({
            where: { userId: user.id },
            include: { items: { orderBy: { createdAt: 'asc' } } },
          })
        )?.items.map((item) => ({
          id: item.itemId,
          type: item.itemType,
          quantity: item.quantity,
        })) ?? [];
      if (checkoutItems.length === 0) {
        throw badRequest('EMPTY_CART', 'Agrega al menos un artículo antes de comprar.');
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
            ? source.quantityTotal - source.quantitySold - (reserved._sum.quantity ?? 0)
            : 0;
          if (
            !source ||
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
          const now = new Date();
          if (
            (source.startsAt && source.startsAt > now) ||
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
      if (requestedPaymentMethod === 'FLOW' && promotionalCreditCents > 0) {
        throw badRequest(
          'MIXED_PAYMENT_NOT_ALLOWED',
          'Elige pagar todo con Flow o todo con tu billetera.',
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
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            clubId: item.clubId,
            itemType: item.type,
            itemId: item.id,
            nameSnapshot: item.name,
            quantity: item.quantity,
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
      const attempt = await tx.paymentAttempt.create({
        data: {
          orderId: order.id,
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
    const providerPayment = await this.paymentGateway.createPayment({
      attemptId: created.attempt.id,
      orderId: created.order.id,
      amountCents: created.attempt.amountCents,
      currency: created.order.currency,
      payerEmail: this.paymentPayerEmail(user.id, payer?.email),
      subject: `Compra Beerry - ${payer?.fullName ?? user.id}`,
    });
    const attempt = await this.prisma.paymentAttempt.update({
      where: { id: created.attempt.id },
      data: {
        externalPaymentId: providerPayment.externalPaymentId,
        providerData: providerPayment.providerData as Prisma.InputJsonValue | undefined,
      },
    });
    return this.paymentResponse(created.order, attempt, providerPayment.checkoutUrl);
  }

  async getCart(user: AuthenticatedUser) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId: user.id },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!cart) return { id: null, clubId: null, items: [], totalCents: 0, currency: 'PEN' };

    const items = await Promise.all(
      cart.items.map(async (item) => {
        const source = await this.resolveCartSource(item.itemType, item.itemId, user.id);
        const isAvailable = Boolean(source?.available && item.quantity <= source.availableQuantity);
        return {
          cartItemId: item.id,
          id: item.itemId,
          type: item.itemType,
          quantity: item.quantity,
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
          provider: this.paymentGateway.provider,
          amountCents,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
      return { topUp, attempt };
    });
    const providerPayment = await this.paymentGateway.createPayment({
      attemptId: created.attempt.id,
      orderId: created.topUp.id,
      amountCents,
      currency: created.topUp.currency,
      payerEmail: this.paymentPayerEmail(user.id, payer?.email),
      subject: `Recarga de billetera Beerry - ${payer?.fullName ?? user.id}`,
    });
    const attempt = await this.prisma.paymentAttempt.update({
      where: { id: created.attempt.id },
      data: {
        externalPaymentId: providerPayment.externalPaymentId,
        providerData: providerPayment.providerData as Prisma.InputJsonValue | undefined,
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
    const topUp = await this.prisma.walletTopUp.findFirst({
      where: { id: topUpId, userId: user.id },
      include: { paymentAttempt: true },
    });
    if (!topUp) throw notFound('WALLET_TOP_UP_NOT_FOUND', 'No se encontró la recarga.');
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
        await tx.cart.update({ where: { id: item.cartId }, data: { clubId: null } });
    });
    return this.getCart(user);
  }

  private async resolveCartSource(type: CommerceItemType, id: string, userId?: string) {
    if (type === CommerceItemType.TICKET) {
      const source = await this.prisma.ticketType.findUnique({
        where: { id },
        include: { club: true },
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
        ? Math.max(0, source.quantityTotal - source.quantitySold - (reserved._sum.quantity ?? 0))
        : 0;
      const userAvailable = source?.perUserLimit
        ? Math.max(0, source.perUserLimit - alreadyOwned)
        : globalAvailable;
      const available = Boolean(
        source &&
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
            availabilityMessage: available ? null : 'La entrada ya no está disponible.',
          }
        : null;
    }
    if (type === CommerceItemType.PRODUCT) {
      const source = await this.prisma.product.findUnique({
        where: { id },
        include: { club: true },
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
      const available = Boolean(
        source &&
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
            availabilityMessage: available ? null : 'El producto ya no tiene stock.',
          }
        : null;
    }
    const source = await this.prisma.promotion.findUnique({
      where: { id },
      include: { club: true },
    });
    const now = new Date();
    const available = Boolean(
      source &&
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
          availabilityMessage: available ? null : 'La promoción ya no está disponible.',
        }
      : null;
  }

  async getPayment(user: AuthenticatedUser, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId: user.id },
      include: { paymentAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order) throw notFound('ORDER_NOT_FOUND', 'No se encontró la orden.');
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
    if (event.provider === 'flow') {
      const payload = event.payload ?? {};
      const commerceOrder = String(payload.commerceOrder ?? '');
      const currency = String(payload.currency ?? '');
      const amountCents = Math.round(Number(payload.amount) * 100);
      if (
        commerceOrder !== attempt.id ||
        currency !== attempt.currency ||
        !Number.isFinite(amountCents) ||
        amountCents !== attempt.amountCents
      ) {
        throw conflict(
          'FLOW_PAYMENT_MISMATCH',
          'La confirmación de Flow no coincide con el intento registrado.',
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
      if ((error as { code?: string }).code === 'P2002') return;
      throw error;
    }
    if (event.outcome === 'PENDING') {
      await this.finishProviderEvent(event, 'IGNORED');
      return;
    }
    if (event.outcome === 'REFUNDED' || event.outcome === 'CHARGEBACK') {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.paymentAttempt.findUnique({ where: { id: attempt.id } });
        if (!current || current.status === 'REFUNDED') return;
        if (current.status !== 'APPROVED') {
          throw conflict('PAYMENT_NOT_REFUNDABLE', 'Solo un pago aprobado puede reembolsarse.');
        }
        await this.ledger?.reverseSale(tx, {
          paymentAttemptId: attempt.id,
          providerEventId: event.providerEventId,
          type: event.outcome === 'REFUNDED' ? 'REFUND' : 'CHARGEBACK',
        });
        const refundedAt = new Date();
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: { status: 'REFUNDED', failedAt: refundedAt },
        });
        await tx.order.update({ where: { id: orderId }, data: { status: 'REFUNDED' } });
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
        ]);
        const wallet = await tx.wallet.findUnique({ where: { userId: order.userId } });
        if (wallet) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { totalSpentCents: { decrement: attempt.amountCents } },
          });
          await tx.walletMovement.create({
            data: {
              walletId: wallet.id,
              type: 'REFUND',
              status: 'COMPLETED',
              amountCents: attempt.amountCents,
              description:
                event.outcome === 'CHARGEBACK' ? 'Contracargo confirmado' : 'Reembolso confirmado',
              referenceId: orderId,
              completedAt: refundedAt,
            },
          });
        }
      });
      await this.finishProviderEvent(event, 'PROCESSED');
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.paymentAttempt.findUnique({ where: { id: attempt.id } });
      if (!current || current.status !== 'PENDING') return;
      if (event.outcome === 'APPROVED') {
        const paidAt = new Date();
        await this.confirmOrderReservations(tx, order, paidAt);
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: { status: 'APPROVED', approvedAt: paidAt },
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
        });
        await this.referrals?.createRewardForPaidOrder(tx, orderId);
        await this.issueOrderResources(tx, order);
        await this.notifications?.notifyFromTemplate(
          order.userId,
          'PAYMENT_APPROVED',
          { amount: (attempt.amountCents / 100).toFixed(2), orderId },
          { orderId, paymentAttemptId: attempt.id },
          tx,
        );
        await this.notifications?.notifyFromTemplate(
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
            await tx.cart.update({ where: { id: cart.id }, data: { clubId: null } });
        }
      } else {
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: event.outcome === 'EXPIRED' ? 'EXPIRED' : 'REJECTED',
            failureCode: event.failureCode,
            failureMessage: event.failureMessage,
            failedAt: new Date(),
          },
        });
        await tx.order.update({
          where: { id: orderId },
          data: { status: event.outcome === 'EXPIRED' ? 'EXPIRED' : 'FAILED' },
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

  private async issueOrderResources(tx: any, order: { id: string; userId: string; items: any[] }) {
    for (const item of order.items) {
      for (let index = 0; index < item.quantity; index++) {
        const id = randomUUID();
        const code = this.backupCode();
        if (item.itemType === CommerceItemType.TICKET) {
          const ticketType = await tx.ticketType.findUnique({
            where: { id: item.itemId },
            include: { event: true },
          });
          await tx.ticket.create({
            data: {
              id,
              orderId: order.id,
              orderItemId: item.id,
              clubId: item.clubId,
              eventId: ticketType?.eventId,
              ticketTypeId: item.itemId,
              ownerUserId: order.userId,
              code,
              qrPayload: this.qr('TICKET', id, item.clubId, ticketType?.eventId),
              signatureVersion: this.activeSigningVersion(),
              validFrom: ticketType?.event?.startsAt ?? null,
              validUntil: ticketType?.event?.endsAt ?? ticketType?.saleEndAt,
            },
          });
        } else {
          const promotion =
            item.itemType === CommerceItemType.PROMOTION
              ? await tx.promotion.findUnique({
                  where: { id: item.itemId },
                  include: { event: true },
                })
              : null;
          const resource = item.itemType === CommerceItemType.PRODUCT ? 'PRODUCT' : 'PROMOTION';
          await tx.consumableRight.create({
            data: {
              id,
              orderId: order.id,
              orderItemId: item.id,
              clubId: item.clubId,
              eventId: promotion?.eventId,
              ownerUserId: order.userId,
              sourceType: item.itemType,
              sourceId: item.itemId,
              productId: item.itemType === CommerceItemType.PRODUCT ? item.itemId : null,
              promotionId: item.itemType === CommerceItemType.PROMOTION ? item.itemId : null,
              code,
              qrPayload: this.qr(resource, id, item.clubId, promotion?.eventId),
              signatureVersion: this.activeSigningVersion(),
              validFrom: promotion?.startsAt ?? promotion?.event?.startsAt ?? null,
              validUntil: promotion?.endsAt ?? promotion?.event?.endsAt ?? null,
            },
          });
        }
      }
    }
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
      throw conflict('RESERVATION_NOT_ACTIVE', 'La reserva de inventario ya no está activa.');
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
      if ((error as { code?: string }).code === 'P2002') return;
      throw error;
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

  private paymentPayerEmail(userId: string, optionalEmail?: string | null) {
    if (optionalEmail?.trim()) return optionalEmail.trim().toLowerCase();
    if (this.paymentGateway.provider !== 'flow') {
      return `simulated+${userId}@beerry.local`;
    }
    const fallbackEmail = this.config
      .get<string>('FLOW_FALLBACK_PAYER_EMAIL')
      ?.trim()
      .toLowerCase();
    if (!fallbackEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fallbackEmail)) {
      throw badRequest(
        'FLOW_FALLBACK_PAYER_EMAIL_REQUIRED',
        'Configura un correo operativo válido para pagos de clientes sin email.',
      );
    }
    return fallbackEmail;
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
      (resource.event.status === EventStatus.FINISHED ||
        resource.event.status === EventStatus.CANCELLED)
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
        'El evento asociado finalizó o fue cancelado.',
      );
    }

    if (confirmUse) {
      const usedAt = new Date();
      let redeemed = false;
      await this.prisma.$transaction(async (tx) => {
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
  ) {
    await this.assertClubPermission(user, clubId, WorkerPermission.REQUEST_REFUNDS);
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, clubId } });
      if (!order) throw notFound('ORDER_NOT_FOUND', 'No se encontró la orden del negocio.');
      if (order.status !== 'PAID' && order.status !== 'PARTIALLY_REFUNDED') {
        throw conflict('ORDER_NOT_REFUNDABLE', 'Solo una orden pagada puede solicitar devolución.');
      }
      const pending = await tx.refundRequest.findFirst({
        where: { orderId, status: { in: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING'] } },
      });
      if (pending)
        throw conflict('REFUND_ALREADY_REQUESTED', 'La orden ya tiene una devolución en proceso.');
      const request = await tx.refundRequest.create({
        data: { orderId, clubId, requestedByUserId: user.id, reason: reason.trim() },
      });
      await tx.order.update({ where: { id: orderId }, data: { status: 'REFUND_PENDING' } });
      await tx.auditLogEntry.create({
        data: {
          actorUserId: user.id,
          clubId,
          action: 'REQUEST_ORDER_REFUND',
          resourceType: 'ORDER',
          resourceId: orderId,
          metadata: { refundRequestId: request.id, reason: reason.trim() },
        },
      });
      return { message: 'Solicitud de devolución registrada.', refundRequest: request };
    });
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
    return {
      items: await this.prisma.consumableRight.findMany({
        where: { ownerUserId: user.id },
        include: { product: true, promotion: true, club: true, event: true },
        orderBy: { createdAt: 'desc' },
      }),
    };
  }
}
