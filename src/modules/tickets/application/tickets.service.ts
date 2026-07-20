import { Injectable } from '@nestjs/common';
import { TicketTypeStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { badRequest, forbidden, notFound } from '../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { CreateTicketTypeDto } from '../presentation/dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from '../presentation/dto/update-ticket-type.dto';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async createClubTicketType(
    currentUser: AuthenticatedUser,
    clubId: string,
    input: CreateTicketTypeDto,
  ) {
    await this.assertCanManageClub(currentUser, clubId);
    const data = this.normalizeTicketInput(input);
    const ticketType = await this.prisma.ticketType.create({
      data: { ...data, clubId, eventId: null },
      include: ticketTypeInclude,
    });
    return {
      message: 'Entrada de discoteca creada correctamente.',
      ticketType: toTicketTypeResponse(ticketType),
    };
  }

  async listClubTicketTypes(currentUser: AuthenticatedUser, clubId: string) {
    await this.assertCanManageClub(currentUser, clubId);
    const ticketTypes = await this.prisma.ticketType.findMany({
      where: { clubId, eventId: null },
      orderBy: { createdAt: 'desc' },
      include: ticketTypeInclude,
    });
    return {
      message: 'Entradas de discoteca obtenidas correctamente.',
      ticketTypes: ticketTypes.map(toTicketTypeResponse),
    };
  }

  async createEventTicketType(
    currentUser: AuthenticatedUser,
    clubId: string,
    eventId: string,
    input: CreateTicketTypeDto,
  ) {
    await this.assertCanManageEvent(currentUser, clubId, eventId);
    const data = this.normalizeTicketInput(input);
    const ticketType = await this.prisma.ticketType.create({
      data: { ...data, clubId, eventId },
      include: ticketTypeInclude,
    });
    return {
      message: 'Entrada de evento creada correctamente.',
      ticketType: toTicketTypeResponse(ticketType),
    };
  }

  async listEventTicketTypes(currentUser: AuthenticatedUser, clubId: string, eventId: string) {
    await this.assertCanManageEvent(currentUser, clubId, eventId);
    const ticketTypes = await this.prisma.ticketType.findMany({
      where: { clubId, eventId },
      orderBy: { createdAt: 'desc' },
      include: ticketTypeInclude,
    });
    return {
      message: 'Entradas de evento obtenidas correctamente.',
      ticketTypes: ticketTypes.map(toTicketTypeResponse),
    };
  }

  async updateTicketType(
    currentUser: AuthenticatedUser,
    clubId: string,
    ticketTypeId: string,
    input: UpdateTicketTypeDto,
  ) {
    const current = await this.findTicketTypeOrFail(clubId, ticketTypeId, null);
    await this.assertCanManageClub(currentUser, clubId);
    const data = this.normalizeTicketUpdateInput(input, current.quantitySold);
    const ticketType = await this.prisma.ticketType.update({
      where: { id: ticketTypeId },
      data,
      include: ticketTypeInclude,
    });
    return {
      message: 'Entrada actualizada correctamente.',
      ticketType: toTicketTypeResponse(ticketType),
    };
  }

  async deactivateTicketType(currentUser: AuthenticatedUser, clubId: string, ticketTypeId: string) {
    await this.findTicketTypeOrFail(clubId, ticketTypeId, null);
    await this.assertCanManageClub(currentUser, clubId);
    const ticketType = await this.prisma.ticketType.update({
      where: { id: ticketTypeId },
      data: { status: TicketTypeStatus.INACTIVE },
      include: ticketTypeInclude,
    });
    return {
      message: 'Entrada desactivada correctamente.',
      ticketType: toTicketTypeResponse(ticketType),
    };
  }

  async updateEventTicketType(
    currentUser: AuthenticatedUser,
    clubId: string,
    eventId: string,
    ticketTypeId: string,
    input: UpdateTicketTypeDto,
  ) {
    const current = await this.findTicketTypeOrFail(clubId, ticketTypeId, eventId);
    await this.assertCanManageEvent(currentUser, clubId, eventId);
    const data = this.normalizeTicketUpdateInput(input, current.quantitySold);
    const ticketType = await this.prisma.ticketType.update({
      where: { id: ticketTypeId },
      data,
      include: ticketTypeInclude,
    });
    return {
      message: 'Entrada de evento actualizada correctamente.',
      ticketType: toTicketTypeResponse(ticketType),
    };
  }

  async deactivateEventTicketType(
    currentUser: AuthenticatedUser,
    clubId: string,
    eventId: string,
    ticketTypeId: string,
  ) {
    await this.findTicketTypeOrFail(clubId, ticketTypeId, eventId);
    await this.assertCanManageEvent(currentUser, clubId, eventId);
    const ticketType = await this.prisma.ticketType.update({
      where: { id: ticketTypeId },
      data: { status: TicketTypeStatus.INACTIVE },
      include: ticketTypeInclude,
    });
    return {
      message: 'Entrada de evento desactivada correctamente.',
      ticketType: toTicketTypeResponse(ticketType),
    };
  }

  async activateTicketType(currentUser: AuthenticatedUser, clubId: string, ticketTypeId: string) {
    const current = await this.findTicketTypeOrFail(clubId, ticketTypeId, null);
    await this.assertCanManageClub(currentUser, clubId);
    const nextStatus =
      current.quantityTotal > 0 && current.quantitySold >= current.quantityTotal
        ? TicketTypeStatus.SOLD_OUT
        : TicketTypeStatus.ACTIVE;
    const ticketType = await this.prisma.ticketType.update({
      where: { id: ticketTypeId },
      data: { status: nextStatus },
      include: ticketTypeInclude,
    });
    return {
      message: 'Entrada activada correctamente.',
      ticketType: toTicketTypeResponse(ticketType),
    };
  }

  async activateEventTicketType(
    currentUser: AuthenticatedUser,
    clubId: string,
    eventId: string,
    ticketTypeId: string,
  ) {
    const current = await this.findTicketTypeOrFail(clubId, ticketTypeId, eventId);
    await this.assertCanManageEvent(currentUser, clubId, eventId);
    const nextStatus =
      current.quantityTotal > 0 && current.quantitySold >= current.quantityTotal
        ? TicketTypeStatus.SOLD_OUT
        : TicketTypeStatus.ACTIVE;
    const ticketType = await this.prisma.ticketType.update({
      where: { id: ticketTypeId },
      data: { status: nextStatus },
      include: ticketTypeInclude,
    });
    return {
      message: 'Entrada de evento activada correctamente.',
      ticketType: toTicketTypeResponse(ticketType),
    };
  }

  async deleteTicketType(currentUser: AuthenticatedUser, clubId: string, ticketTypeId: string) {
    const current = await this.findTicketTypeOrFail(clubId, ticketTypeId, null);
    await this.assertCanManageClub(currentUser, clubId);
    this.assertTicketCanBeDeleted(current.quantitySold);
    await this.prisma.ticketType.delete({
      where: { id: ticketTypeId },
    });
    return {
      message: 'Entrada eliminada correctamente.',
    };
  }

  async deleteEventTicketType(
    currentUser: AuthenticatedUser,
    clubId: string,
    eventId: string,
    ticketTypeId: string,
  ) {
    const current = await this.findTicketTypeOrFail(clubId, ticketTypeId, eventId);
    await this.assertCanManageEvent(currentUser, clubId, eventId);
    this.assertTicketCanBeDeleted(current.quantitySold);
    await this.prisma.ticketType.delete({
      where: { id: ticketTypeId },
    });
    return {
      message: 'Entrada de evento eliminada correctamente.',
    };
  }

  private normalizeTicketInput(input: CreateTicketTypeDto) {
    const saleStartAt = parseOptionalDate(input.saleStartAt);
    const saleEndAt = parseOptionalDate(input.saleEndAt);
    this.assertSaleRange(saleStartAt, saleEndAt);
    return {
      name: normalizeText(input.name),
      description: normalizeOptionalText(input.description),
      priceCents: priceToCents(input.price),
      currency: normalizeCurrency(input.currency),
      quantityTotal: input.quantityTotal,
      perUserLimit: input.perUserLimit ?? null,
      saleStartAt,
      saleEndAt,
    };
  }

  private normalizeTicketUpdateInput(input: UpdateTicketTypeDto, quantitySold: number) {
    const data: {
      name?: string;
      description?: string | null;
      priceCents?: number;
      currency?: string;
      quantityTotal?: number;
      perUserLimit?: number | null;
      saleStartAt?: Date | null;
      saleEndAt?: Date | null;
      status?: TicketTypeStatus;
    } = {};
    if (input.name !== undefined) data.name = normalizeText(input.name);
    if (input.description !== undefined)
      data.description = normalizeOptionalText(input.description);
    if (input.price !== undefined) data.priceCents = priceToCents(input.price);
    if (input.currency !== undefined) data.currency = normalizeCurrency(input.currency);
    if (input.quantityTotal !== undefined) {
      if (input.quantityTotal < quantitySold) {
        throw badRequest(
          'TICKET_QUANTITY_BELOW_SOLD',
          'La cantidad total no puede ser menor a la cantidad ya vendida.',
        );
      }
      data.quantityTotal = input.quantityTotal;
      data.status =
        input.quantityTotal === quantitySold ? TicketTypeStatus.SOLD_OUT : TicketTypeStatus.ACTIVE;
    }
    if (input.perUserLimit !== undefined) data.perUserLimit = input.perUserLimit ?? null;
    if (input.saleStartAt !== undefined || input.saleEndAt !== undefined) {
      const saleStartAt = parseOptionalDate(input.saleStartAt);
      const saleEndAt = parseOptionalDate(input.saleEndAt);
      this.assertSaleRange(saleStartAt, saleEndAt);
      data.saleStartAt = saleStartAt;
      data.saleEndAt = saleEndAt;
    }
    return data;
  }

  private assertSaleRange(saleStartAt: Date | null, saleEndAt: Date | null) {
    if (saleStartAt && saleEndAt && saleEndAt.getTime() <= saleStartAt.getTime()) {
      throw badRequest(
        'TICKET_SALE_RANGE_INVALID',
        'La fecha de fin de venta debe ser posterior al inicio.',
      );
    }
  }

  private assertTicketCanBeDeleted(quantitySold: number) {
    if (quantitySold > 0) {
      throw badRequest(
        'TICKET_TYPE_DELETE_NOT_ALLOWED',
        'No puedes eliminar una entrada que ya tiene ventas registradas.',
      );
    }
  }

  private async assertCanManageEvent(
    currentUser: AuthenticatedUser,
    clubId: string,
    eventId: string,
  ) {
    await this.assertCanManageClub(currentUser, clubId);
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, clubId },
      select: { id: true },
    });
    if (!event) throw notFound('EVENT_NOT_FOUND', 'No encontramos el evento solicitado.');
  }

  private async assertCanManageClub(currentUser: AuthenticatedUser, clubId: string) {
    const club = await this.prisma.club.findUnique({ where: { id: clubId }, select: { id: true } });
    if (!club) throw notFound('CLUB_NOT_FOUND', 'No encontramos el club solicitado.');
    if (currentUser.role === UserRole.SUPER_ADMIN) return;
    if (currentUser.role !== UserRole.ADMIN) {
      throw forbidden('CLUB_MANAGE_FORBIDDEN', 'No tienes permisos para administrar este club.');
    }
    const clubAdmin = await this.prisma.clubAdmin.findUnique({
      where: { clubId_userId: { clubId, userId: currentUser.id } },
      select: { id: true },
    });
    if (!clubAdmin)
      throw forbidden('CLUB_MANAGE_FORBIDDEN', 'No tienes permisos para administrar este club.');
  }

  private async findTicketTypeOrFail(
    clubId: string,
    ticketTypeId: string,
    eventId?: string | null,
  ) {
    const ticketType = await this.prisma.ticketType.findFirst({
      where: { id: ticketTypeId, clubId, eventId },
      select: { id: true, quantitySold: true, quantityTotal: true, status: true },
    });
    if (!ticketType)
      throw notFound('TICKET_TYPE_NOT_FOUND', 'No encontramos la entrada solicitada.');
    return ticketType;
  }
}

