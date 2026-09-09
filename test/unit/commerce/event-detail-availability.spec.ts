/// <reference types="jest" />
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { ClubsService } from '../../../src/modules/clubs/application/clubs.service';

describe('Event detail inventory', () => {
  it.each([
    [3, 1, 5, 3],
    [30, 9, 0, 0],
  ])(
    'subtracts %i reservations and reports the remaining personal limit after %i purchases',
    async (reservedQuantity, owned, expectedAvailable, expectedLimit) => {
      const prisma = {
        event: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'event',
            clubId: 'club',
            status: 'SALE_ACTIVE',
            club: { id: 'club', name: 'Club', status: 'ACTIVE' },
            promotions: [],
            ticketTypes: [
              {
                id: 'ticket',
                clubId: 'club',
                name: 'General',
                priceCents: 1000,
                currency: 'PEN',
                quantityTotal: 10,
                quantitySold: 2,
                perUserLimit: 4,
                status: 'ACTIVE',
                saleStartAt: null,
                saleEndAt: null,
              },
            ],
          }),
        },
        inventoryReservation: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: reservedQuantity } }),
        },
        ticket: { count: jest.fn().mockResolvedValue(owned) },
      };
      const service = new ClubsService(prisma as never, new ConfigService(), {
        createReadableImageUrl: jest.fn().mockResolvedValue(null),
      } as never);
      const result = await service.getCustomerEventDetail(
        { id: 'user', role: UserRole.CUSTOMER },
        'event',
      );
      expect(result.tickets[0].quantityAvailable).toBe(expectedAvailable);
      expect(result.tickets[0].remainingUserLimit).toBe(expectedLimit);
      expect(prisma.inventoryReservation.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            resourceType: 'TICKET',
            resourceId: 'ticket',
            status: 'ACTIVE',
            expiresAt: { gt: expect.any(Date) },
          },
        }),
      );
      expect(prisma.ticket.count).toHaveBeenCalledWith({
        where: { ownerUserId: 'user', ticketTypeId: 'ticket' },
      });
    },
  );
});
