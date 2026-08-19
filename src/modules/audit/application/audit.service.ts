import { Injectable } from '@nestjs/common';
import { AuditSeverity, Prisma, UserRole } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { AuditQueryDto } from '../presentation/audit.dto';

type AuditWriter = Prisma.TransactionClient | PrismaService;

export type AuditRecordInput = {
  actorUserId: string;
  actorRole?: UserRole | string;
  clubId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  deviceFingerprint?: string | null;
  correlationId?: string | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditRecordInput, writer: AuditWriter = this.prisma) {
    const execute = async (tx: AuditWriter) => {
      const scope = input.clubId ?? 'platform';
      await (tx as Prisma.TransactionClient).$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${'audit:' + scope}))::text`);
      const previous = await tx.auditLogEntry.findFirst({
        where: input.clubId ? { clubId: input.clubId } : { clubId: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { integrityHash: true, createdAt: true },
      });
      const policy = await tx.auditPolicy.upsert({ where: { id: 'audit' }, create: {}, update: {} });
      const id = randomUUID();
      const now = new Date();
      const createdAt = previous?.createdAt && previous.createdAt >= now
        ? new Date(previous.createdAt.getTime() + 1)
        : now;
      const safeMetadata = this.sanitize(input.metadata ?? {});
      const created = await tx.auditLogEntry.create({
        data: {
          id,
          actorUserId: input.actorUserId,
          actorRoleSnapshot: input.actorRole?.toString(),
          clubId: input.clubId ?? null,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          severity: input.severity ?? AuditSeverity.INFO,
          metadata: safeMetadata as Prisma.InputJsonValue,
          ipAddress: input.ipAddress ?? null,
          deviceFingerprint: input.deviceFingerprint ?? null,
          correlationId: input.correlationId ?? null,
          previousHash: previous?.integrityHash ?? null,
          expiresAt: new Date(createdAt.getTime() + policy.retentionDays * 86_400_000),
          createdAt,
        },
      });
      const integrityHash = this.hash(this.integrityPayload(created, previous?.integrityHash ?? null));
      return tx.auditLogEntry.update({ where: { id }, data: { integrityHash } });
    };
    if ('$transaction' in writer) return (writer as PrismaService).$transaction((tx) => execute(tx));
    return execute(writer);
  }

  async search(query: AuditQueryDto) {
    const where: Prisma.AuditLogEntryWhereInput = {
      ...(query.clubId ? { clubId: query.clubId } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.action ? { action: { contains: query.action.trim(), mode: 'insensitive' } } : {}),
      ...(query.resourceType ? { resourceType: query.resourceType } : {}),
      ...(query.resourceId ? { resourceId: query.resourceId } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.correlationId ? { correlationId: query.correlationId } : {}),
      ...(query.from || query.to ? { createdAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLogEntry.findMany({ where, include: { actor: { select: { id: true, fullName: true, role: true } }, club: { select: { id: true, name: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.auditLogEntry.count({ where }),
    ]);
    return { items, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) } };
  }

  getPolicy() { return this.prisma.auditPolicy.upsert({ where: { id: 'audit' }, create: {}, update: {} }); }

  async updatePolicy(actorUserId: string, actorRole: string, retentionDays: number) {
    const policy = await this.prisma.auditPolicy.upsert({ where: { id: 'audit' }, create: { retentionDays, updatedByUserId: actorUserId }, update: { retentionDays, updatedByUserId: actorUserId } });
    await this.record({ actorUserId, actorRole, action: 'UPDATE_AUDIT_POLICY', resourceType: 'AUDIT_POLICY', resourceId: policy.id, severity: AuditSeverity.WARNING, metadata: { retentionDays } });
    return policy;
  }

  async verifyIntegrity(clubId?: string) {
    const items = await this.prisma.auditLogEntry.findMany({ where: clubId ? { clubId } : { clubId: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    let previousHash: string | null = null;
    let checked = 0;
    let legacyUnchecked = 0;
    for (const item of items) {
      // Entries created before Module 12 do not have an integrity hash. They are
      // retained for support searches, while the verifiable chain starts at the
      // first centrally recorded entry.
      if (!item.integrityHash && !item.previousHash && checked === 0) {
        legacyUnchecked += 1;
        continue;
      }
      const expected = this.hash(this.integrityPayload(item, previousHash));
      checked += 1;
      if (item.previousHash !== previousHash || item.integrityHash !== expected) return { valid: false, checked, legacyUnchecked, brokenEntryId: item.id };
      previousHash = item.integrityHash;
    }
    return { valid: true, checked, legacyUnchecked, brokenEntryId: null };
  }

  private hash(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

  private integrityPayload(item: {
    id: string; actorUserId: string; actorRoleSnapshot: string | null; clubId: string | null;
    action: string; resourceType: string; resourceId: string; severity: AuditSeverity;
    metadata: Prisma.JsonValue | null; ipAddress: string | null; deviceFingerprint: string | null;
    correlationId: string | null; createdAt: Date;
  }, previousHash: string | null) {
    return {
      id: item.id, actorUserId: item.actorUserId, actorRoleSnapshot: item.actorRoleSnapshot,
      clubId: item.clubId, action: item.action, resourceType: item.resourceType, resourceId: item.resourceId,
      severity: item.severity, metadata: item.metadata ?? {}, ipAddress: item.ipAddress,
      deviceFingerprint: item.deviceFingerprint, correlationId: item.correlationId,
      previousHash, createdAt: item.createdAt.toISOString(),
    };
  }

  private sanitize(value: unknown, depth = 0): unknown {
    if (depth > 5) return '[TRUNCATED]';
    if (Array.isArray(value)) return value.slice(0, 100).map((item) => this.sanitize(item, depth + 1));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, /password|token|secret|authorization|bankaccount|card|cvv/i.test(key) ? '[REDACTED]' : this.sanitize(item, depth + 1)]));
    if (typeof value === 'string') return value.slice(0, 2000);
    return value;
  }
}
