import { EventStatus, PromotionStatus } from '@prisma/client';
import { currentEventsWhere } from '../../events/application/event-availability';

export function currentPromotionsWhere(now = new Date()) {
  return {
    status: PromotionStatus.ACTIVE,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      { OR: [{ eventId: null }, { event: currentEventsWhere(now) }] },
    ],
  };
}

// Draft events can prepare offers; ended, cancelled and postponed events cannot.
export function promotionEventIsEligible(event: { status: EventStatus; endsAt: Date }, now = new Date()) {
  return [EventStatus.DRAFT, EventStatus.PUBLISHED, EventStatus.SALE_ACTIVE, EventStatus.IN_PROGRESS]
    .some((status) => status === event.status) && event.endsAt > now;
}

export function promotionCanChangeStatus(promotion: {
  status: PromotionStatus;
  endsAt: Date | null;
  event: { status: EventStatus; endsAt: Date } | null;
}, now = new Date()) {
  return (!promotion.endsAt || promotion.endsAt > now)
    && (!promotion.event || promotionEventIsEligible(promotion.event, now));
}
