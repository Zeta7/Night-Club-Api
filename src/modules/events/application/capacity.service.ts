import { Injectable, MessageEvent } from '@nestjs/common';
import { ClubWorkerStatus, Prisma, UserRole, WorkerPermission } from '@prisma/client';
import { distinctUntilChanged, from, interval, map, startWith, switchMap } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { conflict, forbidden, notFound } from '../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../identity/presentation/current-user';

@Injectable()
export class CapacityService {
  constructor(private readonly prisma: PrismaService) {}

  async get(user: AuthenticatedUser, clubId: string, eventId: string) {
    await this.assertPermission(user, clubId, eventId, WorkerPermission.VIEW_CAPACITY);
    const event = await this.prisma.event.findFirst({ where: { id: eventId, clubId }, include: { occupancy: true } });
    if (!event) throw notFound('EVENT_NOT_FOUND', 'No se encontró el evento.');
    return this.response(event.capacity, event.occupancy);
  }

  stream(user: AuthenticatedUser, clubId: string, eventId: string) {
    return interval(2000).pipe(
      startWith(0),
      switchMap(() => from(this.get(user, clubId, eventId))),
      distinctUntilChanged((left, right) => left.revision === right.revision),
      map((data): MessageEvent => ({ type: 'capacity.updated', data })),
    );
  }

  async configure(user: AuthenticatedUser, clubId: string, eventId: string, reentryAllowed: boolean) {
    await this.assertPermission(user, clubId, eventId, WorkerPermission.MANAGE_CAPACITY);
    const occupancy = await this.prisma.eventOccupancy.upsert({
      where: { eventId },
      create: { eventId, reentryAllowed },
      update: { reentryAllowed, revision: { increment: 1 } },
    });
    await this.audit(user.id, clubId, 'UPDATE_CAPACITY_SETTINGS', eventId, { reentryAllowed });
    const event = await this.prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    return this.response(event.capacity, occupancy);
  }

