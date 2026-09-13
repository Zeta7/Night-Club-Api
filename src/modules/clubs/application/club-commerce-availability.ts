import { ClubStatus, Prisma, SellerConnectionStatus } from '@prisma/client';

/** Catalogue visibility and event publication require a live seller connection. */
export const paymentReadyClubWhere = (now = new Date()): Prisma.ClubWhereInput => ({
  status: ClubStatus.ACTIVE,
  sellerConnections: { some: {
    provider: 'mercado_pago', status: SellerConnectionStatus.CONNECTED,
    OR: [{ tokenExpiresAt: null }, { tokenExpiresAt: { gt: now } }],
  } },
});
