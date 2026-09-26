/// <reference types="jest" />
import { FeaturedCampaignsService } from '@modules/featured-campaigns/application/featured-campaigns.service';
import { UploadsService } from '@modules/uploads/application/uploads.service';
import { ClubStatus, EventStatus, FeaturedTargetType } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('Featured selection for Home', () => {
  it('deduplicates exact targets while retaining a Local and its Evento', async () => {
    // The database disallows two active campaigns for the same target, so exercise
    // the read boundary directly to guard against duplicate legacy rows.
    const club = {
      id: 'club-1',
      name: 'Local',
      status: ClubStatus.ACTIVE,
      coverImageUrl: 'https://example.test/club.jpg',
      addressJson: { direccion: 'Calle 1', distrito: 'Miraflores', departamento: 'Lima' },
      contactJson: { phone: '+51999999999' },
      scheduleJson: [{ day: 'saturday', isOpen: true, openTime: '18:00', closeTime: '02:00' }],
    };
    const event = {
      id: 'event-1',
      clubId: club.id,
      name: 'Evento',
      status: EventStatus.PUBLISHED,
      imageUrl: 'https://example.test/event.jpg',
      endsAt: new Date('2026-09-28T00:00:00Z'),
    };
    const campaigns = [
      {
        id: 'campaign-a',
        clubId: club.id,
        eventId: null,
        targetType: FeaturedTargetType.BUSINESS,
        club,
        event: null,
      },
      {
        id: 'campaign-b',
        clubId: club.id,
        eventId: null,
        targetType: FeaturedTargetType.BUSINESS,
        club,
        event: null,
      },
      {
        id: 'campaign-c',
        clubId: club.id,
        eventId: event.id,
        targetType: FeaturedTargetType.EVENT,
        club,
        event,
      },
    ];
    const prisma = {
      featuredCampaign: { findMany: jest.fn().mockResolvedValue(campaigns) },
      club: { findMany: jest.fn().mockResolvedValue([{ id: club.id }]) },
    } as unknown as PrismaService;
    const uploads = {
      createReadableImageUrl: async (value: string) => value,
    } as UploadsService;
    const service = new FeaturedCampaignsService(
      prisma,
      {} as ConstructorParameters<typeof FeaturedCampaignsService>[1],
      {} as ConstructorParameters<typeof FeaturedCampaignsService>[2],
      uploads,
      {} as ConstructorParameters<typeof FeaturedCampaignsService>[4],
    );

    const selected = await service.selectForHome({
      viewerUserId: 'viewer',
      clubIds: [club.id],
      now: new Date('2026-09-27T00:00:00Z'),
    });
    expect(selected).toHaveLength(2);
    expect(selected.map((item) => `${item.targetType}:${item.targetId}`).sort()).toEqual([
      'BUSINESS:club-1',
      'EVENT:event-1',
    ]);
    const input = {
      viewerUserId: 'viewer',
      clubIds: [club.id],
      now: new Date('2026-09-27T00:00:00Z'),
      limit: 1,
    };
    const first = await service.selectForHome(input);
    expect(first).toHaveLength(1);
    expect(await service.selectForHome(input)).toEqual(first);
  });
});
