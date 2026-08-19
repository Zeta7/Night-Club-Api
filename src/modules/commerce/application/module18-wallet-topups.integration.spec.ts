/// <reference types="jest" />
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { UploadsService } from '../../uploads/application/uploads.service';
import { SimulatedPaymentGateway } from '../infrastructure/simulated-payment.gateway';
import { CommerceService } from './commerce.service';

jest.setTimeout(60_000);

describe('Module 18 - wallet top-ups', () => {
  const config = new ConfigService();
  const prisma = new PrismaService(config);
  const gateway = new SimulatedPaymentGateway();
  const service = new CommerceService(prisma, config, {} as UploadsService, gateway);
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

    const [wallet, movements, lots, rewards] = await Promise.all([
      prisma.wallet.findUniqueOrThrow({ where: { userId } }),
      prisma.walletMovement.findMany({ where: { referenceId: created.topUpId, type: 'TOP_UP' } }),
      prisma.walletCreditLot.findMany({
        where: { sourceReferenceId: created.topUpId, source: 'TOP_UP' },
      }),
      prisma.referralReward.count({ where: { buyerUserId: userId } }),
    ]);
    expect(wallet.balanceCents).toBe(2500);
    expect(movements).toHaveLength(1);
    expect(lots).toHaveLength(1);
    expect(rewards).toBe(0);
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
});
