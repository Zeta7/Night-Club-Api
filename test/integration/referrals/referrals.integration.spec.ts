/// <reference types="jest" />
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { ReferralCaptureMethod, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ReferralsService } from '@modules/referrals/application/referrals.service';

jest.setTimeout(180_000);

describe('Module 17 - referrals, rewards and shared credit', () => {
  const prisma = new PrismaService(new ConfigService());
  const service = new ReferralsService(prisma);
  const suffix = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const orderIds: string[] = [];
  let clubId: string;
  let referrerId: string;
  let buyerId: string;
  let secondBuyerId: string;
  let recipientId: string;
  let adminId: string;
  const auth = (id: string, role: UserRole = UserRole.CUSTOMER) => ({ id, role });

  beforeAll(async () => {
    await prisma.$connect();
    const stamp = Date.now().toString().slice(-7);
    const createUser = async (prefix: string, name: string, role: UserRole = UserRole.CUSTOMER) => {
      const user = await prisma.user.create({
        data: {
          phoneCountryCode: '+51',
          phoneNumber: `${prefix}${stamp}`,
          passwordHash: 'test',
          fullName: `${name} ${suffix}`,
          role,
          status: 'ACTIVE',
          phoneVerifiedAt: new Date(),
        },
      });
      userIds.push(user.id);
      return user;
    };
    const [referrer, buyer, buyer2, recipient, admin] = await Promise.all([
      createUser('71', 'Referente'),
      createUser('72', 'Comprador'),
      createUser('73', 'Comprador dos'),
      createUser('74', 'Receptor'),
      createUser('75', 'Super Admin', UserRole.SUPER_ADMIN),
    ]);
    referrerId = referrer.id;
    buyerId = buyer.id;
    secondBuyerId = buyer2.id;
    recipientId = recipient.id;
    adminId = admin.id;
    clubId = (
      await prisma.club.create({ data: { name: `Referral Club ${suffix}`, status: 'ACTIVE' } })
    ).id;
    await prisma.referralProgramSettings.upsert({
      where: { id: 'referral-program' },
      create: { enabled: true, holdHours: 0, expirationMode: 'NEXT_MONTH_END' },
      update: {
        enabled: true,
        rewardBps: 100,
        platformCommissionBps: 600,
        minimumPlatformMarginBps: 300,
        holdHours: 0,
        associationWindowDays: 7,
        maxCreditUsageBps: 10000,
        transfersEnabled: false,
        maximumRewardPerOrderCents: null,
        maximumMonthlyRewardCents: null,
        expirationMode: 'NEXT_MONTH_END',
      },
    });
  });

  afterAll(async () => {
    await prisma.walletTransferAllocation.deleteMany({
      where: {
        transfer: {
          OR: [
            { fromWallet: { userId: { in: userIds } } },
            { toWallet: { userId: { in: userIds } } },
          ],
        },
      },
    });
    await prisma.walletTransfer.deleteMany({
      where: {
        OR: [
          { fromWallet: { userId: { in: userIds } } },
          { toWallet: { userId: { in: userIds } } },
        ],
      },
    });
    await prisma.walletCreditConsumption.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.walletCreditLot.deleteMany({ where: { wallet: { userId: { in: userIds } } } });
    const rewardIds = (
      await prisma.referralReward.findMany({
        where: { OR: [{ beneficiaryUserId: { in: userIds } }, { buyerUserId: { in: userIds } }] },
        select: { id: true },
      })
    ).map((item) => item.id);
    const referralLedger = await prisma.ledgerTransaction.findMany({
      where: { reference: { in: rewardIds.map((id) => `REFERRAL_REWARD:${id}`) } },
      include: { entries: true, reversals: { include: { entries: true } } },
    });
    for (const transaction of referralLedger) {
      for (const row of [transaction, ...transaction.reversals]) {
        for (const entry of row.entries) {
          const field =
            entry.bucket === 'PENDING'
              ? 'pendingCents'
              : entry.bucket === 'HELD'
                ? 'heldCents'
                : entry.bucket === 'WITHDRAWN'
                  ? 'withdrawnCents'
                  : 'availableCents';
          await prisma.financialAccount.update({
            where: { id: entry.accountId },
            data: {
              [field]:
                entry.direction === 'CREDIT'
                  ? { decrement: entry.amountCents }
                  : { increment: entry.amountCents },
            },
          });
        }
      }
    }
    const ledgerIds = referralLedger.flatMap((item) => [
      item.id,
      ...item.reversals.map((reversal) => reversal.id),
    ]);
    await prisma.ledgerEntry.deleteMany({ where: { transactionId: { in: ledgerIds } } });
    await prisma.ledgerTransaction.deleteMany({
      where: {
        id: { in: referralLedger.flatMap((item) => item.reversals.map((reversal) => reversal.id)) },
      },
    });
    await prisma.ledgerTransaction.deleteMany({
      where: { id: { in: referralLedger.map((item) => item.id) } },
    });
    await prisma.referralReward.deleteMany({
      where: { OR: [{ beneficiaryUserId: { in: userIds } }, { buyerUserId: { in: userIds } }] },
    });
    await prisma.customerReferral.deleteMany({
      where: { OR: [{ referrerUserId: { in: userIds } }, { referredUserId: { in: userIds } }] },
    });
    await prisma.walletMovement.deleteMany({ where: { wallet: { userId: { in: userIds } } } });
    await prisma.wallet.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.club.delete({ where: { id: clubId } });
    await prisma.referralProgramSettings.update({
      where: { id: 'referral-program' },
      data: { enabled: false, transfersEnabled: false },
    });
    await prisma.$disconnect();
  });

  const paidOrder = async (userId: string, totalCents: number, promotionalCreditUsedCents = 0) => {
    const order = await prisma.order.create({
      data: {
        userId,
        clubId,
        status: 'PAID',
        totalCents,
        promotionalCreditUsedCents,
        customerFundedCents: totalCents - promotionalCreditUsedCents,
        paidAt: new Date(),
      },
    });
    orderIds.push(order.id);
    return order;
  };

  it('generates a code and associates eligible registered users by link or manual code', async () => {
    await prisma.user.update({
      where: { id: referrerId },
      data: { referralCode: `BEE-LEGACY-${suffix}` },
    });
    const mine = await service.getMine(auth(referrerId));
    expect(mine.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(mine.shareUrl).toContain(mine.code);
    const preview = await service.preview(mine.code.toLowerCase());
    expect(preview.code).toBe(mine.code);
    const link = await service.associate(auth(buyerId), mine.code, ReferralCaptureMethod.LINK);
    const manual = await service.associate(
      auth(secondBuyerId),
      mine.code.toLowerCase(),
      ReferralCaptureMethod.CODE,
    );
    expect(link.referrerUserId).toBe(referrerId);
    expect(manual.captureMethod).toBe('CODE');
  });

  it('rejects self-referral, a second association and users with previous purchases', async () => {
    const code = (await service.getMine(auth(referrerId))).code;
    await expect(service.associate(auth(referrerId), code)).rejects.toMatchObject({
      response: { error: { code: 'SELF_REFERRAL_NOT_ALLOWED' } },
    });
    await expect(service.associate(auth(buyerId), code)).rejects.toMatchObject({
      response: { error: { code: 'REFERRAL_ALREADY_ASSOCIATED' } },
    });
    const late = await prisma.user.create({
      data: {
        phoneCountryCode: '+51',
        phoneNumber: `76${Date.now().toString().slice(-7)}`,
        passwordHash: 'test',
        fullName: `Late ${suffix}`,
        status: 'ACTIVE',
        phoneVerifiedAt: new Date(),
      },
    });
    userIds.push(late.id);
    await paidOrder(late.id, 1000);
    await expect(service.associate(auth(late.id), code)).rejects.toMatchObject({
      response: { error: { code: 'REFERRAL_PURCHASE_ALREADY_EXISTS' } },
    });
    const expired = await prisma.user.create({
      data: {
        phoneCountryCode: '+51',
        phoneNumber: `77${Date.now().toString().slice(-7)}`,
        passwordHash: 'test',
        fullName: `Expired ${suffix}`,
        status: 'ACTIVE',
        phoneVerifiedAt: new Date(),
        createdAt: new Date(Date.now() - 10 * 86_400_000),
      },
    });
    userIds.push(expired.id);
    await expect(service.associate(auth(expired.id), code)).rejects.toMatchObject({
      response: { error: { code: 'REFERRAL_ASSOCIATION_WINDOW_EXPIRED' } },
    });
  });

  it('creates recurrent rewards, excludes promotional credit and is idempotent', async () => {
    const first = await paidOrder(buyerId, 10000, 2000);
    const second = await paidOrder(buyerId, 5000);
    const firstReward = await prisma.$transaction((tx) =>
      service.createRewardForPaidOrder(tx, first.id),
    );
    const duplicate = await prisma.$transaction((tx) =>
      service.createRewardForPaidOrder(tx, first.id),
    );
    const secondReward = await prisma.$transaction((tx) =>
      service.createRewardForPaidOrder(tx, second.id),
    );
    expect(firstReward).toMatchObject({ eligibleBaseCents: 8000, amountCents: 80 });
    expect(duplicate?.id).toBe(firstReward?.id);
    expect(secondReward?.amountCents).toBe(50);
    expect(await prisma.referralReward.count({ where: { orderId: first.id } })).toBe(1);
    const concurrentOrder = await paidOrder(secondBuyerId, 7000);
    const [concurrentA, concurrentB] = await Promise.all([
      prisma.$transaction((tx) => service.createRewardForPaidOrder(tx, concurrentOrder.id)),
      prisma.$transaction((tx) => service.createRewardForPaidOrder(tx, concurrentOrder.id)),
    ]);
    expect(concurrentA?.id).toBe(concurrentB?.id);
    expect(await prisma.referralReward.count({ where: { orderId: concurrentOrder.id } })).toBe(1);
  });

  it('protects Beerry minimum margin from invalid Super Admin settings', async () => {
    await expect(
      service.updateSettings(auth(adminId, UserRole.SUPER_ADMIN), {
        platformCommissionBps: 600,
        minimumPlatformMarginBps: 300,
        rewardBps: 301,
      }),
    ).rejects.toMatchObject({ response: { error: { code: 'REFERRAL_MARGIN_NOT_PROTECTED' } } });
    const updated = await service.updateSettings(auth(adminId, UserRole.SUPER_ADMIN), {
      rewardBps: 100,
      holdHours: 0,
    });
    expect(updated.rewardBps).toBe(100);
  });

  it('releases due rewards into one wallet and consumes earliest-expiring lots atomically', async () => {
    const processed = await service.processDueRewards(new Date(Date.now() + 1000));
    expect(processed.released).toBeGreaterThanOrEqual(2);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: referrerId } });
    expect(wallet.balanceCents).toBeGreaterThanOrEqual(130);
    expect(
      await prisma.ledgerTransaction.count({
        where: { reference: { startsWith: 'REFERRAL_REWARD:' } },
      }),
    ).toBeGreaterThanOrEqual(2);
    const purchase = await paidOrder(referrerId, 100);
    await prisma.$transaction((tx) =>
      service.consumeCredits(tx, referrerId, purchase.id, 100, 100),
    );
    const consumptions = await prisma.walletCreditConsumption.findMany({
      where: { orderId: purchase.id },
      include: { creditLot: true },
    });
    expect(consumptions.reduce((sum, item) => sum + item.amountCents, 0)).toBe(100);
    expect(consumptions[0].creditLot.expiresAt).not.toBeNull();
  });

  it('expires only promotional lots without affecting other wallet funds', async () => {
    const reward = await prisma.referralReward.findFirstOrThrow({
      where: { beneficiaryUserId: referrerId, status: { in: ['AVAILABLE', 'PARTIALLY_USED'] } },
    });
    const lot = await prisma.walletCreditLot.findUniqueOrThrow({
      where: { referralRewardId: reward.id },
    });
    const before = await prisma.wallet.findUniqueOrThrow({ where: { id: lot.walletId } });
    await prisma.walletCreditLot.create({
      data: {
        walletId: lot.walletId,
        source: 'TOP_UP',
        sourceReferenceId: `topup-${suffix}`,
        originalAmountCents: 500,
        remainingAmountCents: 500,
      },
    });
    await prisma.wallet.update({
      where: { id: lot.walletId },
      data: { balanceCents: { increment: 500 } },
    });
    const expiring = lot.remainingAmountCents;
    await prisma.walletCreditLot.update({
      where: { id: lot.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await service.processDueRewards();
    const after = await prisma.wallet.findUniqueOrThrow({ where: { id: lot.walletId } });
    expect(after.balanceCents).toBe(before.balanceCents + 500 - expiring);
    expect(
      await prisma.walletCreditLot.count({
        where: {
          walletId: lot.walletId,
          source: 'TOP_UP',
          remainingAmountCents: 500,
          status: 'AVAILABLE',
        },
      }),
    ).toBe(1);
    expect((await prisma.walletCreditLot.findUniqueOrThrow({ where: { id: lot.id } })).status).toBe(
      'EXPIRED',
    );
  });

  it('reverses an available reward when its source purchase is refunded', async () => {
    const order = await paidOrder(secondBuyerId, 20000);
    const reward = await prisma.$transaction((tx) =>
      service.createRewardForPaidOrder(tx, order.id),
    );
    await service.processDueRewards(new Date(Date.now() + 1000));
    await prisma.$transaction((tx) => service.reverseOrderEffects(tx, order.id, 'TEST_REFUND'));
    expect(
      (await prisma.referralReward.findUniqueOrThrow({ where: { id: reward!.id } })).status,
    ).toBe('REVERSED');
  });

  it('transfers referral credit atomically, idempotently and preserves expiration', async () => {
    await service.updateSettings(auth(adminId, UserRole.SUPER_ADMIN), {
      transfersEnabled: true,
      maxDailyTransferCents: 1000,
      maxMonthlyTransferCents: 2000,
    });
    const fundingOrder = await paidOrder(buyerId, 5000);
    await prisma.$transaction((tx) => service.createRewardForPaidOrder(tx, fundingOrder.id));
    await service.processDueRewards(new Date(Date.now() + 1000));
    const recipient = await prisma.user.findUniqueOrThrow({ where: { id: recipientId } });
    const input = {
      phoneCountryCode: recipient.phoneCountryCode,
      phoneNumber: recipient.phoneNumber,
      amountCents: 20,
      idempotencyKey: `transfer-${suffix}`,
    };
    const transfer = await service.transfer(auth(referrerId), input);
    const duplicate = await service.transfer(auth(referrerId), input);
    expect(duplicate.id).toBe(transfer.id);
    const allocation = await prisma.walletTransferAllocation.findFirstOrThrow({
      where: { transferId: transfer.id },
      include: { sourceCreditLot: true, destinationCreditLot: true },
    });
    expect(allocation.destinationCreditLot.expiresAt?.getTime()).toBe(
      allocation.sourceCreditLot.expiresAt?.getTime(),
    );
    expect(
      (await prisma.wallet.findUniqueOrThrow({ where: { userId: recipientId } })).balanceCents,
    ).toBe(20);
  });
});
