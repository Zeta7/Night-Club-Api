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
  const featured = new FeaturedCampaignsService(
    prisma,
    {} as ConstructorParameters<typeof FeaturedCampaignsService>[1],
    {} as ConstructorParameters<typeof FeaturedCampaignsService>[2],
    uploads,
    {} as ConstructorParameters<typeof FeaturedCampaignsService>[4],
  );
  const service = new ClubsService(prisma, new ConfigService(), uploads, featured);
  const viewer = { id: randomUUID(), role: UserRole.CUSTOMER };
  const suffix = randomUUID().slice(0, 8);
  const limaProvince = `Lima ${suffix}`;
  const limaDepartment = `Lima ${suffix}`;
  const arequipaDepartment = `Arequipa ${suffix}`;
  const clubIds: string[] = [];
  const clubs: Record<string, string> = {};
  let campaignCreatorId: string | null = null;

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
      await prisma.featuredCampaign.deleteMany({ where: { clubId: { in: clubIds } } });
      await prisma.promotion.deleteMany({ where: { clubId: { in: clubIds } } });
      await prisma.ticketType.deleteMany({ where: { clubId: { in: clubIds } } });
      await prisma.event.deleteMany({ where: { clubId: { in: clubIds } } });
      await prisma.product.deleteMany({ where: { clubId: { in: clubIds } } });
      await prisma.marketplaceSellerConnection.deleteMany({ where: { clubId: { in: clubIds } } });
      await prisma.club.deleteMany({ where: { id: { in: clubIds } } });
    }
    if (campaignCreatorId) await prisma.user.delete({ where: { id: campaignCreatorId } });
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
    expect(province.clubs).toHaveLength(3);
    expect(province.counts.clubs).toBe(5);
    expect(province.clubs.map((club) => club.id)).not.toContain(clubs.other);
    expect(province.clubs.map((club) => club.id)).not.toContain(clubs.inactive);

    const department = await service.getCustomerHome(viewer, {
      department: ` ARÉQUIPA ${suffix} `,
    });
    expect(department.clubs.map((club) => club.id)).toContain(clubs.other);
    expect(department.clubs.map((club) => club.id)).not.toContain(clubs.ready);

    const national = await service.getCustomerHome(viewer, {});
    expect(national.counts.clubs).toBeGreaterThanOrEqual(7);
    expect(national.location).toEqual({ district: '', province: '', department: '' });
  });

  it('keeps active Locales discoverable and exposes commerce and content availability', async () => {
    const home = await service.getCustomerHome(viewer, { province: limaProvince });
    const scoped = await Promise.all(
      [
        `Miraflores ${suffix}`,
        `Barranco ${suffix}`,
        `San Borja ${suffix}`,
        `Surco ${suffix}`,
        `San Isidro ${suffix}`,
      ].map((district) => service.getCustomerHome(viewer, { district })),
    );
    const byId = new Map(scoped.flatMap((result) => result.clubs).map((club) => [club.id, club]));
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

  it('returns self-contained sponsored Local and Evento targets within the requested scope', async () => {
    const now = new Date('2026-09-27T00:00:00.000Z'); // 19:00 in Lima
    const creator = await prisma.user.create({
      data: {
        phoneCountryCode: '+51',
        phoneNumber: `9${randomUUID().replace(/\D/g, '').slice(0, 8)}`,
        passwordHash: 'test',
        fullName: 'Featured test admin',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    campaignCreatorId = creator.id;
    const homeClub = await createClub(
      'featured',
      ClubStatus.ACTIVE,
      `Featured ${suffix}`,
      limaProvince,
      limaDepartment,
    );
    const otherClub = await createClub(
      'featuredOther',
      ClubStatus.ACTIVE,
      `Other ${suffix}`,
      `Other ${suffix}`,
      arequipaDepartment,
    );
    const incompleteClub = await createClub(
      'featuredIncomplete',
      ClubStatus.ACTIVE,
      `Incomplete ${suffix}`,
      `Incomplete ${suffix}`,
      arequipaDepartment,
    );
    const foreignClub = await createClub(
      'foreign',
      ClubStatus.ACTIVE,
      `Foreign ${suffix}`,
      `Foreign ${suffix}`,
      `Foreign ${suffix}`,
    );
    await Promise.all([
      connect(homeClub, null),
      connect(otherClub, null),
      connect(incompleteClub, null),
      connect(foreignClub, null),
      prisma.club.update({
        where: { id: homeClub },
        data: { coverImageUrl: 'https://example.test/club.jpg' },
      }),
      prisma.club.update({
        where: { id: otherClub },
        data: { coverImageUrl: 'https://example.test/other.jpg' },
      }),
      prisma.club.update({
        where: { id: clubs.disconnected! },
        data: { coverImageUrl: 'https://example.test/disconnected.jpg' },
      }),
      prisma.club.update({
        where: { id: foreignClub },
        data: {
          coverImageUrl: 'https://example.test/foreign.jpg',
          addressJson: {
            direccion: 'Foreign 123',
            distrito: `Foreign ${suffix}`,
            provincia: `Foreign ${suffix}`,
            departamento: `Foreign ${suffix}`,
            pais: 'Chile',
          },
        },
      }),
    ]);
    const event = await prisma.event.create({
      data: {
        clubId: homeClub,
        name: `Featured event ${suffix}`,
        imageUrl: 'https://example.test/event.jpg',
        startsAt: new Date('2026-09-27T01:00:00.000Z'),
        endsAt: new Date('2026-09-27T04:00:00.000Z'),
        capacity: 50,
        status: 'PUBLISHED',
      },
    });
    await Promise.all(
      [0, 1, 2].map((index) =>
        prisma.event.create({
          data: {
            clubId: homeClub,
            name: `Earlier ${index} ${suffix}`,
            capacity: 50,
            startsAt: new Date('2026-09-26T23:00:00.000Z'),
            endsAt: new Date('2026-09-27T01:15:00.000Z'),
            status: 'PUBLISHED',
          },
        }),
      ),
    );
    const imageMissingEvent = await prisma.event.create({
      data: {
        clubId: homeClub,
        name: `No image ${suffix}`,
        capacity: 50,
        startsAt: new Date('2026-09-27T01:00:00.000Z'),
        endsAt: new Date('2026-09-27T04:00:00.000Z'),
        status: 'PUBLISHED',
      },
    });
    const postponedEvent = await prisma.event.create({
      data: {
        clubId: homeClub,
        name: `Postponed ${suffix}`,
        capacity: 50,
        imageUrl: 'https://example.test/postponed.jpg',
        startsAt: new Date('2026-09-27T01:00:00.000Z'),
        endsAt: new Date('2026-09-27T04:00:00.000Z'),
        status: 'POSTPONED',
      },
    });
    const campaign = async (
      clubId: string,
      targetType: 'BUSINESS' | 'EVENT',
      eventId: string | null = null,
    ) =>
      prisma.featuredCampaign.create({
        data: {
          clubId,
          eventId,
          targetType,
          createdByUserId: creator.id,
          status: 'ACTIVE',
          durationDays: 1,
          priceCents: 1000,
          idempotencyKey: randomUUID(),
          startsAt: new Date('2026-09-26T00:00:00.000Z'),
          endsAt: new Date('2026-09-28T00:00:00.000Z'),
        },
      });
    await Promise.all([
      campaign(homeClub, 'BUSINESS'),
      campaign(homeClub, 'EVENT', event.id),
      campaign(homeClub, 'EVENT', imageMissingEvent.id),
      campaign(homeClub, 'EVENT', postponedEvent.id),
      campaign(otherClub, 'BUSINESS'),
      campaign(incompleteClub, 'BUSINESS'),
      campaign(clubs.disconnected!, 'BUSINESS'),
      campaign(foreignClub, 'BUSINESS'),
    ]);

    const nearby = await service.getCustomerHome(viewer, { district: `Featured ${suffix}` }, now);
    expect(nearby.featuredItems).toHaveLength(2);
    expect(nearby.featuredItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetType: 'BUSINESS',
          targetId: homeClub,
          clubId: homeClub,
          eventId: null,
          title: `Home featured ${suffix}`,
          imageUrl: 'https://example.test/club.jpg',
        }),
        expect.objectContaining({
          targetType: 'EVENT',
          targetId: event.id,
          clubId: homeClub,
          eventId: event.id,
          title: event.name,
          imageUrl: 'https://example.test/event.jpg',
        }),
      ]),
    );
    expect(nearby.events.map((item) => item.id)).not.toContain(event.id);
    expect(nearby.clubs.map((item) => item.id)).toContain(homeClub);
    const later = await service.getCustomerHome(
      viewer,
      { district: `Featured ${suffix}` },
      new Date('2026-09-27T01:30:00.000Z'),
    );
    expect(later.events.map((item) => item.id)).toContain(event.id);
    expect(later.featuredItems.map((item) => item.targetId)).toContain(event.id);
    const national = await service.getCustomerHome(viewer, {}, now);
    expect(national.featuredItems.map((item) => item.clubId)).toContain(otherClub);
    expect(national.featuredItems.map((item) => item.clubId)).not.toContain(incompleteClub);
    expect(national.featuredItems.map((item) => item.clubId)).not.toContain(clubs.disconnected);
    expect(national.featuredItems.map((item) => item.clubId)).not.toContain(foreignClub);
    expect(national.counts.clubs).toBeGreaterThanOrEqual(1);
    expect(
      (await service.getCustomerHome(viewer, { district: `Foreign ${suffix}` }, now)).clubs,
    ).toEqual([]);
  });

  it('ranks full eligible sets before applying preview limits and aggregates ticket availability', async () => {
    const now = new Date('2026-09-27T00:00:00.000Z'); // Saturday, 19:00 in Lima
    const province = `Ranking ${suffix}`;
    const make = async (key: string) =>
      createClub(key, ClubStatus.ACTIVE, `${key} ${suffix}`, province, limaDepartment);
    const [ongoing, tonight, offers, future, empty, unavailable] = await Promise.all([
      make('ongoing'),
      make('tonight'),
      make('offers'),
      make('future'),
      make('empty'),
      make('unavailable'),
    ]);
    await Promise.all([ongoing, tonight, offers, future, empty].map((id) => connect(id, null)));
    await prisma.club.update({
      where: { id: offers },
      data: {
        scheduleJson: [{ day: 'saturday', isOpen: true, openTime: '18:00', closeTime: '02:00' }],
      },
    });
    const createEvent = (
      clubId: string,
      name: string,
      start: string,
      end: string,
      status: 'PUBLISHED' | 'SALE_ACTIVE' | 'SOLD_OUT' = 'PUBLISHED',
    ) =>
      prisma.event.create({
        data: {
          clubId,
          name,
          status,
          capacity: 50,
          startsAt: new Date(start),
          endsAt: new Date(end),
        },
      });
    const [live, night, soldOut, later] = await Promise.all([
      createEvent(ongoing, 'A live', '2026-09-26T23:30:00Z', '2026-09-27T01:30:00Z', 'SALE_ACTIVE'),
      createEvent(tonight, 'B tonight', '2026-09-27T02:00:00Z', '2026-09-27T04:00:00Z'),
      createEvent(
        tonight,
        'C sold out',
        '2026-09-27T02:30:00Z',
        '2026-09-27T04:30:00Z',
        'SOLD_OUT',
      ),
      createEvent(future, 'D future', '2026-09-28T01:00:00Z', '2026-09-28T04:00:00Z'),
    ]);
    await Promise.all([
      prisma.ticketType.create({
        data: {
          clubId: ongoing,
          eventId: live.id,
          name: 'First',
          priceCents: 1000,
          quantityTotal: 10,
          quantitySold: 10,
          status: 'ACTIVE',
        },
      }),
      prisma.ticketType.create({
        data: {
          clubId: ongoing,
          eventId: live.id,
          name: 'Second',
          priceCents: 2000,
          quantityTotal: 20,
          quantitySold: 5,
          status: 'ACTIVE',
        },
      }),
    ]);
    const promotion = (
      clubId: string,
      name: string,
      endsAt: string | null,
      eventId: string | null = null,
    ) =>
      prisma.promotion.create({
        data: {
          clubId,
          eventId,
          name,
          status: 'ACTIVE',
          basePriceCents: 2000,
          finalPriceCents: 1500,
          endsAt: endsAt ? new Date(endsAt) : null,
        },
      });
    await Promise.all([
      promotion(ongoing, 'Linked later', '2026-09-27T04:00:00Z', live.id),
      promotion(tonight, 'Linked sooner', '2026-09-27T02:00:00Z', night.id),
      promotion(offers, 'General soon', '2026-09-27T01:00:00Z'),
      promotion(offers, 'General later', '2026-09-27T05:00:00Z'),
      promotion(offers, 'General no expiry', null),
      promotion(offers, 'General mid', '2026-09-27T03:00:00Z'),
      promotion(offers, 'General latest', '2026-09-27T06:00:00Z'),
    ]);

    const home = await service.getCustomerHome(viewer, { province }, now);
    expect(home.events.map((event) => event.id)).toEqual([live.id, night.id, soldOut.id]);
    expect(home.counts.events).toBe(4);
    expect(home.events[0]).toMatchObject({
      sold: 15,
      available: 15,
      accessStatus: 'AVAILABLE',
      timing: 'ONGOING',
      priceFrom: 20,
    });
    expect(home.events[1]).toMatchObject({ accessStatus: 'INFORMATIONAL', timing: 'TONIGHT' });
    expect(home.events[2]).toMatchObject({ accessStatus: 'SOLD_OUT', timing: 'TONIGHT' });
    expect(home.clubs.map((club) => club.id)).toEqual([ongoing, tonight, offers]);
    expect(home.counts).toMatchObject({
      clubs: 6,
      paymentReadyClubs: 5,
      paymentsUnavailableClubs: 1,
      promotions: 7,
    });
    expect(home.clubs[2]?.isOpenNow).toBe(true);
    expect(home.promotions.map((item) => item.name)).toEqual([
      'Linked sooner',
      'Linked later',
      'General soon',
      'General mid',
      'General later',
      'General latest',
    ]);
    expect(home.promotions).toHaveLength(6);
    expect(home.events.map((event) => event.id)).not.toContain(later.id);
    expect(home.clubs.map((club) => club.id)).not.toContain(unavailable);
  });

  it('uses the Lima 18:00 and 06:00 boundaries for timing and Local opening', async () => {
    const district = `Boundaries ${suffix}`;
    const clubId = await createClub(
      'boundaries',
      ClubStatus.ACTIVE,
      district,
      limaProvince,
      limaDepartment,
    );
    await connect(clubId, null);
    await prisma.club.update({
      where: { id: clubId },
      data: {
        scheduleJson: [{ day: 'saturday', isOpen: true, openTime: '18:00', closeTime: '06:00' }],
      },
    });
    const early = await prisma.event.create({
      data: {
        clubId,
        name: 'Starts at 18:00',
        capacity: 10,
        status: 'SALE_ACTIVE',
        startsAt: new Date('2026-09-26T23:00:00Z'),
        endsAt: new Date('2026-09-27T01:00:00Z'),
      },
    });
    const dawn = await prisma.event.create({
      data: {
        clubId,
        name: 'Starts before 06:00',
        capacity: 10,
        status: 'PUBLISHED',
        startsAt: new Date('2026-09-27T10:30:00Z'),
        endsAt: new Date('2026-09-27T11:30:00Z'),
      },
    });
    const afterNight = await prisma.event.create({
      data: {
        clubId,
        name: 'Starts at 06:00',
        capacity: 10,
        status: 'PUBLISHED',
        startsAt: new Date('2026-09-27T11:00:00Z'),
        endsAt: new Date('2026-09-27T12:00:00Z'),
      },
    });
    await Promise.all([
      prisma.ticketType.create({
        data: {
          clubId,
          eventId: early.id,
          name: 'Sale starts later',
          priceCents: 1200,
          quantityTotal: 10,
          status: 'ACTIVE',
          saleStartAt: new Date('2026-09-27T02:00:00Z'),
        },
      }),
      prisma.ticketType.create({
        data: {
          clubId,
          eventId: dawn.id,
          name: 'Published only',
          priceCents: 1200,
          quantityTotal: 10,
          status: 'ACTIVE',
        },
      }),
    ]);

    const before18 = await service.getCustomerHome(
      viewer,
      { district },
      new Date('2026-09-26T22:59:00Z'),
    );
    expect(before18.events.find((event) => event.id === early.id)?.timing).toBe('TONIGHT');
    expect(before18.events.find((event) => event.id === early.id)).toMatchObject({
      accessStatus: 'UNAVAILABLE',
      available: 0,
      priceFrom: null,
    });
    expect(before18.clubs[0]?.isOpenNow).toBe(false);
    const at18 = await service.getCustomerHome(
      viewer,
      { district },
      new Date('2026-09-26T23:00:00Z'),
    );
    expect(at18.events.find((event) => event.id === early.id)?.timing).toBe('ONGOING');
    expect(at18.clubs[0]?.isOpenNow).toBe(true);
    const before06 = await service.getCustomerHome(
      viewer,
      { district },
      new Date('2026-09-27T10:59:00Z'),
    );
    expect(before06.events.find((event) => event.id === dawn.id)?.timing).toBe('ONGOING');
    expect(before06.events.find((event) => event.id === dawn.id)).toMatchObject({
      accessStatus: 'UNAVAILABLE',
      available: 0,
    });
    expect(before06.events.find((event) => event.id === afterNight.id)?.timing).toBe('FUTURE');
    expect(before06.clubs[0]?.isOpenNow).toBe(true);
    const at06 = await service.getCustomerHome(
      viewer,
      { district },
      new Date('2026-09-27T11:00:00Z'),
    );
    expect(at06.events.find((event) => event.id === afterNight.id)?.timing).toBe('ONGOING');
    expect(at06.clubs[0]?.isOpenNow).toBe(false);
  });
});
