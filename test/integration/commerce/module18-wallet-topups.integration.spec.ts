/// <reference types="jest" />
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { UploadsService } from '@modules/uploads/application/uploads.service';
import { SimulatedPaymentGateway } from '@modules/commerce/infrastructure/simulated-payment.gateway';
import { CommerceService } from '@modules/commerce/application/commerce.service';
import { LedgerService } from '@modules/wallets/application/ledger.service';

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
    expect(transactions[0].type).toBe('TOP_UP');
    expect(transactions[0].debitTotalCents).toBe(2500);
    expect(transactions[0].creditTotalCents).toBe(2500);
    expect(transactions[0].entries).toHaveLength(2);
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: created.paymentAttemptId },
    });
    await expect(
      service.getPaymentReturnContext(attempt.externalPaymentId!),
    ).resolves.toMatchObject({
      attemptId: created.paymentAttemptId,
      operationType: 'WALLET_TOP_UP',
      operationId: created.topUpId,
    });
  });

  it('does not change the wallet when Flow-equivalent confirmation is rejected', async () => {
    const authUser = { id: userId, role: 'CUSTOMER' as const };
    const before = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    const created = await service.createWalletTopUp(authUser, 3000, `topup-${suffix}-rejected`);

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
