/// <reference types="jest" />
import 'dotenv/config';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { CommerceItemType, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { UploadsService } from '../../uploads/application/uploads.service';
import { CommerceService } from '../../commerce/application/commerce.service';
import { SimulatedPaymentGateway } from '../../commerce/infrastructure/simulated-payment.gateway';
import { WalletsController } from '../presentation/wallets.controller';
import { LedgerService } from './ledger.service';

jest.setTimeout(180_000);

describe('Module 5 - double-entry ledger', () => {
  process.env.PLATFORM_COMMISSION_BPS = '1000';
  process.env.PAYMENT_PROVIDER_COST_BPS = '200';

  const config = new ConfigService();
  const prisma = new PrismaService(config);
  const gateway = new SimulatedPaymentGateway();
  const ledger = new LedgerService(prisma, config);
  const uploads = { createReadableImageUrl: jest.fn(async () => null) } as unknown as UploadsService;
  const commerce = new CommerceService(prisma, config, uploads, gateway, undefined, ledger);
  const suffix = randomUUID().slice(0, 8);
  let customerId: string;
  let clubId: string;
  let ticketTypeId: string;

  const customer = () => ({ id: customerId, role: UserRole.CUSTOMER });

  beforeAll(async () => {
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        phoneCountryCode: '+51', phoneNumber: `93${Date.now().toString().slice(-7)}`,
        passwordHash: 'test', fullName: `Ledger Customer ${suffix}`, status: 'ACTIVE',
      },
    });
    customerId = user.id;
    const club = await prisma.club.create({ data: { name: `Ledger Club ${suffix}`, status: 'ACTIVE' } });
    clubId = club.id;
    const ticketType = await prisma.ticketType.create({
      data: { clubId, name: `Ledger Entry ${suffix}`, priceCents: 10_000, quantityTotal: 20, status: 'ACTIVE' },
    });
    ticketTypeId = ticketType.id;
  });

  afterAll(async () => {
    const transactions = await (prisma as any).ledgerTransaction.findMany({
      where: { order: { userId: customerId } }, select: { id: true },
    });
    await (prisma as any).ledgerEntry.deleteMany({ where: { transactionId: { in: transactions.map((item: any) => item.id) } } });
    await (prisma as any).ledgerTransaction.deleteMany({ where: { id: { in: transactions.map((item: any) => item.id) } } });
    await (prisma as any).financialAccount.deleteMany({
      // PLATFORM and PROVIDER accounts are shared infrastructure and may contain
      // entries created by another integration suite. Only remove owned fixtures.
      where: { OR: [{ userId: customerId }, { clubId }] },
    });
    await prisma.qrValidationAttempt.deleteMany({ where: { clubId } });
    await prisma.auditLogEntry.deleteMany({ where: { clubId } });
    await prisma.ticket.deleteMany({ where: { ownerUserId: customerId } });
    await prisma.order.deleteMany({ where: { userId: customerId } });
    await prisma.cart.deleteMany({ where: { userId: customerId } });
    await prisma.wallet.deleteMany({ where: { userId: customerId } });
    await prisma.ticketType.deleteMany({ where: { id: ticketTypeId } });
    await prisma.club.delete({ where: { id: clubId } });
    await prisma.user.delete({ where: { id: customerId } });
    await prisma.$disconnect();
  });

  async function paidOrder() {
    await commerce.addCartItem(customer(), { id: ticketTypeId, type: CommerceItemType.TICKET, quantity: 1 });
    const checkout = await commerce.checkout(customer(), { expectedTotalCents: 10_000 });
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: checkout.paymentAttemptId } });
    const approved = gateway.createSimulatedEvent(attempt.externalPaymentId!, 'APPROVED');
    await commerce.processPaymentEvent(approved);
    return { checkout, attempt, approved };
  }

  it('balances debits and credits for every sale', async () => {
    const { attempt } = await paidOrder();
    const transaction = await (prisma as any).ledgerTransaction.findUniqueOrThrow({
      where: { reference: `SALE:${attempt.id}` }, include: { entries: true },
    });
    const debits = transaction.entries.filter((entry: any) => entry.direction === 'DEBIT').reduce((sum: number, entry: any) => sum + entry.amountCents, 0);
    const credits = transaction.entries.filter((entry: any) => entry.direction === 'CREDIT').reduce((sum: number, entry: any) => sum + entry.amountCents, 0);
    expect(debits).toBe(credits);
    expect(transaction.debitTotalCents).toBe(transaction.creditTotalCents);
    expect((await ledger.reconcileOrder(transaction.orderId)).balanced).toBe(true);
  });

  it('does not duplicate ledger movements when a payment event is repeated', async () => {
    const { attempt, approved } = await paidOrder();
    await commerce.processPaymentEvent(approved);
    expect(await (prisma as any).ledgerTransaction.count({ where: { reference: `SALE:${attempt.id}` } })).toBe(1);
  });

  it('a refund creates the exact reverse entries and restores account balances', async () => {
    const { checkout, attempt } = await paidOrder();
    const refund = gateway.createSimulatedEvent(attempt.externalPaymentId!, 'REFUNDED');
    await commerce.processPaymentEvent(refund);
    const [sale, reversal, order, ticket] = await Promise.all([
      (prisma as any).ledgerTransaction.findUniqueOrThrow({ where: { reference: `SALE:${attempt.id}` }, include: { entries: true } }),
      (prisma as any).ledgerTransaction.findUniqueOrThrow({ where: { reference: `REFUND:${attempt.id}` }, include: { entries: true } }),
      prisma.order.findUniqueOrThrow({ where: { id: checkout.orderId } }),
      prisma.ticket.findFirstOrThrow({ where: { orderId: checkout.orderId } }),
    ]);
    expect(reversal.reversalOfId).toBe(sale.id);
    expect(reversal.debitTotalCents).toBe(sale.creditTotalCents);
    expect(reversal.creditTotalCents).toBe(sale.debitTotalCents);
    for (const entry of sale.entries) {
      const reverse = reversal.entries.find((item: any) => item.accountId === entry.accountId && item.amountCents === entry.amountCents);
      expect(reverse.direction).not.toBe(entry.direction);
    }
    expect(order.status).toBe('REFUNDED');
    expect(ticket.status).toBe('CANCELLED');
    expect(ticket.revokedReason).toBe('PAYMENT_REFUNDED');
    expect((await ledger.reconcileOrder(checkout.orderId)).balanced).toBe(true);
  });

  it('exposes no endpoint that can directly edit a financial balance', () => {
    const methods = Object.getOwnPropertyNames(WalletsController.prototype)
      .filter((name) => name !== 'constructor')
      .map((name) => ({
        name,
        requestMethod: Reflect.getMetadata(METHOD_METADATA, WalletsController.prototype[name as keyof WalletsController]),
      }));
    const described = methods.map((item) => ({
      ...item,
      path: String(Reflect.getMetadata(PATH_METADATA, WalletsController.prototype[item.name as keyof WalletsController]) ?? ''),
    }));
    expect(described.some((item) => /balance|saldo/i.test(`${item.name}:${item.path}`))).toBe(false);
    const mutatingNames = described
      .filter((item) => item.requestMethod !== RequestMethod.GET)
      .map((item) => item.name)
      .sort();
    expect(mutatingNames).toEqual([
      'failWithdrawal', 'payWithdrawal', 'processWithdrawal', 'requestWithdrawal',
      'reviewWithdrawal', 'upsertFinancialProfile',
    ].sort());
  });
});
