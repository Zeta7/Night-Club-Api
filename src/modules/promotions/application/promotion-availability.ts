import { PromotionStatus } from '@prisma/client';
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
