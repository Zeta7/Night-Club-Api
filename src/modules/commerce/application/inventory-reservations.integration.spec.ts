/// <reference types="jest" />
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { CommerceItemType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { UploadsService } from '../../uploads/application/uploads.service';
import { SimulatedPaymentGateway } from '../infrastructure/simulated-payment.gateway';
import { CommerceService } from './commerce.service';
import { NotificationService } from '../../notification/application/notification.service';
import { SimulatedPushNotificationChannel } from '../../notification/infrastructure/simulated-push-notification.channel';

jest.setTimeout(180_000);

describe('Inventory reservations integration', () => {
  const config = new ConfigService();
  const prisma = new PrismaService(config);
  const gateway = new SimulatedPaymentGateway();
  const notifications = new NotificationService(
    prisma,
    { send: jest.fn(async () => undefined) },
    new SimulatedPushNotificationChannel(),
  );
  const service = new CommerceService(prisma, config, {} as UploadsService, gateway, notifications);
  const suffix = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const clubIds: string[] = [];
  const productIds: string[] = [];
  const ticketTypeIds: string[] = [];
  let userSequence = 0;

  beforeAll(async () => {
    await prisma.$connect();
    await notifications.onModuleInit();
  });

  afterAll(async () => {
    notifications.onModuleDestroy();
    await prisma.consumableRight.deleteMany({ where: { ownerUserId: { in: userIds } } });
    await prisma.ticket.deleteMany({ where: { ownerUserId: { in: userIds } } });
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.cart.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.wallet.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.ticketType.deleteMany({ where: { id: { in: ticketTypeIds } } });
    await prisma.clubAdmin.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.club.deleteMany({ where: { id: { in: clubIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function createUsers(count: number) {
    const users = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        prisma.user.create({
          data: {
            phoneCountryCode: '+51',
            phoneNumber: `7${Date.now().toString().slice(-7)}${(userSequence + index).toString().padStart(4, '0')}`,
            passwordHash: 'integration-test',
            fullName: `Concurrency ${suffix} ${index}`,
            status: 'ACTIVE',
          },
        }),
      ),
    );
    userSequence += count;
    userIds.push(...users.map((user) => user.id));
    return users.map((user) => ({ id: user.id, role: user.role }));
  }

  async function createProduct(stockQuantity: number) {
    const club = await prisma.club.create({ data: { name: `Inventory ${suffix}`, status: 'ACTIVE' } });
    clubIds.push(club.id);
    const product = await prisma.product.create({
      data: {
        clubId: club.id,
        name: `Limited ${suffix}`,
        priceCents: 1000,
        stockQuantity,
        status: 'ACTIVE',
      },
    });
    productIds.push(product.id);
    return product;
  }

  async function createTicketType(quantityTotal: number) {
    const club = await prisma.club.create({ data: { name: `Tickets ${suffix}`, status: 'ACTIVE' } });
    clubIds.push(club.id);
    const ticketType = await prisma.ticketType.create({
      data: {
        clubId: club.id,
        name: `Last ticket ${suffix}`,
        priceCents: 1500,
        quantityTotal,
        status: 'ACTIVE',
      },
    });
    ticketTypeIds.push(ticketType.id);
    return ticketType;
  }

  it('allows only one winner among 100 simultaneous checkouts for the last unit', async () => {
    const product = await createProduct(1);
    const users = await createUsers(100);
    await Promise.all(
      users.map((user) =>
        service.addCartItem(user, { id: product.id, type: CommerceItemType.PRODUCT, quantity: 1 }),
      ),
    );

    const results = await Promise.allSettled(
      users.map((user) => service.checkout(user, { expectedTotalCents: 1000 })),
    );
    const winners = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof service.checkout>>> =>
        result.status === 'fulfilled',
    );
    if (winners.length === 0) {
      const reasons = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .slice(0, 3)
        .map((result) => String(result.reason));
      throw new Error(`No checkout succeeded: ${reasons.join(' | ')}`);
    }
    expect(winners).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(99);

    const beforePayment = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    const activeReservations = await prisma.inventoryReservation.aggregate({
      where: { resourceType: 'PRODUCT', resourceId: product.id, status: 'ACTIVE' },
      _sum: { quantity: true },
    });
    expect(beforePayment.stockQuantity).toBe(1);
    expect(activeReservations._sum.quantity).toBe(1);

    const winner = winners[0].value;
    const [saleAdmin] = await createUsers(1);
    await prisma.clubAdmin.create({ data: { clubId: product.clubId, userId: saleAdmin.id } });
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: winner.paymentAttemptId },
    });
    const event = gateway.createSimulatedEvent(attempt.externalPaymentId!, 'APPROVED');
    await service.processPaymentEvent(event);
    await service.processPaymentEvent(event);

    const [afterPayment, confirmedReservations, rights] = await Promise.all([
      prisma.product.findUniqueOrThrow({ where: { id: product.id } }),
      prisma.inventoryReservation.count({
        where: { resourceType: 'PRODUCT', resourceId: product.id, status: 'CONFIRMED' },
      }),
      prisma.consumableRight.count({ where: { orderId: winner.orderId } }),
    ]);
    expect(afterPayment.stockQuantity).toBe(0);
    expect(confirmedReservations).toBe(1);
    expect(rights).toBe(1);
    const paidOrder = await prisma.order.findUniqueOrThrow({ where: { id: winner.orderId } });
    expect(await prisma.notification.count({ where: { userId: paidOrder.userId } })).toBe(2);
    const adminSaleNotification = await prisma.notification.findFirstOrThrow({
      where: { userId: saleAdmin.id, templateKey: 'ADMIN_NEW_SALE' },
    });
    expect(adminSaleNotification.title).toBe('Nueva venta: producto');
    expect(adminSaleNotification.body).toContain(`Limited ${suffix} x1`);
    expect(adminSaleNotification.deepLink).toBe('/admin/sales');
    expect(await prisma.notification.count({ where: { userId: saleAdmin.id, templateKey: 'ADMIN_NEW_SALE' } })).toBe(1);
  });

  it('expires an abandoned order and releases its reservation without changing stock', async () => {
    const product = await createProduct(2);
    const [user] = await createUsers(1);
    await service.addCartItem(user, { id: product.id, type: CommerceItemType.PRODUCT, quantity: 2 });
    const checkout = await service.checkout(user, { expectedTotalCents: 2000 });
    const past = new Date(Date.now() - 1000);
    await Promise.all([
      prisma.paymentAttempt.update({ where: { id: checkout.paymentAttemptId }, data: { expiresAt: past } }),
      prisma.inventoryReservation.updateMany({ where: { orderId: checkout.orderId }, data: { expiresAt: past } }),
    ]);

    await service.expirePendingOrders();

    const [order, storedProduct, reservation] = await Promise.all([
      prisma.order.findUniqueOrThrow({ where: { id: checkout.orderId } }),
      prisma.product.findUniqueOrThrow({ where: { id: product.id } }),
      prisma.inventoryReservation.findFirstOrThrow({ where: { orderId: checkout.orderId } }),
    ]);
    expect(order.status).toBe('EXPIRED');
    expect(reservation.status).toBe('EXPIRED');
    expect(storedProduct.stockQuantity).toBe(2);
    expect((await service.getCart(user)).items).toHaveLength(1);
  });

  it('produces a single winner when two users request the last ticket', async () => {
    const ticketType = await createTicketType(1);
    const users = await createUsers(2);
    await Promise.all(
      users.map((user) =>
        service.addCartItem(user, { id: ticketType.id, type: CommerceItemType.TICKET, quantity: 1 }),
      ),
    );

    const results = await Promise.allSettled(
      users.map((user) => service.checkout(user, { expectedTotalCents: 1500 })),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const reservations = await prisma.inventoryReservation.aggregate({
      where: { resourceType: 'TICKET', resourceId: ticketType.id, status: 'ACTIVE' },
      _sum: { quantity: true },
    });
    expect(reservations._sum.quantity).toBe(1);
    expect((await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } })).quantitySold).toBe(0);
  });
});
