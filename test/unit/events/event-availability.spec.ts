/// <reference types="jest" />
import { EventStatus } from '@prisma/client';
import { eventAllowsSales, eventAllowsRedemption } from '../../../src/modules/events/application/event-availability';

describe('Event availability', () => {
  const now = new Date('2026-09-09T12:00:00Z');
  const endsAt = new Date('2026-09-10T12:00:00Z');
  it.each([EventStatus.DRAFT, EventStatus.PUBLISHED, EventStatus.POSTPONED, EventStatus.CANCELLED, EventStatus.FINISHED, EventStatus.SOLD_OUT])('blocks checkout for %s', (status) => {
    expect(eventAllowsSales({ status, endsAt }, now)).toBe(false);
  });
  it.each([EventStatus.SALE_ACTIVE, EventStatus.IN_PROGRESS])('allows active sales for %s', (status) => {
    expect(eventAllowsSales({ status, endsAt }, now)).toBe(true);
  });
  it.each([EventStatus.DRAFT, EventStatus.POSTPONED, EventStatus.CANCELLED, EventStatus.FINISHED])('blocks redemption for %s', (status) => {
    expect(eventAllowsRedemption({ status, endsAt }, now)).toBe(false);
  });
  it('allows sold-out ticket holders to enter, but not after the end time', () => {
    expect(eventAllowsRedemption({ status: EventStatus.SOLD_OUT, endsAt }, now)).toBe(true);
    expect(eventAllowsRedemption({ status: EventStatus.SOLD_OUT, endsAt: now }, now)).toBe(false);
    expect(eventAllowsSales({ status: EventStatus.SALE_ACTIVE, endsAt: now }, now)).toBe(false);
  });
});
