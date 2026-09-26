/// <reference types="jest" />
import { CommerceService } from '@modules/commerce/application/commerce.service';
import { SimulatedPaymentGateway } from '@modules/commerce/infrastructure/simulated-payment.gateway';
import { UploadsService } from '@modules/uploads/application/uploads.service';
import { LedgerService } from '@modules/wallets/application/ledger.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import 'dotenv/config';
import { ok } from 'node:assert';
import { randomUUID } from 'node:crypto';

jest.setTimeout(60_000);

describe('Module 18 - wallet top-ups', () => {
  const config = new ConfigService();
  const prisma = new PrismaService(config);
  const gateway = new SimulatedPaymentGateway();
  const ledger = new LedgerService(prisma, config);
  const service = new CommerceService(
    prisma,
    config,
    {} as UploadsService,
    gateway,
    undefined,
    ledger,
  );
  const suffix = randomUUID().slice(0, 8);
  let userId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        phoneCountryCode: '+51',
        phoneNumber: `98${Date.now().toString().slice(-7)}`,
        passwordHash: 'integration-test',
        fullName: `Module 18 ${suffix}`,
        status: 'ACTIVE',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    const transactions = await prisma.ledgerTransaction.findMany({
      where: {
        reference: { startsWith: 'WALLET_TOP_UP:' },
        paymentAttempt: { walletTopUp: { userId } },
      },
      select: { id: true },
    });
    await prisma.ledgerEntry.deleteMany({
      where: { transactionId: { in: transactions.map((item) => item.id) } },
    });
    await prisma.ledgerTransaction.deleteMany({
      where: { id: { in: transactions.map((item) => item.id) } },
    });
    await prisma.financialAccount.deleteMany({ where: { userId } });
    await prisma.walletTopUp.deleteMany({ where: { userId } });
    if (wallet) await prisma.wallet.delete({ where: { id: wallet.id } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('credits an approved top-up exactly once and creates no referral reward', async () => {
    const authUser = { id: userId, role: 'CUSTOMER' as const };
    const created = await service.createWalletTopUp(authUser, 2500, `topup-${suffix}-approved`);
    ok(created.paymentAttemptId, 'This payment scenario must create a payment attempt');

    expect(created.status).toBe('PENDING');
    await service.simulatePayment(authUser, created.paymentAttemptId, 'APPROVED');
    await service.simulatePayment(authUser, created.paymentAttemptId, 'APPROVED');

    const [wallet, movements, lots, rewards, transactions] = await Promise.all([
      prisma.wallet.findUniqueOrThrow({ where: { userId } }),
      prisma.walletMovement.findMany({ where: { referenceId: created.topUpId, type: 'TOP_UP' } }),
      prisma.walletCreditLot.findMany({
        where: { sourceReferenceId: created.topUpId, source: 'TOP_UP' },
      }),
      prisma.referralReward.count({ where: { buyerUserId: userId } }),
      prisma.ledgerTransaction.findMany({
        where: { reference: `WALLET_TOP_UP:${created.topUpId}` },
        include: { entries: true },
      }),
    ]);
    expect(wallet.balanceCents).toBe(2500);
    expect(movements).toHaveLength(1);
    expect(lots).toHaveLength(1);
    expect(rewards).toBe(0);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.type).toBe('TOP_UP');
    expect(transactions[0]?.debitTotalCents).toBe(2500);
    expect(transactions[0]?.creditTotalCents).toBe(2500);
    expect(transactions[0]?.entries).toHaveLength(2);
  });

  it('expires an abandoned top-up through the scheduled sweep without changing the wallet', async () => {
    const authUser = { id: userId, role: 'CUSTOMER' as const };
    const created = await service.createWalletTopUp(authUser, 3000, `topup-${suffix}-expired`);
    ok(created.paymentAttemptId);
    const before = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    await prisma.paymentAttempt.update({
      where: { id: created.paymentAttemptId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const sweep = jest.spyOn(service, 'expirePendingPayments');
    try {
      service.onModuleInit();
      await sweep.mock.results[0]?.value;
    } finally {
      service.onModuleDestroy();
      sweep.mockRestore();
    }

    const [topUp, attempt, wallet] = await Promise.all([
      prisma.walletTopUp.findUniqueOrThrow({ where: { id: created.topUpId } }),
      prisma.paymentAttempt.findUniqueOrThrow({ where: { id: created.paymentAttemptId } }),
      prisma.wallet.findUniqueOrThrow({ where: { userId } }),
    ]);
    expect(topUp.status).toBe('EXPIRED');
    expect(attempt.status).toBe('EXPIRED');
    expect(wallet.balanceCents).toBe(before.balanceCents);
  });
  it('credits a late approval once after expiration despite concurrent callbacks', async () => {
    const authUser = { id: userId, role: 'CUSTOMER' as const };
    const created = await service.createWalletTopUp(authUser, 3100, `topup-${suffix}-late`);
    ok(created.paymentAttemptId);
    await prisma.paymentAttempt.update({
      where: { id: created.paymentAttemptId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await service.expirePendingWalletTopUps();
    expect((await service.getWalletTopUp(authUser, created.topUpId)).status).toBe('EXPIRED');
    const before = await prisma.wallet.findUniqueOrThrow({ where: { userId } });

    await Promise.all([
      service.simulatePayment(authUser, created.paymentAttemptId, 'APPROVED'),
      service.simulatePayment(authUser, created.paymentAttemptId, 'APPROVED'),
    ]);
    const [wallet, topUp, movements, transactions] = await Promise.all([
      prisma.wallet.findUniqueOrThrow({ where: { userId } }),
      prisma.walletTopUp.findUniqueOrThrow({ where: { id: created.topUpId } }),
      prisma.walletMovement.count({ where: { referenceId: created.topUpId, type: 'TOP_UP' } }),
      prisma.ledgerTransaction.count({ where: { reference: `WALLET_TOP_UP:${created.topUpId}` } }),
    ]);
    expect(wallet.balanceCents).toBe(before.balanceCents + 3100);
    expect(topUp.status).toBe('APPROVED');
    expect(topUp.failureCode).toBeNull();
    expect(topUp.rejectedAt).toBeNull();
    expect(movements).toBe(1);
    expect(transactions).toBe(1);
  });

  it('serializes expiration against an approval without losing or duplicating credit', async () => {
    const authUser = { id: userId, role: 'CUSTOMER' as const };
    const created = await service.createWalletTopUp(authUser, 3200, `topup-${suffix}-race`);
    ok(created.paymentAttemptId);
    await prisma.paymentAttempt.update({
      where: { id: created.paymentAttemptId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const before = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    await Promise.all([
      service.expirePendingWalletTopUps(),
      service.simulatePayment(authUser, created.paymentAttemptId, 'APPROVED'),
      service.simulatePayment(authUser, created.paymentAttemptId, 'APPROVED'),
    ]);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    const result = await service.getWalletTopUp(authUser, created.topUpId);
    expect(result.status).toBe('APPROVED');
    expect(result.paymentStatus).toBe('APPROVED');
    expect(wallet.balanceCents).toBe(before.balanceCents + 3200);
  });

  it('expires legacy receipts without a deadline and preserves unexpired attempts', async () => {
    const authUser = { id: userId, role: 'CUSTOMER' as const };
    const legacy = await service.createWalletTopUp(authUser, 3300, `topup-${suffix}-legacy`);
    const recent = await service.createWalletTopUp(authUser, 3300, `topup-${suffix}-recent`);
    ok(legacy.paymentAttemptId);
    await prisma.paymentAttempt.update({
      where: { id: legacy.paymentAttemptId },
      data: { expiresAt: null, createdAt: new Date(Date.now() - 31 * 60_000) },
    });
    await service.expirePendingWalletTopUps();
    const result = await service.listWalletTopUps(authUser);
    expect(result.items.find((item) => item.topUpId === legacy.topUpId)?.status).toBe('EXPIRED');
    expect(result.items.find((item) => item.topUpId === recent.topUpId)?.status).toBe('PENDING');
    const repeated = await service.createWalletTopUp(authUser, 3300, `topup-${suffix}-legacy`);
    expect(repeated.status).toBe('EXPIRED');
    expect(repeated.checkoutUrl).toBeNull();
  });

  it('reconciles Mercado Pago by attempt reference before expiring a paid top-up', async () => {
    const authUser = { id: userId, role: 'CUSTOMER' as const };
    const query = jest.fn();
    const queryPayment = jest.fn();
    const mercadoPago = {
      provider: 'mercado_pago',
      createPayment: jest.fn(async () => ({
        externalPaymentId: `preference-${suffix}`,
        status: 'PENDING' as const,
        checkoutUrl: 'https://www.mercadopago.com.pe/pay',
        sellerExternalId: '123',
      })),
      queryPaymentByExternalReference: query,
      queryExternalPayment: queryPayment,
    };
    const remote = new CommerceService(
      prisma,
      config,
      {} as UploadsService,
      gateway,
      undefined,
      ledger,
      undefined,
      undefined,
      mercadoPago,
    );
    const created = await remote.createWalletTopUp(authUser, 3400, `topup-${suffix}-remote`);
    ok(created.paymentAttemptId);
    const original = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: created.paymentAttemptId },
    });
    expect(mercadoPago.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresAt: original.expiresAt,
      }),
    );
    await prisma.paymentAttempt.update({
      where: { id: created.paymentAttemptId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const before = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    query.mockResolvedValue({
      provider: 'mercado_pago',
      providerEventId: `approved-${suffix}`,
      externalPaymentId: '123456789',
      attemptId: created.paymentAttemptId,
      orderId: created.topUpId,
      amountCents: 3400,
      currency: 'PEN',
      marketplaceFeeCents: 0,
      outcome: 'APPROVED',
    });
    const result = await remote.getWalletTopUp(authUser, created.topUpId);
    expect(query).toHaveBeenCalledWith(created.paymentAttemptId, '123');
    expect(queryPayment).not.toHaveBeenCalled();
    expect(result.status).toBe('APPROVED');
    expect(result.checkoutUrl).toBeNull();
    const after = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    expect(after.balanceCents).toBe(before.balanceCents + 3400);
  });

  it('expires on read even when provider reconciliation fails and removes the checkout URL', async () => {
    const authUser = { id: userId, role: 'CUSTOMER' as const };
    const failingGateway = {
      provider: 'simulated',
      createPayment: jest.fn(async () => ({
        externalPaymentId: `offline-${suffix}`,
        status: 'PENDING' as const,
        checkoutUrl: 'https://example.test/pay',
      })),
      queryPaymentByExternalReference: jest.fn(async () => {
        throw new Error('offline');
      }),
    };
    const offline = new CommerceService(
      prisma,
      config,
      {} as UploadsService,
      gateway,
      undefined,
      ledger,
      undefined,
      undefined,
      failingGateway,
    );
    const created = await offline.createWalletTopUp(authUser, 3500, `topup-${suffix}-offline`);
    ok(created.paymentAttemptId);
    await prisma.paymentAttempt.update({
      where: { id: created.paymentAttemptId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const before = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    const result = await offline.getWalletTopUp(authUser, created.topUpId);
    expect(result.status).toBe('EXPIRED');
    expect(result.checkoutUrl).toBeNull();
    expect((await prisma.wallet.findUniqueOrThrow({ where: { userId } })).balanceCents).toBe(
      before.balanceCents,
    );
  });

  it('does not change the wallet when a simulated payment is rejected', async () => {
    const authUser = { id: userId, role: 'CUSTOMER' as const };
    const before = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    const created = await service.createWalletTopUp(authUser, 3000, `topup-${suffix}-rejected`);
    ok(created.paymentAttemptId, 'This payment scenario must create a payment attempt');

    await service.simulatePayment(authUser, created.paymentAttemptId, 'REJECTED');

    const [after, topUp] = await Promise.all([
      prisma.wallet.findUniqueOrThrow({ where: { userId } }),
      prisma.walletTopUp.findUniqueOrThrow({ where: { id: created.topUpId } }),
    ]);
    expect(after.balanceCents).toBe(before.balanceCents);
    expect(topUp.status).toBe('REJECTED');
  });

  it('returns the original operation for a repeated idempotency key', async () => {
    const authUser = { id: userId, role: 'CUSTOMER' as const };
    const key = `topup-${suffix}-idempotent`;
    const first = await service.createWalletTopUp(authUser, 4000, key);
    const repeated = await service.createWalletTopUp(authUser, 4000, key);

    expect(repeated.topUpId).toBe(first.topUpId);
    expect(repeated.paymentAttemptId).toBe(first.paymentAttemptId);
    expect(await prisma.walletTopUp.count({ where: { idempotencyKey: key } })).toBe(1);
  });

  it('recovers an approved callback that was previously left in RECEIVED', async () => {
    const authUser = { id: userId, role: 'CUSTOMER' as const };
    const created = await service.createWalletTopUp(authUser, 5000, `topup-${suffix}-recovery`);
    ok(created.paymentAttemptId, 'This payment scenario must create a payment attempt');
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: created.paymentAttemptId },
    });
    const providerEventId = `simulated:recovery:${suffix}`;
    await prisma.paymentProviderEvent.create({
      data: {
        paymentAttemptId: attempt.id,
        provider: 'simulated',
        providerEventId,
        type: 'WALLET_TOP_UP_APPROVED',
        status: 'RECEIVED',
      },
    });

    await service.processPaymentEvent({
      provider: 'simulated',
      providerEventId,
      externalPaymentId: attempt.externalPaymentId!,
      outcome: 'APPROVED',
    });

    const [topUp, providerEvent, ledgerTransaction] = await Promise.all([
      prisma.walletTopUp.findUniqueOrThrow({ where: { id: created.topUpId } }),
      prisma.paymentProviderEvent.findUniqueOrThrow({
        where: { provider_providerEventId: { provider: 'simulated', providerEventId } },
      }),
      prisma.ledgerTransaction.findUniqueOrThrow({
        where: { reference: `WALLET_TOP_UP:${created.topUpId}` },
      }),
    ]);
    expect(topUp.status).toBe('APPROVED');
    expect(providerEvent.status).toBe('PROCESSED');
    expect(ledgerTransaction.type).toBe('TOP_UP');
  });
});
