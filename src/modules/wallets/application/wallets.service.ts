import { Injectable } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { forbidden, notFound } from '../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { LedgerService } from './ledger.service';

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async orderDetail(user: AuthenticatedUser, id: string) {
    const order = await this.prisma.order.findFirst({ where: { id, userId: user.id },
      select: { id: true, status: true, currency: true, totalCents: true, paymentMethod: true, createdAt: true,
        club: { select: { name: true } }, items: { select: { id: true, itemId: true, nameSnapshot: true, quantity: true, unitPriceCents: true, totalCents: true, itemType: true,
          event: { select: { cancellation: { select: { id: true, replacementEventId: true, status: true, mode: true, replacementMappings: { select: { sourceItemId: true, itemType: true, targetName: true, reservedQuantity: true } } } } } },
          eventRefundRequests: { select: { status: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          eventRefundJobs: { select: { status: true, amountCents: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        } } } });
    if (!order) throw notFound('ORDER_NOT_FOUND', 'No encontramos tu compra.');
    const cancellations = await this.prisma.eventCancellation.findMany({ where: {
      event: { OR: [{ purchasedItems: { some: { orderId: id } } }, { tickets: { some: { orderId: id } } }, { consumableRights: { some: { orderId: id } } }] },
    }, select: { status: true, replacementEventId: true, event: { select: { name: true } } } });
    const replacementIds = cancellations.map((item) => item.replacementEventId).filter((id): id is string => !!id);
    const replacements = replacementIds.length ? await this.prisma.event.findMany({ where: { id: { in: replacementIds } }, select: { id: true, name: true, status: true, startsAt: true, endsAt: true } }) : [];
    const postponedEvents = await this.prisma.event.findMany({ where: {
      status: 'POSTPONED', OR: [{ purchasedItems: { some: { orderId: id } } }, { tickets: { some: { orderId: id } } }, { consumableRights: { some: { orderId: id } } }],
    }, select: { name: true } });
    return { id: order.id, title: 'Detalle de compra', status: order.status, currency: order.currency,
      amountCents: order.totalCents, createdAt: order.createdAt, paymentMethod: order.paymentMethod,
      business: order.club.name, items: order.items.map(({ event, eventRefundRequests, eventRefundJobs, itemId, ...item }) => ({
        ...item,
        replacementRefundStatus: eventRefundRequests?.[0]?.status ?? null,
        refundExecution: eventRefundJobs?.[0] ?? null,
        replacementOffer: order.status === 'PAID' && !eventRefundRequests?.length && event?.cancellation?.status === 'REPLACEMENT_PROPOSED'
          ? (() => { const cancellation = event.cancellation!; const target = replacements.find((target) => target.id === cancellation.replacementEventId && target.startsAt > new Date() && ['PUBLISHED','SALE_ACTIVE','SOLD_OUT'].includes(target.status)); const mapping = cancellation.replacementMappings?.find((mapping) => mapping.sourceItemId === itemId && mapping.itemType === item.itemType && mapping.reservedQuantity >= item.quantity); return mapping && target ? { cancellationId: cancellation.id, targetName: mapping.targetName, eventName: target.name, startsAt: target.startsAt, endsAt: target.endsAt } : null; })() : null,
        canRequestReplacementRefund: order.status === 'PAID' && !eventRefundRequests?.length &&
          event?.cancellation?.mode === 'REPLACEMENT' && event.cancellation.status === 'REPLACEMENT_PROPOSED',
      })),
      eventNotices: [...postponedEvents.map((event) => ({ eventName: event.name,
        message: 'Evento postergado. Tu compra se conserva; los canjes están suspendidos hasta confirmar una nueva fecha.' })), ...cancellations.map((cancellation) => ({
        eventName: cancellation.event.name,
        replacement: replacements.find((event) => event.id === cancellation.replacementEventId) ?? null,
        message: cancellation.status === 'REPLACEMENT_PROPOSED'
          ? 'Evento cancelado. El negocio propone un reemplazo; tus QR anteriores ya no son válidos. Tu compra está pendiente de resolución.'
          : cancellation.status === 'AUTHORIZED'
          ? 'Evento cancelado. Beerry autorizó la evaluación y el procesamiento de las devoluciones aplicables; esto no confirma que el dinero haya sido devuelto.'
          : 'Evento cancelado. Tu compra está en revisión. Aún no hay una devolución confirmada.',
      }))],
    };
  }

  async topUpDetail(user: AuthenticatedUser, id: string) {
    const topUp = await this.prisma.walletTopUp.findFirst({ where: { id, userId: user.id },
      select: { id: true, status: true, currency: true, amountCents: true, createdAt: true, approvedAt: true } });
    if (!topUp) throw notFound('WALLET_TOP_UP_NOT_FOUND', 'No encontramos tu recarga.');
    return { ...topUp, title: 'Detalle de recarga', paymentMethod: 'MERCADO_PAGO', items: [] };
  }

  async movementDetail(user: AuthenticatedUser, id: string) {
    const movement = await this.prisma.walletMovement.findFirst({ where: { id, wallet: { userId: user.id } },
      select: { id: true, type: true, status: true, amountCents: true, description: true, referenceId: true, createdAt: true, completedAt: true, wallet: { select: { currency: true } } } });
    if (!movement) throw notFound('MOVEMENT_NOT_FOUND', 'No encontramos tu movimiento.');
    let related: unknown = null;
    if (movement.referenceId && ['PURCHASE', 'REFUND'].includes(movement.type)) {
      const order = await this.prisma.order.findFirst({ where: { id: movement.referenceId, userId: user.id }, select: { id: true } });
      if (order) related = await this.orderDetail(user, order.id);
    } else if (movement.referenceId && movement.type === 'TOP_UP') {
      const topUp = await this.prisma.walletTopUp.findFirst({ where: { id: movement.referenceId, userId: user.id }, select: { id: true } });
      if (topUp) related = await this.topUpDetail(user, topUp.id);
    }
    return { id: movement.id, title: 'Detalle del movimiento', status: movement.status, type: movement.type,
      amountCents: movement.amountCents, description: movement.description, createdAt: movement.createdAt,
      completedAt: movement.completedAt, currency: movement.wallet.currency, related };
  }

  async getMine(currentUser: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { id: true, phoneVerifiedAt: true, status: true },
    });

    if (!user || !user.phoneVerifiedAt || user.status !== UserStatus.ACTIVE) {
      throw notFound('ACTIVE_USER_NOT_FOUND', 'No encontramos una cuenta activa para esta billetera.');
    }

    const wallet = await this.prisma.wallet.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
      include: {
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        creditLots: {
          where: { remainingAmountCents: { gt: 0 }, status: { in: ['AVAILABLE', 'PARTIALLY_USED'] } },
          orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    const lastTopUp = wallet.movements.find(
      (movement) => movement.type === 'TOP_UP' && movement.status === 'COMPLETED',
    );

    return {
      id: wallet.id,
      currency: wallet.currency,
      balance: wallet.balanceCents / 100,
      totalSpent: wallet.totalSpentCents / 100,
      updatedAt: wallet.updatedAt,
      credit: {
        available: wallet.creditLots.reduce((sum, lot) => sum + lot.remainingAmountCents, 0) / 100,
        nextToExpire: wallet.creditLots.find((lot) => lot.expiresAt)
          ? {
              amount: wallet.creditLots.filter((lot) => lot.expiresAt?.getTime() === wallet.creditLots.find((item) => item.expiresAt)?.expiresAt?.getTime()).reduce((sum, lot) => sum + lot.remainingAmountCents, 0) / 100,
              expiresAt: wallet.creditLots.find((lot) => lot.expiresAt)!.expiresAt,
            }
          : null,
      },
      lastTopUp: lastTopUp
        ? {
            amount: Math.abs(lastTopUp.amountCents) / 100,
            createdAt: lastTopUp.completedAt ?? lastTopUp.createdAt,
          }
        : null,
      movements: wallet.movements.map((movement) => ({
        id: movement.id,
        type: movement.type,
        status: movement.status,
        amount: movement.amountCents / 100,
        description: movement.description,
        referenceId: movement.referenceId,
        createdAt: movement.createdAt,
        completedAt: movement.completedAt,
      })),
      stats: {
        purchases: wallet.movements.filter(
          (movement) => movement.type === 'PURCHASE' && movement.status === 'COMPLETED',
        ).length,
        activeQr: 0,
      },
    };
  }

  async getClubLedger(currentUser: AuthenticatedUser, clubId: string) {
    await this.assertClubFinanceAccess(currentUser, clubId);
    const account = await (this.prisma as any).financialAccount.findUnique({
      where: { code: `CLUB:${clubId}` },
      include: {
        entries: {
          include: { transaction: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });
    return {
      clubId,
      currency: account?.currency ?? 'PEN',
      balances: {
        pendingCents: account?.pendingCents ?? 0,
        availableCents: account?.availableCents ?? 0,
        heldCents: account?.heldCents ?? 0,
        withdrawnCents: account?.withdrawnCents ?? 0,
      },
      movements: account?.entries ?? [],
    };
  }

  async reconcileOrder(currentUser: AuthenticatedUser, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { clubId: true } });
    if (!order) throw notFound('ORDER_NOT_FOUND', 'No encontramos la orden.');
    await this.assertClubFinanceAccess(currentUser, order.clubId);
    return this.ledger.reconcileOrder(orderId);
  }

  async dailyDifferences(currentUser: AuthenticatedUser, date?: string) {
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      throw forbidden('PLATFORM_LEDGER_FORBIDDEN', 'Solo Super Admin puede consultar diferencias globales.');
    }
    return this.ledger.dailyDifferences(date ? new Date(`${date}T00:00:00`) : new Date());
  }

  private async assertClubFinanceAccess(currentUser: AuthenticatedUser, clubId: string) {
    if (currentUser.role === UserRole.SUPER_ADMIN) return;
    if (currentUser.role !== UserRole.ADMIN) {
      throw forbidden('CLUB_LEDGER_FORBIDDEN', 'No puedes consultar las finanzas de este negocio.');
    }
    const admin = await this.prisma.clubAdmin.findUnique({
      where: { clubId_userId: { clubId, userId: currentUser.id } },
      select: { id: true },
    });
    if (!admin) throw forbidden('CLUB_LEDGER_FORBIDDEN', 'No administras este negocio.');
  }
}
