import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import {
  Prisma,
  ReferralCaptureMethod,
  ReferralExpirationMode,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
} from '../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { NotificationService } from '../../notification/application/notification.service';
import { AuditService } from '../../audit/application/audit.service';
import {
  ReferralAdminQueryDto,
  TransferCreditDto,
  UpdateReferralSettingsDto,
} from '../presentation/referral.dto';

type Tx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ReferralsService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.processDueRewards(), 60_000);
    this.timer.unref();
    void this.processDueRewards();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  getSettings() {
    return this.prisma.referralProgramSettings.upsert({
      where: { id: 'referral-program' },
      create: {},
      update: {},
    });
  }

  async updateSettings(actor: AuthenticatedUser, input: UpdateReferralSettingsDto) {
    this.assertSuperAdmin(actor);
    const current = await this.getSettings();
    const commission = input.platformCommissionBps ?? current.platformCommissionBps;
    const reward = input.rewardBps ?? current.rewardBps;
    const margin = input.minimumPlatformMarginBps ?? current.minimumPlatformMarginBps;
    if (reward > commission - margin) {
      throw badRequest(
        'REFERRAL_MARGIN_NOT_PROTECTED',
        'La recompensa supera la comisión disponible después del margen mínimo de Beerry.',
      );
    }
    const expirationMode = input.expirationMode ?? current.expirationMode;
    const expirationDays = input.expirationDays ?? current.expirationDays;
    if (expirationMode === ReferralExpirationMode.FIXED_DAYS && !expirationDays) {
      throw badRequest('REFERRAL_EXPIRATION_DAYS_REQUIRED', 'Debes indicar los días de vigencia.');
    }
    const startsAt = input.startsAt === undefined ? current.startsAt : new Date(input.startsAt);
    const endsAt = input.endsAt === undefined ? current.endsAt : new Date(input.endsAt);
    if (startsAt && endsAt && startsAt >= endsAt)
      throw badRequest(
        'REFERRAL_CAMPAIGN_DATES_INVALID',
        'La fecha final debe ser posterior al inicio.',
      );
    const updated = await this.prisma.referralProgramSettings.update({
      where: { id: current.id },
      data: {
        ...input,
        startsAt,
        endsAt,
        version: { increment: 1 },
        updatedByUserId: actor.id,
      },
    });
    await this.audit?.record({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: 'UPDATE_REFERRAL_SETTINGS',
      resourceType: 'REFERRAL_PROGRAM',
      resourceId: updated.id,
      severity: 'WARNING',
      metadata: { previousVersion: current.version, newVersion: updated.version, input },
    });
    return updated;
  }

  async getMine(user: AuthenticatedUser) {
    const code = await this.ensureCode(user.id);
    const [relationship, referrals, rewards, wallet, settings] = await Promise.all([
      this.prisma.customerReferral.findUnique({
        where: { referredUserId: user.id },
        include: { referrer: { select: { fullName: true } } },
      }),
      this.prisma.customerReferral.findMany({
        where: { referrerUserId: user.id },
        include: { referred: { select: { fullName: true } } },
        orderBy: { associatedAt: 'desc' },
        take: 100,
      }),
      this.prisma.referralReward.findMany({
        where: { beneficiaryUserId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.wallet.findUnique({
        where: { userId: user.id },
        include: {
          creditLots: {
            where: { source: 'REFERRAL_REWARD', remainingAmountCents: { gt: 0 } },
            orderBy: { expiresAt: 'asc' },
          },
        },
      }),
      this.getSettings(),
    ]);
    const mask = (name: string) =>
      name.length <= 3 ? `${name[0] ?? ''}***` : `${name.slice(0, 3)}***`;
    return {
      code,
      shareUrl: `https://beerry.app/r/${code}`,
      program: {
        enabled: settings.enabled,
        rewardBps: settings.rewardBps,
        transfersEnabled: settings.transfersEnabled,
        associationWindowDays: settings.associationWindowDays,
      },
      referredBy: relationship
        ? { name: mask(relationship.referrer.fullName), associatedAt: relationship.associatedAt }
        : null,
      referrals: referrals.map((item) => ({
        id: item.id,
        name: mask(item.referred.fullName),
        associatedAt: item.associatedAt,
        hasPurchased: Boolean(item.firstPaidOrderId),
      })),
      rewards,
      summary: {
        referredUsers: referrals.length,
        pendingCents: rewards
          .filter((item) => item.status === 'PENDING')
          .reduce((sum, item) => sum + item.amountCents, 0),
        earnedCents: rewards
          .filter((item) => !['REVERSED', 'BLOCKED'].includes(item.status))
          .reduce((sum, item) => sum + item.amountCents, 0),
        availableCents:
          wallet?.creditLots.reduce((sum, item) => sum + item.remainingAmountCents, 0) ?? 0,
        nextExpiration: wallet?.creditLots.find((item) => item.expiresAt)?.expiresAt ?? null,
      },
    };
  }

  async preview(code: string) {
    const normalized = this.normalizeCode(code);
    const owner = await this.prisma.user.findFirst({
      where: { referralCode: normalized, status: UserStatus.ACTIVE },
      select: { id: true, fullName: true },
    });
    if (!owner)
      throw notFound(
        'REFERRAL_CODE_NOT_FOUND',
        'El código de referido no existe o no está activo.',
      );
    return {
      code: normalized,
      referrerName:
        owner.fullName.length <= 3 ? `${owner.fullName[0]}***` : `${owner.fullName.slice(0, 3)}***`,
    };
  }

  async associate(
    user: AuthenticatedUser,
    rawCode: string,
    captureMethod: ReferralCaptureMethod = ReferralCaptureMethod.CODE,
  ) {
    const settings = await this.activeSettings();
    const code = this.normalizeCode(rawCode);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${'referral-association:' + user.id}))::text`,
      );
      const [account, owner, existing, paidOrders, openOrders] = await Promise.all([
        tx.user.findUnique({ where: { id: user.id } }),
        tx.user.findFirst({ where: { referralCode: code, status: UserStatus.ACTIVE } }),
        tx.customerReferral.findUnique({ where: { referredUserId: user.id } }),
        tx.order.count({
          where: { userId: user.id, status: { in: ['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'] } },
        }),
        tx.order.count({ where: { userId: user.id, status: 'PENDING' } }),
      ]);
      if (!account || account.status !== UserStatus.ACTIVE || !account.phoneVerifiedAt)
        throw forbidden(
          'REFERRAL_ACCOUNT_NOT_ELIGIBLE',
          'La cuenta debe estar activa y verificada.',
        );
      if (!owner)
        throw notFound(
          'REFERRAL_CODE_NOT_FOUND',
          'El código de referido no existe o no está activo.',
        );
      if (owner.id === user.id)
        throw badRequest('SELF_REFERRAL_NOT_ALLOWED', 'No puedes usar tu propio código.');
      if (existing)
        throw conflict('REFERRAL_ALREADY_ASSOCIATED', 'Tu cuenta ya tiene un referente asociado.');
      if (paidOrders > 0)
        throw conflict(
          'REFERRAL_PURCHASE_ALREADY_EXISTS',
          'No puedes asociar un referente después de realizar una compra.',
        );
      if (openOrders > 0)
        throw conflict(
          'REFERRAL_PAYMENT_IN_PROGRESS',
          'Finaliza o cancela tu orden pendiente antes de asociar un referente.',
        );
      const deadline = new Date(
        account.createdAt.getTime() + settings.associationWindowDays * 86_400_000,
      );
      if (new Date() > deadline)
        throw conflict(
          'REFERRAL_ASSOCIATION_WINDOW_EXPIRED',
          'La ventana para ingresar un código de referido ya venció.',
        );
      const created = await tx.customerReferral.create({
        data: {
          referrerUserId: owner.id,
          referredUserId: user.id,
          captureMethod,
          codeSnapshot: code,
        },
      });
      await this.notifications?.notifyFromTemplate(
        owner.id,
        'REFERRAL_ASSOCIATED',
        { customer: this.mask(account.fullName) },
        { referralId: created.id },
        tx,
      );
      return created;
    });
  }

  async createRewardForPaidOrder(tx: Prisma.TransactionClient, orderId: string) {
    await tx.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${'referral-reward:' + orderId}))::text`,
    );
    const existing = await tx.referralReward.findUnique({ where: { orderId } });
    if (existing) return existing;
    const settings = await tx.referralProgramSettings.upsert({
      where: { id: 'referral-program' },
      create: {},
      update: {},
    });
    const now = new Date();
    if (
      !settings.enabled ||
      (settings.startsAt && settings.startsAt > now) ||
      (settings.endsAt && settings.endsAt < now)
    )
      return null;
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { user: { include: { referredBy: true } } },
    });
    const referral = order?.user.referredBy;
    if (!order || !referral || order.totalCents < settings.minimumPurchaseCents) return null;
    // This value is calculated when the payment is captured. Never fall back to the
    // order total: referral/promotional wallet lots are deliberately non-eligible.
    const eligibleBaseCents = Math.max(0, order.customerFundedCents);
    if (eligibleBaseCents <= 0) return null;
    let amountCents = Math.floor((eligibleBaseCents * settings.rewardBps) / 10_000);
    if (settings.maximumRewardPerOrderCents)
      amountCents = Math.min(amountCents, settings.maximumRewardPerOrderCents);
    if (settings.maximumMonthlyRewardCents) {
      const start = new Date(order.paidAt ?? new Date());
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const earned = await tx.referralReward.aggregate({
        where: {
          beneficiaryUserId: referral.referrerUserId,
          createdAt: { gte: start },
          status: { notIn: ['REVERSED'] },
        },
        _sum: { amountCents: true },
      });
      amountCents = Math.min(
        amountCents,
        Math.max(0, settings.maximumMonthlyRewardCents - (earned._sum.amountCents ?? 0)),
      );
    }
    if (amountCents <= 0) return null;
    const availableAt = new Date(
      (order.paidAt ?? new Date()).getTime() + settings.holdHours * 3_600_000,
    );
    const reward = await tx.referralReward.create({
      data: {
        referralId: referral.id,
        orderId,
        beneficiaryUserId: referral.referrerUserId,
        buyerUserId: order.userId,
        eligibleBaseCents,
        platformCommissionBps: settings.platformCommissionBps,
        rewardBps: settings.rewardBps,
        settingsVersion: settings.version,
        amountCents,
        availableAt,
        expiresAt: this.expiration(availableAt, settings.expirationMode, settings.expirationDays),
      },
    });
    await tx.customerReferral.update({
      where: { id: referral.id },
      data: {
        firstPaidOrderId: referral.firstPaidOrderId ?? order.id,
        lockedAt: referral.lockedAt ?? new Date(),
      },
    });
    await this.notifications?.notifyFromTemplate(
      referral.referrerUserId,
      'REFERRAL_REWARD_PENDING',
      { amount: (amountCents / 100).toFixed(2) },
      { rewardId: reward.id, orderId },
      tx,
    );
    return reward;
  }

  async processDueRewards(now = new Date()) {
    const available = await this.prisma.referralReward.findMany({
      where: { status: 'PENDING', availableAt: { lte: now } },
      take: 100,
    });
    let released = 0;
    for (const reward of available) {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.referralReward.updateMany({
          where: { id: reward.id, status: 'PENDING' },
          data: { status: 'AVAILABLE', availableSince: now },
        });
        if (claimed.count !== 1) return;
        const wallet = await tx.wallet.upsert({
          where: { userId: reward.beneficiaryUserId },
          create: { userId: reward.beneficiaryUserId, balanceCents: reward.amountCents },
          update: { balanceCents: { increment: reward.amountCents } },
        });
        await tx.walletCreditLot.create({
          data: {
            walletId: wallet.id,
            source: 'REFERRAL_REWARD',
            sourceReferenceId: reward.orderId,
            referralRewardId: reward.id,
            originalAmountCents: reward.amountCents,
            remainingAmountCents: reward.amountCents,
            expiresAt: reward.expiresAt,
          },
        });
        await tx.walletMovement.create({
          data: {
            walletId: wallet.id,
            type: 'REFERRAL_REWARD',
            status: 'COMPLETED',
            amountCents: reward.amountCents,
            description: 'Recompensa por compra de referido',
            referenceId: reward.id,
            completedAt: now,
          },
        });
        await this.postRewardLedger(tx, reward.id, reward.beneficiaryUserId, reward.amountCents);
        await this.notifications?.notifyFromTemplate(
          reward.beneficiaryUserId,
          'REFERRAL_REWARD_AVAILABLE',
          { amount: (reward.amountCents / 100).toFixed(2) },
          { rewardId: reward.id },
          tx,
        );
        released += 1;
      });
    }
    const expiredLots = await this.prisma.walletCreditLot.findMany({
      where: {
        status: { in: ['AVAILABLE', 'PARTIALLY_USED'] },
        expiresAt: { lte: now },
        remainingAmountCents: { gt: 0 },
      },
      take: 200,
    });
    let expired = 0;
    for (const lot of expiredLots) {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.walletCreditLot.findUnique({ where: { id: lot.id } });
        if (
          !current ||
          current.remainingAmountCents <= 0 ||
          !['AVAILABLE', 'PARTIALLY_USED'].includes(current.status)
        )
          return;
        await tx.walletCreditLot.update({
          where: { id: current.id },
          data: { status: 'EXPIRED', remainingAmountCents: 0 },
        });
        await tx.wallet.update({
          where: { id: current.walletId },
          data: { balanceCents: { decrement: current.remainingAmountCents } },
        });
        await tx.walletMovement.create({
          data: {
            walletId: current.walletId,
            type: 'CREDIT_EXPIRATION',
            status: 'COMPLETED',
            amountCents: -current.remainingAmountCents,
            description: 'Vencimiento de crédito Beerry',
            referenceId: current.id,
            completedAt: now,
          },
        });
        if (current.referralRewardId)
          await tx.referralReward.update({
            where: { id: current.referralRewardId },
            data: { status: 'EXPIRED' },
          });
        expired += 1;
      });
    }
    return { released, expired };
  }

  async consumeCredits(
    tx: Prisma.TransactionClient,
    userId: string,
    orderId: string,
    requestedCents: number,
    orderTotalCents: number,
  ) {
    if (requestedCents <= 0) return 0;
    const settings = await tx.referralProgramSettings.upsert({
      where: { id: 'referral-program' },
      create: {},
      update: {},
    });
    const maximum = Math.floor((orderTotalCents * settings.maxCreditUsageBps) / 10_000);
    if (requestedCents > maximum)
      throw badRequest(
        'CREDIT_USAGE_LIMIT_EXCEEDED',
        'El crédito solicitado supera el máximo permitido para esta compra.',
      );
    await tx.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${'customer-wallet:' + userId}))::text`,
    );
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balanceCents < requestedCents)
      throw conflict('INSUFFICIENT_WALLET_BALANCE', 'No tienes saldo suficiente en tu billetera.');
    const lots = await tx.walletCreditLot.findMany({
      where: {
        walletId: wallet.id,
        status: { in: ['AVAILABLE', 'PARTIALLY_USED'] },
        remainingAmountCents: { gt: 0 },
        availableAt: { lte: new Date() },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
    });
    let pending = requestedCents;
    for (const lot of lots) {
      if (pending <= 0) break;
      const used = Math.min(pending, lot.remainingAmountCents);
      const remaining = lot.remainingAmountCents - used;
      await tx.walletCreditLot.update({
        where: { id: lot.id },
        data: {
          remainingAmountCents: remaining,
          status: remaining === 0 ? 'USED' : 'PARTIALLY_USED',
        },
      });
      await tx.walletCreditConsumption.create({
        data: { creditLotId: lot.id, orderId, amountCents: used },
      });
      if (lot.referralRewardId)
        await tx.referralReward.update({
          where: { id: lot.referralRewardId },
          data: { status: remaining === 0 ? 'USED' : 'PARTIALLY_USED' },
        });
      pending -= used;
    }
    if (pending > 0)
      throw conflict(
        'INSUFFICIENT_ELIGIBLE_CREDIT',
        'Parte del saldo todavía no está disponible o ya venció.',
      );
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceCents: { decrement: requestedCents } },
    });
    await tx.walletMovement.create({
      data: {
        walletId: wallet.id,
        type: 'PURCHASE',
        status: 'COMPLETED',
        amountCents: -requestedCents,
        description: 'Crédito aplicado a compra',
        referenceId: orderId,
        completedAt: new Date(),
      },
    });
    return requestedCents;
  }

  async consumeWalletBalance(
    tx: Prisma.TransactionClient,
    userId: string,
    orderId: string,
    totalCents: number,
  ) {
    if (totalCents <= 0)
      throw badRequest('INVALID_WALLET_PAYMENT', 'El total debe ser mayor a cero.');
    await tx.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${'customer-wallet:' + userId}))::text`,
    );
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balanceCents < totalCents) {
      throw conflict(
        'INSUFFICIENT_WALLET_BALANCE',
        'Saldo insuficiente. Recarga tu billetera o paga el total con Flow.',
      );
    }
    const now = new Date();
    const lots = await tx.walletCreditLot.findMany({
      where: {
        walletId: wallet.id,
        status: { in: ['AVAILABLE', 'PARTIALLY_USED'] },
        remainingAmountCents: { gt: 0 },
        availableAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
    });
    let pending = totalCents;
    let customerFundedCents = 0;
    for (const lot of lots) {
      if (pending <= 0) break;
      const used = Math.min(pending, lot.remainingAmountCents);
      const remaining = lot.remainingAmountCents - used;
      await tx.walletCreditLot.update({
        where: { id: lot.id },
        data: {
          remainingAmountCents: remaining,
          status: remaining === 0 ? 'USED' : 'PARTIALLY_USED',
        },
      });
      await tx.walletCreditConsumption.create({
        data: { creditLotId: lot.id, orderId, amountCents: used },
      });
      if (lot.referralRewardId) {
        await tx.referralReward.update({
          where: { id: lot.referralRewardId },
          data: { status: remaining === 0 ? 'USED' : 'PARTIALLY_USED' },
        });
      }
      if (lot.source === 'TOP_UP' || lot.source === 'REFUND') customerFundedCents += used;
      pending -= used;
    }
    if (pending > 0) {
      throw conflict(
        'INSUFFICIENT_ELIGIBLE_CREDIT',
        'Parte del saldo todavía no está disponible o ya venció.',
      );
    }
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceCents: { decrement: totalCents } },
    });
    await tx.walletMovement.create({
      data: {
        walletId: wallet.id,
        type: 'PURCHASE',
        status: 'COMPLETED',
        amountCents: -totalCents,
        description: 'Compra pagada con saldo Beerry',
        referenceId: orderId,
        completedAt: now,
      },
    });
    return { consumedCents: totalCents, customerFundedCents };
  }

  async reverseOrderEffects(tx: Prisma.TransactionClient, orderId: string, reason: string) {
    const reward = await tx.referralReward.findUnique({
      where: { orderId },
      include: { creditLot: true },
    });
    if (reward && reward.status !== 'REVERSED') {
      const remaining = reward.creditLot?.remainingAmountCents ?? 0;
      if (reward.creditLot && remaining > 0) {
        await tx.walletCreditLot.update({
          where: { id: reward.creditLot.id },
          data: { status: 'REVERSED', remainingAmountCents: 0 },
        });
        await tx.wallet.update({
          where: { id: reward.creditLot.walletId },
          data: { balanceCents: { decrement: reward.amountCents } },
        });
        await tx.walletMovement.create({
          data: {
            walletId: reward.creditLot.walletId,
            type: 'REFERRAL_REVERSAL',
            status: 'COMPLETED',
            amountCents: -reward.amountCents,
            description: 'Reversión de recompensa por reembolso',
            referenceId: reward.id,
            completedAt: new Date(),
          },
        });
      }
      await this.reverseRewardLedger(tx, reward.id);
      await tx.referralReward.update({
        where: { id: reward.id },
        data: { status: 'REVERSED', reversedAt: new Date(), reversalReason: reason },
      });
    }
    const consumptions = await tx.walletCreditConsumption.findMany({
      where: { orderId },
      include: { creditLot: true },
    });
    for (const item of consumptions) {
      if (item.creditLot.expiresAt && item.creditLot.expiresAt <= new Date()) continue;
      const remaining = item.creditLot.remainingAmountCents + item.amountCents;
      await tx.walletCreditLot.update({
        where: { id: item.creditLotId },
        data: {
          remainingAmountCents: remaining,
          status: remaining >= item.creditLot.originalAmountCents ? 'AVAILABLE' : 'PARTIALLY_USED',
        },
      });
      await tx.wallet.update({
        where: { id: item.creditLot.walletId },
        data: { balanceCents: { increment: item.amountCents } },
      });
      await tx.walletMovement.create({
        data: {
          walletId: item.creditLot.walletId,
          type: 'REFUND',
          status: 'COMPLETED',
          amountCents: item.amountCents,
          description: 'Restitución de crédito por reembolso',
          referenceId: orderId,
          completedAt: new Date(),
        },
      });
    }
  }

  async transfer(user: AuthenticatedUser, input: TransferCreditDto) {
    const settings = await this.getSettings();
    if (!settings.transfersEnabled)
      throw forbidden(
        'WALLET_TRANSFERS_DISABLED',
        'Las transferencias de crédito no están habilitadas.',
      );
    const recipient = await this.prisma.user.findUnique({
      where: {
        phoneCountryCode_phoneNumber: {
          phoneCountryCode: input.phoneCountryCode,
          phoneNumber: input.phoneNumber,
        },
      },
    });
    if (!recipient || recipient.status !== UserStatus.ACTIVE || !recipient.phoneVerifiedAt)
      throw notFound(
        'TRANSFER_RECIPIENT_NOT_FOUND',
        'No encontramos un usuario activo y verificado.',
      );
    if (recipient.id === user.id)
      throw badRequest('SELF_TRANSFER_NOT_ALLOWED', 'No puedes transferirte crédito a ti mismo.');
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.walletTransfer.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
      const [from, to] = await Promise.all([
        tx.wallet.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} }),
        tx.wallet.upsert({
          where: { userId: recipient.id },
          create: { userId: recipient.id },
          update: {},
        }),
      ]);
      const [first, second] = [from.id, to.id].sort();
      await tx.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`wallet-transfer:${first}`}))::text`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`wallet-transfer:${second}`}))::text`,
      );
      const now = new Date();
      const day = new Date(now);
      day.setHours(0, 0, 0, 0);
      const month = new Date(now.getFullYear(), now.getMonth(), 1);
      const [daily, monthly] = await Promise.all([
        tx.walletTransfer.aggregate({
          where: { fromWalletId: from.id, status: 'COMPLETED', createdAt: { gte: day } },
          _sum: { amountCents: true },
        }),
        tx.walletTransfer.aggregate({
          where: { fromWalletId: from.id, status: 'COMPLETED', createdAt: { gte: month } },
          _sum: { amountCents: true },
        }),
      ]);
      if (
        settings.maxDailyTransferCents &&
        (daily._sum.amountCents ?? 0) + input.amountCents > settings.maxDailyTransferCents
      )
        throw conflict(
          'DAILY_TRANSFER_LIMIT_EXCEEDED',
          'Superaste el límite diario de transferencias.',
        );
      if (
        settings.maxMonthlyTransferCents &&
        (monthly._sum.amountCents ?? 0) + input.amountCents > settings.maxMonthlyTransferCents
      )
        throw conflict(
          'MONTHLY_TRANSFER_LIMIT_EXCEEDED',
          'Superaste el límite mensual de transferencias.',
        );
      const transfer = await tx.walletTransfer.create({
        data: {
          fromWalletId: from.id,
          toWalletId: to.id,
          amountCents: input.amountCents,
          idempotencyKey: input.idempotencyKey,
          note: input.note,
          status: 'COMPLETED',
          completedAt: now,
        },
      });
      const lots = await tx.walletCreditLot.findMany({
        where: {
          walletId: from.id,
          status: { in: ['AVAILABLE', 'PARTIALLY_USED'] },
          remainingAmountCents: { gt: 0 },
          source: 'REFERRAL_REWARD',
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
      });
      let pending = input.amountCents;
      for (const lot of lots) {
        if (pending <= 0) break;
        const amount = Math.min(pending, lot.remainingAmountCents);
        const remaining = lot.remainingAmountCents - amount;
        await tx.walletCreditLot.update({
          where: { id: lot.id },
          data: {
            remainingAmountCents: remaining,
            status: remaining === 0 ? 'USED' : 'PARTIALLY_USED',
          },
        });
        const destination = await tx.walletCreditLot.create({
          data: {
            walletId: to.id,
            source: 'TRANSFER',
            sourceReferenceId: transfer.id,
            originalAmountCents: amount,
            remainingAmountCents: amount,
            expiresAt: lot.expiresAt,
          },
        });
        await tx.walletTransferAllocation.create({
          data: {
            transferId: transfer.id,
            sourceCreditLotId: lot.id,
            destinationCreditLotId: destination.id,
            amountCents: amount,
          },
        });
        pending -= amount;
      }
      if (pending > 0)
        throw conflict(
          'INSUFFICIENT_TRANSFERABLE_CREDIT',
          'No tienes suficiente crédito de referidos transferible.',
        );
      await Promise.all([
        tx.wallet.update({
          where: { id: from.id },
          data: { balanceCents: { decrement: input.amountCents } },
        }),
        tx.wallet.update({
          where: { id: to.id },
          data: { balanceCents: { increment: input.amountCents } },
        }),
        tx.walletMovement.create({
          data: {
            walletId: from.id,
            type: 'TRANSFER_OUT',
            status: 'COMPLETED',
            amountCents: -input.amountCents,
            description: 'Transferencia de crédito enviada',
            referenceId: transfer.id,
            completedAt: now,
          },
        }),
        tx.walletMovement.create({
          data: {
            walletId: to.id,
            type: 'TRANSFER_IN',
            status: 'COMPLETED',
            amountCents: input.amountCents,
            description: 'Transferencia de crédito recibida',
            referenceId: transfer.id,
            completedAt: now,
          },
        }),
      ]);
      await this.notifications?.notifyFromTemplate(
        recipient.id,
        'REFERRAL_TRANSFER_RECEIVED',
        { amount: (input.amountCents / 100).toFixed(2) },
        { transferId: transfer.id },
        tx,
      );
      return transfer;
    });
  }

  async adminList(actor: AuthenticatedUser, query: ReferralAdminQueryDto) {
    this.assertSuperAdmin(actor);
    const where: Prisma.ReferralRewardWhereInput = {
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.search
        ? {
            OR: [
              { beneficiary: { fullName: { contains: query.search, mode: 'insensitive' } } },
              { buyer: { fullName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total, sums] = await Promise.all([
      this.prisma.referralReward.findMany({
        where,
        include: {
          beneficiary: { select: { id: true, fullName: true } },
          buyer: { select: { id: true, fullName: true } },
          order: { select: { id: true, totalCents: true, paidAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.referralReward.count({ where }),
      this.prisma.referralReward.aggregate({
        where,
        _sum: { amountCents: true, eligibleBaseCents: true },
      }),
    ]);
    return {
      items,
      summary: {
        rewardsCents: sums._sum.amountCents ?? 0,
        eligibleSalesCents: sums._sum.eligibleBaseCents ?? 0,
      },
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  private async ensureCode(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });
    if (!user) throw notFound('USER_NOT_FOUND', 'No encontramos el usuario.');
    if (user.referralCode && /^[A-Z0-9]{6}$/.test(user.referralCode)) return user.referralCode;
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 10; attempt++) {
      const bytes = randomBytes(6);
      const code = Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
      try {
        return (
          await this.prisma.user.update({ where: { id: userId }, data: { referralCode: code } })
        ).referralCode!;
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002') throw error;
      }
    }
    throw conflict(
      'REFERRAL_CODE_GENERATION_FAILED',
      'No pudimos generar un código único. Inténtalo nuevamente.',
    );
  }

  private async activeSettings(tx: Tx = this.prisma) {
    const settings = await tx.referralProgramSettings.upsert({
      where: { id: 'referral-program' },
      create: {},
      update: {},
    });
    const now = new Date();
    if (
      !settings.enabled ||
      (settings.startsAt && settings.startsAt > now) ||
      (settings.endsAt && settings.endsAt < now)
    )
      throw forbidden('REFERRAL_PROGRAM_DISABLED', 'El programa de referidos no está activo.');
    return settings;
  }

  private async postRewardLedger(
    tx: Prisma.TransactionClient,
    rewardId: string,
    userId: string,
    amountCents: number,
  ) {
    const reference = `REFERRAL_REWARD:${rewardId}`;
    if (await tx.ledgerTransaction.findUnique({ where: { reference } })) return;
    const [platform, customer] = await Promise.all([
      tx.financialAccount.upsert({
        where: { code: 'PLATFORM:MAIN' },
        create: { code: 'PLATFORM:MAIN', ownerType: 'PLATFORM', currency: 'PEN' },
        update: {},
      }),
      tx.financialAccount.upsert({
        where: { code: `CUSTOMER:${userId}` },
        create: { code: `CUSTOMER:${userId}`, ownerType: 'CUSTOMER', userId, currency: 'PEN' },
        update: {},
      }),
    ]);
    await tx.ledgerTransaction.create({
      data: {
        reference,
        type: 'ADJUSTMENT',
        currency: 'PEN',
        debitTotalCents: amountCents,
        creditTotalCents: amountCents,
        description: 'Asignación de comisión de Beerry a recompensa de referido',
        metadata: { rewardId },
        entries: {
          create: [
            {
              accountId: platform.id,
              direction: 'DEBIT',
              bucket: 'AVAILABLE',
              amountCents,
              description: 'Costo de recompensa de referido',
            },
            {
              accountId: customer.id,
              direction: 'CREDIT',
              bucket: 'AVAILABLE',
              amountCents,
              description: 'Crédito Beerry por referido',
            },
          ],
        },
      },
    });
    await Promise.all([
      tx.financialAccount.update({
        where: { id: platform.id },
        data: { availableCents: { decrement: amountCents } },
      }),
      tx.financialAccount.update({
        where: { id: customer.id },
        data: { availableCents: { increment: amountCents } },
      }),
    ]);
  }

  private async reverseRewardLedger(tx: Prisma.TransactionClient, rewardId: string) {
    const reference = `REFERRAL_REWARD_REVERSAL:${rewardId}`;
    if (await tx.ledgerTransaction.findUnique({ where: { reference } })) return;
    const original = await tx.ledgerTransaction.findUnique({
      where: { reference: `REFERRAL_REWARD:${rewardId}` },
      include: { entries: true },
    });
    if (!original) return;
    await tx.ledgerTransaction.create({
      data: {
        reference,
        type: 'ADJUSTMENT',
        reversalOfId: original.id,
        currency: original.currency,
        debitTotalCents: original.creditTotalCents,
        creditTotalCents: original.debitTotalCents,
        description: 'Reversión de recompensa de referido',
        metadata: { rewardId },
        entries: {
          create: original.entries.map((entry) => ({
            accountId: entry.accountId,
            direction: entry.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT',
            bucket: entry.bucket,
            amountCents: entry.amountCents,
            description: 'Reversión de recompensa de referido',
          })),
        },
      },
    });
    for (const entry of original.entries) {
      const field =
        entry.bucket === 'PENDING'
          ? 'pendingCents'
          : entry.bucket === 'HELD'
            ? 'heldCents'
            : entry.bucket === 'WITHDRAWN'
              ? 'withdrawnCents'
              : 'availableCents';
      if (entry.direction === 'CREDIT')
        await tx.financialAccount.update({
          where: { id: entry.accountId },
          data: { [field]: { decrement: entry.amountCents } },
        });
      else
        await tx.financialAccount.update({
          where: { id: entry.accountId },
          data: { [field]: { increment: entry.amountCents } },
        });
    }
  }

  private expiration(base: Date, mode: ReferralExpirationMode, days: number | null) {
    if (mode === ReferralExpirationMode.NONE) return null;
    if (mode === ReferralExpirationMode.FIXED_DAYS)
      return new Date(base.getTime() + (days ?? 1) * 86_400_000);
    const monthOffset = mode === ReferralExpirationMode.NEXT_MONTH_END ? 2 : 1;
    return new Date(base.getFullYear(), base.getMonth() + monthOffset, 0, 23, 59, 59, 999);
  }

  private normalizeCode(value: string) {
    return value.trim().replace(/\s+/g, '').toUpperCase();
  }
  private mask(value: string) {
    return value.length <= 3 ? `${value[0] ?? ''}***` : `${value.slice(0, 3)}***`;
  }
  private assertSuperAdmin(user: AuthenticatedUser) {
    if (user.role !== UserRole.SUPER_ADMIN)
      throw forbidden('SUPER_ADMIN_REQUIRED', 'Solo Super Admin puede administrar referidos.');
  }
}
