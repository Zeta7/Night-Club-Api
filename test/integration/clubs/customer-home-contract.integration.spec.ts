/// <reference types="jest" />
import { ClubsService } from '@modules/clubs/application/clubs.service';
import { FeaturedCampaignsService } from '@modules/featured-campaigns/application/featured-campaigns.service';
import { UploadsService } from '@modules/uploads/application/uploads.service';
import { ConfigService } from '@nestjs/config';
import { ClubStatus, SellerConnectionStatus, UserRole } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';

jest.setTimeout(180_000);

describe('Customer Home discovery contract', () => {
  const prisma = new PrismaService(new ConfigService());
  const uploads = {
    createReadableImageUrl: async (value: string | null) => value,
  } as UploadsService;
  const featured = { selectForHome: async () => [] } as unknown as FeaturedCampaignsService;
  const service = new ClubsService(prisma, new ConfigService(), uploads, featured);
  const viewer = { id: randomUUID(), role: UserRole.CUSTOMER };
  const suffix = randomUUID().slice(0, 8);
  const limaProvince = `Lima ${suffix}`;
  const limaDepartment = `Lima ${suffix}`;
  const arequipaDepartment = `Arequipa ${suffix}`;
  const clubIds: string[] = [];
  const clubs: Record<string, string> = {};

  async function createClub(
    key: string,
    status: ClubStatus,
    district: string,
    province: string,
    department: string,
  ) {
    const club = await prisma.club.create({
      data: {
        name: `Home ${key} ${suffix}`,
        status,
        updatedAt: new Date('2099-01-01T00:00:00.000Z'),
        addressJson: {
          direccion: `${key} 123`,
          distrito: district,
          provincia: province,
          departamento: department,
          pais: 'Perú',
        },
        contactJson: { phone: '+51999999999', email: `${key}@example.test` },
        scheduleJson: [{ day: 'monday', isOpen: true, openTime: '18:00', closeTime: '02:00' }],
      },
    });
    clubIds.push(club.id);
    clubs[key] = club.id;
    return club.id;
  }

  async function connect(clubId: string, expiresAt: Date | null) {
    await prisma.marketplaceSellerConnection.create({
      data: {
        clubId,
        provider: 'mercado_pago',
        externalSellerId: `home-${randomUUID()}`,
        accessTokenEncrypted: 'test',
        scopes: [],
        status: SellerConnectionStatus.CONNECTED,
        tokenExpiresAt: expiresAt,
      },
    });
  }

  async function addContent(clubId: string) {
    await prisma.event.create({
      data: {
        clubId,
        name: `Home event ${suffix}`,
        startsAt: new Date(Date.now() + 86_400_000),
        endsAt: new Date(Date.now() + 90_000_000),
        capacity: 50,
        status: 'PUBLISHED',
      },
    });
    await prisma.promotion.create({
      data: {
        clubId,
        name: `Home offer ${suffix}`,
        basePriceCents: 2000,
        finalPriceCents: 1500,
        status: 'ACTIVE',
      },
    });
  }

  beforeAll(async () => {
    await prisma.$connect();
    const ready = await createClub(
      'ready',
      ClubStatus.ACTIVE,
      `Miraflores ${suffix}`,
      limaProvince,
      limaDepartment,
    );
    const empty = await createClub(
      'empty',
      ClubStatus.ACTIVE,
      `Barranco ${suffix}`,
      limaProvince,
      limaDepartment,
    );
    const productOnly = await createClub(
      'productOnly',
      ClubStatus.ACTIVE,
      `San Borja ${suffix}`,
      limaProvince,
      limaDepartment,
    );
    const expired = await createClub(
      'expired',
      ClubStatus.ACTIVE,
      `Surco ${suffix}`,
      limaProvince,
      limaDepartment,
    );
    const disconnected = await createClub(
      'disconnected',
      ClubStatus.ACTIVE,
      `San Isidro ${suffix}`,
      limaProvince,
      limaDepartment,
    );
    const inactive = await createClub(
      'inactive',
      ClubStatus.INACTIVE,
      `Miraflores ${suffix}`,
      limaProvince,
      limaDepartment,
    );
    await createClub(
      'other',
      ClubStatus.ACTIVE,
      `Cercado ${suffix}`,
      `Arequipa ${suffix}`,
      arequipaDepartment,
    );
    await connect(ready, null);
    await connect(empty, new Date(Date.now() + 86_400_000));
    await connect(productOnly, null);
    await connect(expired, new Date(Date.now() - 86_400_000));
    await prisma.product.create({
      data: {
        clubId: productOnly,
        name: `Home product ${suffix}`,
        priceCents: 1000,
        stockQuantity: 10,
        status: 'ACTIVE',
      },
    });
    await Promise.all([
      addContent(ready),
      addContent(expired),
      addContent(disconnected),
      addContent(inactive),
    ]);
  });

  afterAll(async () => {
    if (clubIds.length > 0) {
      await prisma.promotion.deleteMany({ where: { clubId: { in: clubIds } } });
      await prisma.event.deleteMany({ where: { clubId: { in: clubIds } } });
      await prisma.product.deleteMany({ where: { clubId: { in: clubIds } } });
      await prisma.marketplaceSellerConnection.deleteMany({ where: { clubId: { in: clubIds } } });
      await prisma.club.deleteMany({ where: { id: { in: clubIds } } });
    }
    await prisma.$disconnect();
  });

  it('uses district or province, then department only as fallback, and preserves national scope', async () => {
    const district = await service.getCustomerHome(viewer, {
      district: `  MIRAFLORES ${suffix.toUpperCase()} `,
      province: 'not Lima',
      department: arequipaDepartment,
    });
    expect(district.clubs.map((club) => club.id)).toEqual([clubs.ready]);

    const province = await service.getCustomerHome(viewer, {
      district: 'unknown',
      province: ` líma ${suffix} `,
      department: arequipaDepartment,
    });
    expect(province.clubs.map((club) => club.id)).toEqual(
      expect.arrayContaining([
        clubs.ready,
        clubs.empty,
        clubs.productOnly,
        clubs.expired,
        clubs.disconnected,
      ]),
    );
    expect(province.clubs.map((club) => club.id)).not.toContain(clubs.other);
    expect(province.clubs.map((club) => club.id)).not.toContain(clubs.inactive);

    const department = await service.getCustomerHome(viewer, {
      department: ` ARÉQUIPA ${suffix} `,
    });
    expect(department.clubs.map((club) => club.id)).toContain(clubs.other);
    expect(department.clubs.map((club) => club.id)).not.toContain(clubs.ready);

    const national = await service.getCustomerHome(viewer, {});
    expect(national.clubs.map((club) => club.id)).toContain(clubs.other);
    expect(national.clubs.map((club) => club.id)).toContain(clubs.ready);
  });

  it('keeps active Locales discoverable and exposes commerce and content availability', async () => {
    const home = await service.getCustomerHome(viewer, { province: limaProvince });
    const byId = new Map(home.clubs.map((club) => [club.id, club]));
    expect(byId.get(clubs.ready!)).toMatchObject({
      commerceStatus: 'AVAILABLE',
      emptyReason: null,
    });
    expect(byId.get(clubs.empty!)).toMatchObject({
      commerceStatus: 'AVAILABLE',
      emptyReason: 'NO_EVENTS_OR_OFFERS',
    });
    expect(byId.get(clubs.productOnly!)).toMatchObject({
      commerceStatus: 'AVAILABLE',
      emptyReason: null,
    });
    for (const key of ['expired', 'disconnected']) {
      expect(byId.get(clubs[key]!)).toMatchObject({
        commerceStatus: 'PAYMENTS_UNAVAILABLE',
        emptyReason: 'PAYMENTS_UNAVAILABLE',
        address: { direccion: `${key} 123` },
        contact: { phone: '+51999999999' },
        schedule: [{ day: 'monday', isOpen: true, openTime: '18:00', closeTime: '02:00' }],
      });
    }
    expect(home.events.map((event) => event.clubId)).toEqual([clubs.ready]);
    expect(home.promotions.map((offer) => offer.clubId)).toEqual([clubs.ready]);
    expect(home.products.map((product) => product.clubId)).toEqual([clubs.productOnly]);
    expect(home.clubs.map((club) => club.id)).not.toContain(clubs.inactive);
    const unavailableDetail = await service.getCustomerClubDetail(viewer, clubs.disconnected!);
    expect(unavailableDetail.clubs[0]).toMatchObject({
      commerceStatus: 'PAYMENTS_UNAVAILABLE',
      emptyReason: 'PAYMENTS_UNAVAILABLE',
      address: { direccion: 'disconnected 123' },
    });
    expect(unavailableDetail.events).toEqual([]);
    expect(unavailableDetail.promotions).toEqual([]);
    const emptyDetail = await service.getCustomerClubDetail(viewer, clubs.empty!);
    expect(emptyDetail.clubs[0]).toMatchObject({
      commerceStatus: 'AVAILABLE',
      emptyReason: 'NO_EVENTS_OR_OFFERS',
    });
    await expect(service.getCustomerClubDetail(viewer, clubs.inactive!)).rejects.toBeDefined();
    expect(home.counts).toMatchObject({
      clubs: 5,
      paymentReadyClubs: 3,
      paymentsUnavailableClubs: 2,
      events: 1,
      promotions: 1,
    });
  });

  it('returns machine-readable empty causes without replacing the legacy response', async () => {
    const empty = await service.getCustomerHome(viewer, { district: `missing-${suffix}` });
    expect(empty.hasResults).toBe(false);
    expect(empty.emptyReasons).toEqual({
      clubs: 'NO_ACTIVE_CLUBS_IN_SCOPE',
      events: 'NO_ACTIVE_CLUBS_IN_SCOPE',
      promotions: 'NO_ACTIVE_CLUBS_IN_SCOPE',
    });
    expect(empty.counts).toEqual({
      clubs: 0,
      paymentReadyClubs: 0,
      paymentsUnavailableClubs: 0,
      events: 0,
      promotions: 0,
    });
    expect(empty.emptyState).toBeDefined();

    const noPayment = await service.getCustomerHome(viewer, { district: `Surco ${suffix}` });
    expect(noPayment.emptyReasons).toEqual({
      clubs: null,
      events: 'PAYMENTS_UNAVAILABLE',
      promotions: 'PAYMENTS_UNAVAILABLE',
    });

    const noContent = await service.getCustomerHome(viewer, { district: `Barranco ${suffix}` });
    expect(noContent.emptyReasons).toEqual({
      clubs: null,
      events: 'NO_VISIBLE_EVENTS',
      promotions: 'NO_ACTIVE_PROMOTIONS',
    });
  });
});
