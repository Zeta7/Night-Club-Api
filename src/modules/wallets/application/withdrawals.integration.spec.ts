/// <reference types="jest" />
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { LedgerService } from './ledger.service';
import { WithdrawalsService } from './withdrawals.service';

jest.setTimeout(180_000);

describe('Module 6 - business withdrawals', () => {
  process.env.WITHDRAWAL_MIN_CENTS = '5000';
  process.env.FINANCIAL_DATA_ENCRYPTION_KEY = 'module-6-test-encryption-secret';

  const config = new ConfigService();
  const prisma = new PrismaService(config);
  const ledger = new LedgerService(prisma, config);
  const notifications = { notifyFromTemplate: jest.fn(async () => ({})) };
  const service = new WithdrawalsService(prisma, config, ledger, notifications as any);
  const suffix = randomUUID().slice(0, 8);
  let adminId: string;
  let otherUserId: string;
  let superAdminId: string;
  let clubId: string;

  const admin = () => ({ id: adminId, role: UserRole.ADMIN });
  const customer = () => ({ id: otherUserId, role: UserRole.CUSTOMER });
  const superAdmin = () => ({ id: superAdminId, role: UserRole.SUPER_ADMIN });

  beforeAll(async () => {
    await prisma.$connect();
    const stamp = Date.now().toString().slice(-7);
    const [adminUser, otherUser, platformUser] = await Promise.all([
      prisma.user.create({ data: { phoneCountryCode: '+51', phoneNumber: `94${stamp}`, passwordHash: 'test', fullName: `Withdrawal Admin ${suffix}`, status: 'ACTIVE', role: 'ADMIN' } }),
      prisma.user.create({ data: { phoneCountryCode: '+51', phoneNumber: `95${stamp}`, passwordHash: 'test', fullName: `Withdrawal Customer ${suffix}`, status: 'ACTIVE' } }),
      prisma.user.create({ data: { phoneCountryCode: '+51', phoneNumber: `96${stamp}`, passwordHash: 'test', fullName: `Withdrawal Super ${suffix}`, status: 'ACTIVE', role: 'SUPER_ADMIN' } }),
    ]);
    adminId = adminUser.id;
    otherUserId = otherUser.id;
    superAdminId = platformUser.id;
    const club = await prisma.club.create({ data: { name: `Withdrawal Club ${suffix}`, status: 'ACTIVE' } });
    clubId = club.id;
    await prisma.clubAdmin.create({ data: { clubId, userId: adminId } });
    await (prisma as any).financialAccount.create({
      data: { code: `CLUB:${clubId}`, ownerType: 'CLUB', clubId, currency: 'PEN', availableCents: 100_000 },
    });
  });

  beforeEach(async () => {
    notifications.notifyFromTemplate.mockClear();
    await clearWithdrawalData();
    await (prisma as any).financialAccount.update({
      where: { code: `CLUB:${clubId}` },
      data: { pendingCents: 0, availableCents: 100_000, heldCents: 0, withdrawnCents: 0 },
    });
  });

  afterAll(async () => {
    await clearWithdrawalData();
    await (prisma as any).clubFinancialProfile.deleteMany({ where: { clubId } });
    await (prisma as any).financialAccount.deleteMany({ where: { clubId } });
    await prisma.auditLogEntry.deleteMany({ where: { clubId } });
    await prisma.clubAdmin.deleteMany({ where: { clubId } });
    await prisma.club.delete({ where: { id: clubId } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, otherUserId, superAdminId] } } });
    await prisma.$disconnect();
  });

  async function clearWithdrawalData() {
    const requests = await (prisma as any).withdrawalRequest.findMany({ where: { clubId }, select: { id: true } });
    const ids = requests.map((item: any) => item.id);
    const transactions = await (prisma as any).ledgerTransaction.findMany({ where: { withdrawalRequestId: { in: ids } }, select: { id: true } });
    await (prisma as any).ledgerEntry.deleteMany({ where: { transactionId: { in: transactions.map((item: any) => item.id) } } });
    await (prisma as any).ledgerTransaction.deleteMany({ where: { id: { in: transactions.map((item: any) => item.id) } } });
    await prisma.auditLogEntry.deleteMany({ where: { clubId, resourceType: { in: ['WITHDRAWAL', 'CLUB_FINANCIAL_PROFILE'] } } });
    await (prisma as any).withdrawalRequest.deleteMany({ where: { id: { in: ids } } });
  }

  async function profile() {
    return service.upsertProfile(admin(), clubId, {
      legalName: 'Beerry Test SAC', taxDocumentType: 'RUC', taxDocumentNumber: '20123456789',
      bankName: 'Banco Test', bankAccountType: 'CORRIENTE', bankAccountNumber: '00112345678901234567',
      bankAccountHolder: 'Beerry Test SAC',
    });
  }

  it('encrypts bank data and enforces permissions and the minimum amount', async () => {
    await expect(service.upsertProfile(customer(), clubId, {
      legalName: 'No permitido', taxDocumentType: 'RUC', taxDocumentNumber: '20123456789',
      bankName: 'Banco', bankAccountType: 'CORRIENTE', bankAccountNumber: '00112345678901234567', bankAccountHolder: 'No permitido',
    })).rejects.toBeDefined();
    const publicProfile = await profile();
    const stored = await (prisma as any).clubFinancialProfile.findUniqueOrThrow({ where: { clubId } });
    expect(stored.bankAccountEncrypted).not.toContain('00112345678901234567');
    expect(publicProfile.maskedBankAccount).toBe('•••• 4567');
    await expect(service.request(admin(), clubId, { amountCents: 4999 })).rejects.toBeDefined();
  });

  it('atomically holds funds and prevents concurrent over-withdrawal', async () => {
    await profile();
    const results = await Promise.allSettled([
      service.request(admin(), clubId, { amountCents: 70_000 }),
      service.request(admin(), clubId, { amountCents: 70_000 }),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1);
    const account = await (prisma as any).financialAccount.findUniqueOrThrow({ where: { code: `CLUB:${clubId}` } });
    expect(account.availableCents).toBe(30_000);
    expect(account.heldCents).toBe(70_000);
    expect(await (prisma as any).withdrawalRequest.count({ where: { clubId } })).toBe(1);
  });

  it('a Super Admin rejection releases the held balance and records audit/notification', async () => {
    await profile();
    const request = await service.request(admin(), clubId, { amountCents: 25_000 });
    await expect(service.review(admin(), request.id, 'APPROVE')).rejects.toBeDefined();
    const rejected = await service.review(superAdmin(), request.id, 'REJECT', 'Datos bancarios por confirmar');
    const account = await (prisma as any).financialAccount.findUniqueOrThrow({ where: { code: `CLUB:${clubId}` } });
    expect(rejected.status).toBe('REJECTED');
    expect(account.availableCents).toBe(100_000);
    expect(account.heldCents).toBe(0);
    expect(await prisma.auditLogEntry.count({ where: { resourceId: request.id, action: 'WITHDRAWAL_REJECTED' } })).toBe(1);
    expect(notifications.notifyFromTemplate).toHaveBeenCalledWith(adminId, 'WITHDRAWAL_REJECTED', expect.anything(), expect.anything());
  });

  it('completes the approved-processing-paid flow and moves held funds to withdrawn', async () => {
    await profile();
    const request = await service.request(admin(), clubId, { amountCents: 40_000 });
    await service.review(superAdmin(), request.id, 'APPROVE');
    await service.markProcessing(superAdmin(), request.id);
    const paid = await service.markPaid(superAdmin(), request.id, 'SIM-TRANSFER-001', 'https://example.test/proof.pdf');
    const account = await (prisma as any).financialAccount.findUniqueOrThrow({ where: { code: `CLUB:${clubId}` } });
    expect(paid.status).toBe('PAID');
    expect(paid.paymentReference).toBe('SIM-TRANSFER-001');
    expect(account.availableCents).toBe(60_000);
    expect(account.heldCents).toBe(0);
    expect(account.withdrawnCents).toBe(40_000);
    expect(await (prisma as any).ledgerTransaction.count({ where: { withdrawalRequestId: request.id } })).toBe(2);
    expect(notifications.notifyFromTemplate).toHaveBeenCalledWith(adminId, 'WITHDRAWAL_PAID', expect.anything(), expect.anything());
  });

  it('releases held funds when processing fails', async () => {
    await profile();
    const request = await service.request(admin(), clubId, { amountCents: 30_000 });
    await service.review(superAdmin(), request.id, 'APPROVE');
    await service.markProcessing(superAdmin(), request.id);
    const failed = await service.markFailed(superAdmin(), request.id, 'Proveedor bancario no disponible');
    const account = await (prisma as any).financialAccount.findUniqueOrThrow({ where: { code: `CLUB:${clubId}` } });
    expect(failed.status).toBe('FAILED');
    expect(account.availableCents).toBe(100_000);
    expect(account.heldCents).toBe(0);
  });
});
