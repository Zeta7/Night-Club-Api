/// <reference types="jest" />
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { CommerceItemType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { UploadsService } from '@modules/uploads/application/uploads.service';
import { SimulatedPaymentGateway } from '@modules/commerce/infrastructure/simulated-payment.gateway';
import { CommerceService } from '@modules/commerce/application/commerce.service';

describe('CommerceService persistent cart integration', () => {
  const config = new ConfigService();
  const prisma = new PrismaService(config);
  const service = new CommerceService(
    prisma,
    config,
    {} as UploadsService,
    new SimulatedPaymentGateway(),
  );
  const suffix = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const clubIds: string[] = [];
  const productIds: string[] = [];
  const ticketTypeIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.cart.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.ticketType.deleteMany({ where: { id: { in: ticketTypeIds } } });
    await prisma.club.deleteMany({ where: { id: { in: clubIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function createUser(label: string) {
    const user = await prisma.user.create({
      data: {
        phoneCountryCode: '+51',
        phoneNumber: `9${Math.floor(Math.random() * 10000000)
          .toString()
          .padStart(8, '0')}`,
        passwordHash: 'integration-test',
        fullName: `${label} ${suffix}`,
        status: 'ACTIVE',
      },
    });
    userIds.push(user.id);
    return { id: user.id, role: user.role };
  }

  async function createProduct(label: string, status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE') {
    const club = await prisma.club.create({
      data: { name: `${label} ${suffix}`, status: 'ACTIVE' },
    });
    clubIds.push(club.id);
    const product = await prisma.product.create({
      data: {
        clubId: club.id,
        name: `Producto ${label}`,
        priceCents: 1290,
        stockQuantity: 10,
        status,
      },
    });
    productIds.push(product.id);
    return product;
  }

  async function createLimitedTicket(label: string) {
    const club = await prisma.club.create({
      data: { name: `${label} ${suffix}`, status: 'ACTIVE' },
    });
    clubIds.push(club.id);
    const ticket = await prisma.ticketType.create({
      data: {
        clubId: club.id,
        name: `Entrada ${label}`,
        priceCents: 2000,
        quantityTotal: 20,
        perUserLimit: 1,
      },
    });
    ticketTypeIds.push(ticket.id);
    return ticket;
  }

  it('persists live server pricing and quantity between service reads', async () => {
    const user = await createUser('Persistencia');
    const product = await createProduct('Principal');

    const added = await service.addCartItem(user, {
      id: product.id,
      type: CommerceItemType.PRODUCT,
      quantity: 2,
    });
    expect(added.totalCents).toBe(2580);
    expect(added.items[0]).toMatchObject({ quantity: 2, priceCents: 1290, available: true });

    const reloaded = await service.getCart(user);
    expect(reloaded.items).toHaveLength(1);
    expect(reloaded.totalCents).toBe(2580);
  });

  it('prevents one user from modifying another user cart item', async () => {
    const owner = await createUser('Owner');
    const attacker = await createUser('Other');
    const product = await createProduct('Ownership');
    const cart = await service.addCartItem(owner, {
      id: product.id,
      type: CommerceItemType.PRODUCT,
      quantity: 1,
    });

    await expect(
      service.updateCartItem(attacker, cart.items[0].cartItemId, 2),
    ).rejects.toBeDefined();
  });

  it('rejects mixing businesses in the same cart', async () => {
    const user = await createUser('Single club');
    const first = await createProduct('Club A');
    const second = await createProduct('Club B');
    await service.addCartItem(user, { id: first.id, type: CommerceItemType.PRODUCT, quantity: 1 });

    await expect(
      service.addCartItem(user, { id: second.id, type: CommerceItemType.PRODUCT, quantity: 1 }),
    ).rejects.toBeDefined();
  });

  it('rejects inactive products before storing them', async () => {
    const user = await createUser('Inactive');
    const product = await createProduct('Inactive', 'INACTIVE');

    await expect(
      service.addCartItem(user, { id: product.id, type: CommerceItemType.PRODUCT, quantity: 1 }),
    ).rejects.toBeDefined();
  });

  it('rejects a stale client total and preserves cart and stock', async () => {
    const user = await createUser('Changed price');
    const product = await createProduct('Changed price');
    await service.addCartItem(user, {
      id: product.id,
      type: CommerceItemType.PRODUCT,
      quantity: 2,
    });

    await expect(service.checkout(user, { expectedTotalCents: 1 })).rejects.toBeDefined();
    const [cart, storedProduct] = await Promise.all([
      service.getCart(user),
      prisma.product.findUniqueOrThrow({ where: { id: product.id } }),
    ]);
    expect(cart.items).toHaveLength(1);
    expect(storedProduct.stockQuantity).toBe(10);
  });

  it('enforces the per-user ticket limit before storing the cart item', async () => {
    const user = await createUser('Ticket limit');
    const ticket = await createLimitedTicket('Ticket limit');

    await expect(
      service.addCartItem(user, { id: ticket.id, type: CommerceItemType.TICKET, quantity: 2 }),
    ).rejects.toBeDefined();
    expect((await service.getCart(user)).items).toHaveLength(0);
  });
});
