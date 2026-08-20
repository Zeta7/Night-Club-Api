/// <reference types="jest" />
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { AuditSeverity, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PlatformService } from '@modules/platform/application/platform.service';
import { AuditService } from '@modules/audit/application/audit.service';

jest.setTimeout(180_000);

describe('Module 12 - central audit and support', () => {
  const prisma = new PrismaService(new ConfigService());
  const service = new AuditService(prisma);
  const platform = new PlatformService(prisma, new ConfigService(), service);
  const suffix = randomUUID().slice(0, 8);
  let actorId: string;
  let targetId: string;
  let clubId: string;
  const actor = () => ({ id: actorId, role: UserRole.SUPER_ADMIN });

  beforeAll(async () => {
    await prisma.$connect();
    const stamp = Date.now().toString().slice(-7);
    const [superAdmin, target] = await Promise.all([
      prisma.user.create({
        data: {
          phoneCountryCode: '+51',
          phoneNumber: `61${stamp}`,
          passwordHash: 'test',
          fullName: `Audit Admin ${suffix}`,
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          phoneCountryCode: '+51',
          phoneNumber: `62${stamp}`,
          passwordHash: 'test',
          fullName: `Audit Target ${suffix}`,
          status: 'ACTIVE',
        },
      }),
    ]);
    actorId = superAdmin.id;
    targetId = target.id;
    clubId = (
      await prisma.club.create({ data: { name: `Audit Club ${suffix}`, status: 'ACTIVE' } })
    ).id;
  });

  afterAll(async () => {
    await prisma.auditLogEntry.deleteMany({
      where: { OR: [{ clubId }, { actorUserId: actorId }] },
    });
    await prisma.club.delete({ where: { id: clubId } });
    await prisma.user.deleteMany({ where: { id: { in: [actorId, targetId] } } });
    await prisma.$disconnect();
  });

  it('records actor, resource, IP, device, correlation and redacts secrets', async () => {
    const entry = await service.record({
      actorUserId: actorId,
      actorRole: UserRole.SUPER_ADMIN,
      clubId,
      action: 'SUPPORT_SENSITIVE_ACTION',
      resourceType: 'ORDER',
      resourceId: `order-${suffix}`,
      severity: AuditSeverity.WARNING,
      ipAddress: '203.0.113.10',
      deviceFingerprint: `android-${suffix}`,
      correlationId: `corr-${suffix}`,
      metadata: {
        reason: 'Support review',
        accessToken: 'must-not-be-stored',
        nested: { password: 'secret' },
      },
    });
    expect(entry).toMatchObject({
      actorUserId: actorId,
      clubId,
      severity: 'WARNING',
      ipAddress: '203.0.113.10',
      deviceFingerprint: `android-${suffix}`,
      correlationId: `corr-${suffix}`,
    });
    expect(entry.integrityHash).toHaveLength(64);
    expect(entry.metadata).toMatchObject({
      accessToken: '[REDACTED]',
      nested: { password: '[REDACTED]' },
    });
  });

  it('builds an ordered integrity chain and detects tampering', async () => {
    const second = await service.record({
      actorUserId: actorId,
      actorRole: UserRole.SUPER_ADMIN,
      clubId,
      action: 'SECOND_ACTION',
      resourceType: 'CLUB',
      resourceId: clubId,
      metadata: { safe: true },
    });
    const initialVerification = await service.verifyIntegrity(clubId);
    expect(initialVerification.valid).toBe(true);
    await prisma.auditLogEntry.update({
      where: { id: second.id },
      data: { metadata: { safe: false } },
    });
    const verification = await service.verifyIntegrity(clubId);
    expect(verification.valid).toBe(false);
    expect(verification.brokenEntryId).toBe(second.id);
  });

  it('supports filters and stable pagination for the support panel', async () => {
    const result = await service.search({
      clubId,
      action: 'SUPPORT',
      severity: AuditSeverity.WARNING,
      page: 1,
      pageSize: 10,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].resourceId).toBe(`order-${suffix}`);
    expect(result.pagination).toMatchObject({ page: 1, pageSize: 10, total: 1 });
  });

  it('defines and audits a bounded retention policy', async () => {
    const policy = await service.updatePolicy(actorId, UserRole.SUPER_ADMIN, 365);
    expect(policy.retentionDays).toBe(365);
    const stored = await prisma.auditLogEntry.findFirstOrThrow({
      where: { actorUserId: actorId, action: 'UPDATE_AUDIT_POLICY' },
      orderBy: { createdAt: 'desc' },
    });
    expect(stored.expiresAt).not.toBeNull();
  });

  it('audits sensitive Super Admin role changes', async () => {
    await platform.changeUserRole(actor(), targetId, { role: UserRole.WORKER });
    const entry = await prisma.auditLogEntry.findFirstOrThrow({
      where: { actorUserId: actorId, action: 'CHANGE_USER_ROLE', resourceId: targetId },
    });
    expect(entry.severity).toBe('CRITICAL');
    expect(entry.metadata).toMatchObject({ previousRole: 'CUSTOMER', newRole: 'WORKER' });
  });
});
