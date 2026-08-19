import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';

type Tx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async postSale(
    tx: Tx,
    input: {
      orderId: string;
      paymentAttemptId: string;
      providerEventId: string;
      customerUserId: string;
      clubId: string;
      provider: string;
      amountCents: number;
      currency: string;
    },
  ) {
    const db = tx as any;
    const reference = `SALE:${input.paymentAttemptId}`;
    const existing = await db.ledgerTransaction.findUnique({ where: { reference } });
    if (existing) return existing;

    const commissionBps = await this.commissionBps(tx);
    const providerCostBps = this.numberConfig('PAYMENT_PROVIDER_COST_BPS', 0);
    const commissionCents = Math.round((input.amountCents * commissionBps) / 10_000);
    const providerCostCents = Math.round((input.amountCents * providerCostBps) / 10_000);
    const clubNetCents = input.amountCents - commissionCents;
    const [customer, club, platform, provider] = await Promise.all([
      this.account(tx, `CUSTOMER:${input.customerUserId}`, 'CUSTOMER', input.currency, {
        userId: input.customerUserId,
      }),
      this.account(tx, `CLUB:${input.clubId}`, 'CLUB', input.currency, { clubId: input.clubId }),
      this.account(tx, 'PLATFORM:MAIN', 'PLATFORM', input.currency),
      this.account(tx, `PROVIDER:${input.provider}`, 'PROVIDER', input.currency, {
        provider: input.provider,
      }),
    ]);
    const entries = [
      this.entry(customer.id, 'DEBIT', 'AVAILABLE', input.amountCents, 'Cobro al cliente'),
      this.entry(club.id, 'CREDIT', 'PENDING', clubNetCents, 'Venta neta pendiente del negocio'),
      this.entry(platform.id, 'CREDIT', 'AVAILABLE', commissionCents, 'Comisión de plataforma'),
      ...(providerCostCents > 0
        ? [
            this.entry(
              platform.id,
              'DEBIT',
              'AVAILABLE',
              providerCostCents,
              'Costo del proveedor de pago',
            ),
            this.entry(
              provider.id,
              'CREDIT',
              'AVAILABLE',
              providerCostCents,
              'Costo por procesamiento',
            ),
          ]
        : []),
    ];
    const debitTotalCents = entries
      .filter((item) => item.direction === 'DEBIT')
      .reduce((sum, item) => sum + item.amountCents, 0);
    const creditTotalCents = entries
      .filter((item) => item.direction === 'CREDIT')
      .reduce((sum, item) => sum + item.amountCents, 0);
    if (debitTotalCents !== creditTotalCents) throw new Error('LEDGER_UNBALANCED_SALE');

    const transaction = await db.ledgerTransaction.create({
      data: {
        reference,
        type: 'SALE',
        orderId: input.orderId,
        paymentAttemptId: input.paymentAttemptId,
        providerEventId: input.providerEventId,
        currency: input.currency,
        debitTotalCents,
        creditTotalCents,
        description: 'Venta confirmada',
        metadata: {
          commissionBps,
          commissionCents,
          providerCostBps,
          providerCostCents,
          clubNetCents,
        },
        entries: { create: entries },
      },
      include: { entries: true },
    });
    await Promise.all([
      db.financialAccount.update({
        where: { id: customer.id },
        data: { availableCents: { decrement: input.amountCents } },
      }),
      db.financialAccount.update({
        where: { id: club.id },
        data: { pendingCents: { increment: clubNetCents } },
      }),
      db.financialAccount.update({
        where: { id: platform.id },
        data: { availableCents: { increment: commissionCents - providerCostCents } },
      }),
      ...(providerCostCents > 0
        ? [
            db.financialAccount.update({
              where: { id: provider.id },
              data: { availableCents: { increment: providerCostCents } },
            }),
          ]
        : []),
    ]);
    return transaction;
  }

  async reverseSale(
    tx: Tx,
    input: { paymentAttemptId: string; providerEventId: string; type: 'REFUND' | 'CHARGEBACK' },
  ) {
    const db = tx as any;
    const reference = `${input.type}:${input.paymentAttemptId}`;
    const existing = await db.ledgerTransaction.findUnique({ where: { reference } });
    if (existing) return existing;
    const sale = await db.ledgerTransaction.findUnique({
      where: { reference: `SALE:${input.paymentAttemptId}` },
      include: { entries: true },
    });
    if (!sale) throw new Error('LEDGER_SALE_NOT_FOUND');
    const entries = sale.entries.map((entry: any) => ({
      accountId: entry.accountId,
      direction: entry.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT',
      bucket: entry.bucket,
      amountCents: entry.amountCents,
      description: `${input.type === 'REFUND' ? 'Reembolso' : 'Contracargo'}: ${entry.description}`,
    }));
    const transaction = await db.ledgerTransaction.create({
      data: {
        reference,
        type: input.type,
        orderId: sale.orderId,
        paymentAttemptId: input.paymentAttemptId,
        providerEventId: input.providerEventId,
        reversalOfId: sale.id,
        currency: sale.currency,
        debitTotalCents: sale.creditTotalCents,
        creditTotalCents: sale.debitTotalCents,
        description: input.type === 'REFUND' ? 'Reembolso total' : 'Contracargo total',
        entries: { create: entries },
      },
      include: { entries: true },
    });
    for (const original of sale.entries) {
      const delta = original.direction === 'CREDIT' ? -original.amountCents : original.amountCents;
      const field = this.bucketField(original.bucket);
      await db.financialAccount.update({
        where: { id: original.accountId },
        data: { [field]: delta >= 0 ? { increment: delta } : { decrement: Math.abs(delta) } },
      });
    }
    return transaction;
  }

  async postWalletTopUp(
    tx: Tx,
    input: {
      topUpId: string;
      paymentAttemptId: string;
      providerEventId: string;
      customerUserId: string;
      provider: string;
      amountCents: number;
      currency: string;
    },
  ) {
    const db = tx as any;
    const reference = `WALLET_TOP_UP:${input.topUpId}`;
    const existing = await db.ledgerTransaction.findUnique({ where: { reference } });
    if (existing) return existing;
    const [provider, customer] = await Promise.all([
      this.account(tx, `PROVIDER:${input.provider}`, 'PROVIDER', input.currency, {
        provider: input.provider,
      }),
      this.account(tx, `CUSTOMER:${input.customerUserId}`, 'CUSTOMER', input.currency, {
        userId: input.customerUserId,
      }),
    ]);
    const entries = [
      this.entry(
        provider.id,
        'DEBIT',
        'AVAILABLE',
        input.amountCents,
        'Fondos recibidos por recarga',
      ),
      this.entry(
        customer.id,
        'CREDIT',
        'AVAILABLE',
        input.amountCents,
        'Saldo recargado por el cliente',
      ),
    ];
    const transaction = await db.ledgerTransaction.create({
      data: {
        reference,
        type: 'TOP_UP',
        paymentAttemptId: input.paymentAttemptId,
        providerEventId: input.providerEventId,
        currency: input.currency,
        debitTotalCents: input.amountCents,
        creditTotalCents: input.amountCents,
        description: 'Recarga de billetera confirmada',
        metadata: { topUpId: input.topUpId, provider: input.provider },
        entries: { create: entries },
      },
      include: { entries: true },
    });
    await Promise.all([
      db.financialAccount.update({
        where: { id: provider.id },
        data: { availableCents: { decrement: input.amountCents } },
      }),
      db.financialAccount.update({
        where: { id: customer.id },
        data: { availableCents: { increment: input.amountCents } },
      }),
    ]);
    return transaction;
  }

  async reconcileOrder(orderId: string) {
    const transactions = await (this.prisma as any).ledgerTransaction.findMany({
      where: { orderId },
      include: { entries: { include: { account: true } } },
      orderBy: { postedAt: 'asc' },
    });
    const debitTotalCents = transactions.reduce(
      (sum: number, item: any) => sum + item.debitTotalCents,
      0,
    );
    const creditTotalCents = transactions.reduce(
      (sum: number, item: any) => sum + item.creditTotalCents,
      0,
    );
    return {
      orderId,
      balanced: debitTotalCents === creditTotalCents,
      debitTotalCents,
      creditTotalCents,
      differenceCents: debitTotalCents - creditTotalCents,
      transactions,
    };
  }

  async dailyDifferences(date = new Date()) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const rows = await (this.prisma as any).ledgerTransaction.findMany({
      where: { postedAt: { gte: start, lt: end } },
    });
    const debitTotalCents = rows.reduce((sum: number, item: any) => sum + item.debitTotalCents, 0);
    const creditTotalCents = rows.reduce(
      (sum: number, item: any) => sum + item.creditTotalCents,
      0,
    );
    return {
      date: start.toISOString().slice(0, 10),
      balanced: debitTotalCents === creditTotalCents,
      debitTotalCents,
      creditTotalCents,
      differenceCents: debitTotalCents - creditTotalCents,
      transactionCount: rows.length,
    };
  }

  async moveClubFunds(
    tx: Tx,
    input: {
      clubId: string;
      amountCents: number;
      from: 'PENDING' | 'AVAILABLE' | 'HELD';
      to: 'AVAILABLE' | 'HELD' | 'WITHDRAWN';
      reference: string;
      description: string;
      withdrawalRequestId?: string;
      type?: 'SETTLEMENT' | 'WITHDRAWAL' | 'ADJUSTMENT';
    },
  ) {
    const db = tx as any;
    const existing = await db.ledgerTransaction.findUnique({
      where: { reference: input.reference },
    });
    if (existing) return existing;
    const account = await db.financialAccount.findUnique({
      where: { code: `CLUB:${input.clubId}` },
    });
    if (!account) throw new Error('FINANCIAL_ACCOUNT_NOT_FOUND');
    const fromField = this.bucketField(input.from);
    const toField = this.bucketField(input.to);
    const claimed = await db.financialAccount.updateMany({
      where: { id: account.id, [fromField]: { gte: input.amountCents } },
      data: {
        [fromField]: { decrement: input.amountCents },
        [toField]: { increment: input.amountCents },
      },
    });
    if (claimed.count !== 1) throw new Error('INSUFFICIENT_FINANCIAL_BALANCE');
    return db.ledgerTransaction.create({
      data: {
        reference: input.reference,
        type: input.type ?? 'ADJUSTMENT',
        withdrawalRequestId: input.withdrawalRequestId,
        currency: account.currency,
        debitTotalCents: input.amountCents,
        creditTotalCents: input.amountCents,
        description: input.description,
        entries: {
          create: [
            this.entry(account.id, 'DEBIT', input.from, input.amountCents, input.description),
            this.entry(account.id, 'CREDIT', input.to, input.amountCents, input.description),
          ],
        },
      },
      include: { entries: true },
    });
  }

  private account(
    tx: Tx,
    code: string,
    ownerType: string,
    currency: string,
    extra: Record<string, unknown> = {},
  ) {
    return (tx as any).financialAccount.upsert({
      where: { code },
      update: {},
      create: { code, ownerType, currency, ...extra },
    });
  }

  private entry(
    accountId: string,
    direction: string,
    bucket: string,
    amountCents: number,
    description: string,
  ) {
    return { accountId, direction, bucket, amountCents, description };
  }

  private async commissionBps(tx: Tx) {
    const record = await (tx as any).platformSettings.findUnique({ where: { id: 'platform' } });
    if (record) {
      try {
        const percentage = Number(JSON.parse(record.settingsJson).commissionPercentage);
        if (Number.isFinite(percentage) && percentage >= 0 && percentage <= 100)
          return Math.round(percentage * 100);
      } catch {}
    }
    return this.numberConfig('PLATFORM_COMMISSION_BPS', 1000);
  }

  private numberConfig(key: string, fallback: number) {
    const value = Number(this.config.get<string>(key));
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback;
  }

  private bucketField(bucket: string) {
    return bucket === 'PENDING'
      ? 'pendingCents'
      : bucket === 'HELD'
        ? 'heldCents'
        : bucket === 'WITHDRAWN'
          ? 'withdrawnCents'
          : 'availableCents';
  }
}
