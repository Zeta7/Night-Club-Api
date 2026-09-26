import { Prisma } from '@prisma/client';
import type { EventSnapshotDto } from '../presentation/orders.response.dto';

/** Historical purchases may only have a source; never invent their original dates. */
export function readEventSnapshot(value: Prisma.JsonValue): EventSnapshotDto | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    typeof value.source !== 'string'
  )
    return null;
  return {
    source: value.source,
    ...(typeof value.name === 'string' ? { name: value.name } : {}),
    ...(typeof value.startsAt === 'string' ? { startsAt: value.startsAt } : {}),
    ...(typeof value.endsAt === 'string' ? { endsAt: value.endsAt } : {}),
  };
}
