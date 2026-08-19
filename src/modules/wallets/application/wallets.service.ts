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