const ticketTypeInclude = {
  club: { select: { id: true, name: true } },
  event: { select: { id: true, name: true, startsAt: true } },
} as const;

const normalizeText = (value: string) => value.trim();
const normalizeOptionalText = (value?: string) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};
const normalizeCurrency = (value?: string) => (value?.trim().toUpperCase() || 'PEN').slice(0, 3);
const priceToCents = (value: number) => Math.round(value * 100);
const centsToPrice = (value: number) => value / 100;
const parseOptionalDate = (value?: string) => (value ? new Date(value) : null);

const toTicketTypeResponse = (ticketType: {
  id: string;
  clubId: string;
  eventId: string | null;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  quantityTotal: number;
  quantitySold: number;
  perUserLimit: number | null;
  saleStartAt: Date | null;
  saleEndAt: Date | null;
  status: TicketTypeStatus;
  createdAt: Date;
  updatedAt: Date;
  club: { id: string; name: string };
  event: { id: string; name: string; startsAt: Date } | null;
}) => ({
  id: ticketType.id,
  clubId: ticketType.clubId,
  eventId: ticketType.eventId,
  scope: ticketType.eventId ? 'event' : 'club',
  name: ticketType.name,
  description: ticketType.description,
  price: centsToPrice(ticketType.priceCents),
  currency: ticketType.currency,
  quantityTotal: ticketType.quantityTotal,
  quantitySold: ticketType.quantitySold,
  quantityAvailable: Math.max(ticketType.quantityTotal - ticketType.quantitySold, 0),
  perUserLimit: ticketType.perUserLimit,
  saleStartAt: ticketType.saleStartAt,
  saleEndAt: ticketType.saleEndAt,
  status: ticketType.status,
  createdAt: ticketType.createdAt,
  updatedAt: ticketType.updatedAt,
  club: ticketType.club,
  event: ticketType.event,
});
