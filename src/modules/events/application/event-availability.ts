import { EventStatus } from '@prisma/client';

type EventAvailability = { status: EventStatus; endsAt: Date };

export function eventAllowsSales(event: EventAvailability, now = new Date()): boolean {
  const allowed: EventStatus[] = [EventStatus.SALE_ACTIVE, EventStatus.IN_PROGRESS];
  return allowed.includes(event.status)
    && event.endsAt > now;
}

export function eventAllowsRedemption(event: EventAvailability, now = new Date()): boolean {
  const allowed: EventStatus[] = [EventStatus.PUBLISHED, EventStatus.SALE_ACTIVE, EventStatus.SOLD_OUT, EventStatus.IN_PROGRESS];
  return allowed.includes(event.status) && event.endsAt > now;
}
