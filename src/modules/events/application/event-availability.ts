import { EventStatus } from '@prisma/client';

type EventAvailability = { status: EventStatus; endsAt: Date };

export const VISIBLE_EVENT_STATUSES: EventStatus[] = [
  EventStatus.PUBLISHED, EventStatus.SALE_ACTIVE, EventStatus.SOLD_OUT, EventStatus.IN_PROGRESS,
];

// A publication flag does not keep an event alive after its exclusive end time.
// Preserve draft, cancellation and postponement decisions in historical reads.
export function effectiveEventStatus(event: EventAvailability, now = new Date()): EventStatus {
  return VISIBLE_EVENT_STATUSES.includes(event.status) && event.endsAt <= now
    ? EventStatus.FINISHED
    : event.status;
}

export function currentEventsWhere(now = new Date()) {
  return { status: { in: VISIBLE_EVENT_STATUSES }, endsAt: { gt: now } };
}

export function eventCanActivateOffer(event: EventAvailability, now = new Date()): boolean {
  return event.status !== EventStatus.CANCELLED && event.status !== EventStatus.FINISHED
    && event.endsAt > now;
}

export function eventAllowsSales(event: EventAvailability, now = new Date()): boolean {
  const allowed: EventStatus[] = [EventStatus.SALE_ACTIVE, EventStatus.IN_PROGRESS];
  return allowed.includes(event.status)
    && event.endsAt > now;
}

export function eventAllowsRedemption(event: EventAvailability, now = new Date()): boolean {
  const allowed: EventStatus[] = [EventStatus.PUBLISHED, EventStatus.SALE_ACTIVE, EventStatus.SOLD_OUT, EventStatus.IN_PROGRESS];
  return allowed.includes(event.status) && event.endsAt > now;
}