  async registerEntry(
    tx: Prisma.TransactionClient,
    input: { eventId: string; clubId: string; actorUserId: string; ticketId: string; workerShiftId?: string | null },
  ) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "EventOccupancy" ("id", "eventId", "currentCount", "reentryAllowed", "revision", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${input.eventId}, 0, false, 0, NOW(), NOW())
      ON CONFLICT ("eventId") DO NOTHING
    `);
    await tx.$queryRaw(Prisma.sql`SELECT 1 FROM "EventOccupancy" WHERE "eventId" = ${input.eventId} FOR UPDATE`);
    const [event, occupancy, duplicate] = await Promise.all([
      tx.event.findFirst({ where: { id: input.eventId, clubId: input.clubId }, select: { capacity: true } }),
      tx.eventOccupancy.findUniqueOrThrow({ where: { eventId: input.eventId } }),
      tx.capacityMovement.findFirst({ where: { eventId: input.eventId, ticketId: input.ticketId }, orderBy: { createdAt: 'desc' } }),
    ]);
    if (!event) throw notFound('EVENT_NOT_FOUND', 'No se encontró el evento.');
    if (duplicate?.type === 'ENTRY') throw conflict('TICKET_ALREADY_INSIDE', 'La entrada ya figura dentro del evento.');
    if (duplicate && !occupancy.reentryAllowed) throw conflict('EVENT_REENTRY_DISABLED', 'El evento no permite reingreso.');
    if (occupancy.currentCount >= event.capacity) throw conflict('EVENT_CAPACITY_REACHED', 'El evento alcanzó su aforo máximo.');
    const next = occupancy.currentCount + 1;
    await tx.eventOccupancy.update({ where: { eventId: input.eventId }, data: { currentCount: next, revision: { increment: 1 } } });
    await tx.capacityMovement.create({ data: { eventId: input.eventId, actorUserId: input.actorUserId, ticketId: input.ticketId, workerShiftId: input.workerShiftId, type: 'ENTRY', delta: 1, previousCount: occupancy.currentCount, newCount: next, idempotencyKey: `ticket-entry:${input.ticketId}:${(duplicate?.id ?? 'first')}` } });
  }

  async registerExit(user: AuthenticatedUser, clubId: string, eventId: string, ticketId?: string, idempotencyKey?: string) {
    await this.assertPermission(user, clubId, eventId, WorkerPermission.MANAGE_CAPACITY);
    return this.prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.capacityMovement.findUnique({ where: { idempotencyKey } });
        if (existing) return this.get(user, clubId, eventId);
      }
      await tx.eventOccupancy.upsert({ where: { eventId }, create: { eventId }, update: {} });
      await tx.$queryRaw(Prisma.sql`SELECT 1 FROM "EventOccupancy" WHERE "eventId" = ${eventId} FOR UPDATE`);
      const occupancy = await tx.eventOccupancy.findUniqueOrThrow({ where: { eventId } });
      if (occupancy.currentCount <= 0) throw conflict('CAPACITY_ALREADY_EMPTY', 'El aforo ya está en cero.');
      if (ticketId) {
        const latest = await tx.capacityMovement.findFirst({ where: { eventId, ticketId }, orderBy: { createdAt: 'desc' } });
        if (!latest || latest.type !== 'ENTRY') throw conflict('TICKET_NOT_INSIDE', 'La entrada no figura dentro del evento.');
      }
      const next = occupancy.currentCount - 1;
      await tx.eventOccupancy.update({ where: { eventId }, data: { currentCount: next, revision: { increment: 1 } } });
      const movement = await tx.capacityMovement.create({ data: { eventId, actorUserId: user.id, ticketId, type: 'EXIT', delta: -1, previousCount: occupancy.currentCount, newCount: next, idempotencyKey } });
      if (ticketId && occupancy.reentryAllowed) await tx.ticket.updateMany({ where: { id: ticketId, eventId, status: 'USED' }, data: { status: 'AVAILABLE' } });
      await tx.auditLogEntry.create({ data: { actorUserId: user.id, clubId, action: 'REGISTER_CAPACITY_EXIT', resourceType: 'EVENT', resourceId: eventId, metadata: { movementId: movement.id, ticketId: ticketId ?? null } } });
      return this.response((await tx.event.findUniqueOrThrow({ where: { id: eventId } })).capacity, { ...occupancy, currentCount: next, revision: occupancy.revision + 1 });
    });
  }

  async correct(user: AuthenticatedUser, clubId: string, eventId: string, targetCount: number, reason: string, idempotencyKey?: string) {
    await this.assertPermission(user, clubId, eventId, WorkerPermission.MANAGE_CAPACITY);
    return this.prisma.$transaction(async (tx) => {
      await tx.eventOccupancy.upsert({ where: { eventId }, create: { eventId }, update: {} });
      await tx.$queryRaw(Prisma.sql`SELECT 1 FROM "EventOccupancy" WHERE "eventId" = ${eventId} FOR UPDATE`);
      const [event, occupancy] = await Promise.all([tx.event.findFirst({ where: { id: eventId, clubId } }), tx.eventOccupancy.findUniqueOrThrow({ where: { eventId } })]);
      if (!event) throw notFound('EVENT_NOT_FOUND', 'No se encontró el evento.');
      if (targetCount > event.capacity) throw conflict('CAPACITY_TARGET_EXCEEDS_LIMIT', 'La corrección supera el aforo máximo.');
      if (idempotencyKey) {
        const existing = await tx.capacityMovement.findUnique({ where: { idempotencyKey } });
        if (existing) return this.response(event.capacity, occupancy);
      }
      const movement = await tx.capacityMovement.create({ data: { eventId, actorUserId: user.id, type: 'CORRECTION', delta: targetCount - occupancy.currentCount, previousCount: occupancy.currentCount, newCount: targetCount, reason: reason.trim(), idempotencyKey } });
      const updated = await tx.eventOccupancy.update({ where: { eventId }, data: { currentCount: targetCount, revision: { increment: 1 } } });
      await tx.auditLogEntry.create({ data: { actorUserId: user.id, clubId, action: 'CORRECT_CAPACITY', resourceType: 'EVENT', resourceId: eventId, metadata: { movementId: movement.id, reason: reason.trim(), previousCount: occupancy.currentCount, targetCount } } });
      return this.response(event.capacity, updated);
    });
  }

  async history(user: AuthenticatedUser, clubId: string, eventId: string) {
    await this.assertPermission(user, clubId, eventId, WorkerPermission.VIEW_CAPACITY);
    return { items: await this.prisma.capacityMovement.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' }, take: 500 }) };
  }

  private response(capacity: number, occupancy: { currentCount: number; reentryAllowed: boolean; revision: number; updatedAt: Date } | null) {
    const current = occupancy?.currentCount ?? 0;
    return { current, capacity, available: Math.max(0, capacity - current), full: current >= capacity, reentryAllowed: occupancy?.reentryAllowed ?? false, revision: occupancy?.revision ?? 0, updatedAt: occupancy?.updatedAt ?? null };
  }

  private async assertPermission(user: AuthenticatedUser, clubId: string, eventId: string, permission: WorkerPermission) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, clubId }, select: { id: true } });
    if (!event) throw notFound('EVENT_NOT_FOUND', 'No se encontró el evento.');
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (await this.prisma.clubAdmin.findUnique({ where: { clubId_userId: { clubId, userId: user.id } } })) return;
    const worker = await this.prisma.clubWorker.findFirst({ where: { clubId, userId: user.id, status: ClubWorkerStatus.ACTIVE, permissions: { has: permission } } });
    if (!worker) throw forbidden('CAPACITY_PERMISSION_REQUIRED', 'No tienes permiso para operar el aforo.');
  }

  private audit(actorUserId: string, clubId: string, action: string, eventId: string, metadata: Prisma.InputJsonValue) {
    return this.prisma.auditLogEntry.create({ data: { actorUserId, clubId, action, resourceType: 'EVENT', resourceId: eventId, metadata } });
  }
}
