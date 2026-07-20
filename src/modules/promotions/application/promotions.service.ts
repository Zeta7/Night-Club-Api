import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ProductStatus,
  PromotionDiscountType,
  PromotionItemType,
  PromotionPricingMode,
  PromotionStatus,
  TicketTypeStatus,
  UserRole,
} from '@prisma/client';
import { buildMediaUrl } from '../../../shared/infrastructure/media/media-url';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { badRequest, forbidden, notFound } from '../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { UploadsService } from '../../uploads/application/uploads.service';
import { CreatePromotionDto } from '../presentation/dto/create-promotion.dto';
import { PromotionItemDto } from '../presentation/dto/promotion-item.dto';
import { UpdatePromotionDto } from '../presentation/dto/update-promotion.dto';

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
    private readonly config: ConfigService,
  ) {}

  async createPromotion(currentUser: AuthenticatedUser, clubId: string, input: CreatePromotionDto) {
    await this.assertCanManageClub(currentUser, clubId);
    await this.assertEventBelongsToClub(clubId, input.eventId);
    this.assertImageMutationInput(input.imageUploadId, input.removeImage);
    const startsAt = parseOptionalDate(input.startsAt);
    const endsAt = parseOptionalDate(input.endsAt);
    assertDateRange(startsAt, endsAt);

    const resolvedItems = await this.resolveItems(clubId, input.eventId, input.items);
    const totals = resolvePromotionTotals({
      pricingMode: input.pricingMode,
      finalPrice: input.finalPrice,
      items: resolvedItems,
    });

    const promotion = await this.prisma.$transaction(async (tx) => {
      const consumedImage = input.imageUploadId
        ? await this.uploadsService.consumeUpload({
            uploadId: input.imageUploadId,
            userId: currentUser.id,
            transaction: tx,
          })
        : null;

      return tx.promotion.create({
        data: {
          clubId,
          eventId: input.eventId ?? null,
          name: normalizeText(input.name),
          description: normalizeOptionalText(input.description),
          imageUrl: consumedImage?.objectKey ?? null,
          pricingMode: input.pricingMode ?? PromotionPricingMode.CALCULATED,
          basePriceCents: totals.basePriceCents,
          finalPriceCents: totals.finalPriceCents,
          currency: normalizeCurrency(input.currency),
          startsAt,
          endsAt,
          items: {
            create: resolvedItems.map((item) => ({
              itemType: item.itemType,
              productId: item.productId,
              ticketTypeId: item.ticketTypeId,
              quantity: item.quantity,
              baseUnitPriceCents: item.baseUnitPriceCents,
              discountType: item.discountType,
              discountValue: item.discountValue,
              discountedUnitPriceCents: item.discountedUnitPriceCents,
              lineBaseTotalCents: item.lineBaseTotalCents,
              lineFinalTotalCents: item.lineFinalTotalCents,
            })),
          },
        },
        include: promotionInclude,
      });
    });

    return {
      message: 'Promocion creada correctamente.',
      promotion: toPromotionResponse(promotion, this.config),
    };
  }

  async listPromotions(
    currentUser: AuthenticatedUser,
    clubId: string,
    filters: { eventId?: string; status?: PromotionStatus },
  ) {
    await this.assertCanManageClub(currentUser, clubId);

    const promotions = await this.prisma.promotion.findMany({
      where: {
        clubId,
        ...(filters.eventId ? { eventId: filters.eventId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      include: promotionInclude,
    });

    return {
      message: 'Promociones del club obtenidas correctamente.',
      promotions: promotions.map((promotion) => toPromotionResponse(promotion, this.config)),
    };
  }

  async getPromotion(currentUser: AuthenticatedUser, clubId: string, promotionId: string) {
    await this.assertCanManageClub(currentUser, clubId);
    const promotion = await this.findPromotionOrFail(clubId, promotionId);

    return {
      message: 'Promocion obtenida correctamente.',
      promotion: toPromotionResponse(promotion, this.config),
    };
  }

  async updatePromotion(
    currentUser: AuthenticatedUser,
    clubId: string,
    promotionId: string,
    input: UpdatePromotionDto,
  ) {
    await this.assertCanManageClub(currentUser, clubId);
    const currentPromotion = await this.findPromotionOrFail(clubId, promotionId);
    const nextEventId = input.eventId !== undefined ? input.eventId ?? null : currentPromotion.eventId;
    await this.assertEventBelongsToClub(clubId, nextEventId ?? undefined);
    this.assertImageMutationInput(input.imageUploadId, input.removeImage);

    const startsAt = input.startsAt !== undefined
      ? parseOptionalDate(input.startsAt)
      : currentPromotion.startsAt;
    const endsAt = input.endsAt !== undefined
      ? parseOptionalDate(input.endsAt)
      : currentPromotion.endsAt;
    assertDateRange(startsAt, endsAt);

    const resolvedItems = input.items
      ? await this.resolveItems(clubId, nextEventId ?? undefined, input.items)
      : currentPromotion.items.map(toResolvedItemFromEntity);
    const pricingMode = input.pricingMode ?? currentPromotion.pricingMode;
    const totals = resolvePromotionTotals({
      pricingMode,
      finalPrice: input.finalPrice ?? currentPromotion.finalPriceCents / 100,
      items: resolvedItems,
    });

    const data: {
      eventId?: string | null;
      name?: string;
      description?: string | null;
      imageUrl?: string | null;
      pricingMode?: PromotionPricingMode;
      basePriceCents?: number;
      finalPriceCents?: number;
      currency?: string;
      startsAt?: Date | null;
      endsAt?: Date | null;
    } = {
      pricingMode,
      basePriceCents: totals.basePriceCents,
      finalPriceCents: totals.finalPriceCents,
    };

    if (input.eventId !== undefined) data.eventId = input.eventId ?? null;
    if (input.name !== undefined) data.name = normalizeText(input.name);
    if (input.description !== undefined) data.description = normalizeOptionalText(input.description);
    if (input.currency !== undefined) data.currency = normalizeCurrency(input.currency);
    if (input.startsAt !== undefined) data.startsAt = startsAt;
    if (input.endsAt !== undefined) data.endsAt = endsAt;

    const promotion = await this.prisma.$transaction(async (tx) => {
      if (input.imageUploadId) {
        const replacement = await this.uploadsService.replaceUpload({
          uploadId: input.imageUploadId,
          userId: currentUser.id,
          previousObjectKey: currentPromotion.imageUrl,
          transaction: tx,
        });
        data.imageUrl = replacement.objectKey;
      } else if (input.removeImage) {
        data.imageUrl = null;
        await this.uploadsService.queueObjectDeletion(currentPromotion.imageUrl, tx);
      }

      if (input.items) {
        await tx.promotionItem.deleteMany({ where: { promotionId } });
      }

      return tx.promotion.update({
        where: { id: promotionId },
        data: {
          ...data,
          ...(input.items
            ? {
                items: {
                  create: resolvedItems.map((item) => ({
                    itemType: item.itemType,
                    productId: item.productId,
                    ticketTypeId: item.ticketTypeId,
                    quantity: item.quantity,
                    baseUnitPriceCents: item.baseUnitPriceCents,
                    discountType: item.discountType,
                    discountValue: item.discountValue,
                    discountedUnitPriceCents: item.discountedUnitPriceCents,
                    lineBaseTotalCents: item.lineBaseTotalCents,
                    lineFinalTotalCents: item.lineFinalTotalCents,
                  })),
                },
              }
            : {}),
        },
        include: promotionInclude,
      });
    });

    return {
      message: 'Promocion actualizada correctamente.',
      promotion: toPromotionResponse(promotion, this.config),
    };
  }

  async activatePromotion(currentUser: AuthenticatedUser, clubId: string, promotionId: string) {
    await this.assertCanManageClub(currentUser, clubId);
    await this.findPromotionOrFail(clubId, promotionId);

    const promotion = await this.prisma.promotion.update({
      where: { id: promotionId },
      data: { status: PromotionStatus.ACTIVE },
      include: promotionInclude,
    });

    return {
      message: 'Promocion activada correctamente.',
      promotion: toPromotionResponse(promotion, this.config),
    };
  }

  async deactivatePromotion(currentUser: AuthenticatedUser, clubId: string, promotionId: string) {
    await this.assertCanManageClub(currentUser, clubId);
    await this.findPromotionOrFail(clubId, promotionId);

    const promotion = await this.prisma.promotion.update({
      where: { id: promotionId },
      data: { status: PromotionStatus.INACTIVE },
      include: promotionInclude,
    });

    return {
      message: 'Promocion desactivada correctamente.',
      promotion: toPromotionResponse(promotion, this.config),
    };
  }

  async deletePromotion(currentUser: AuthenticatedUser, clubId: string, promotionId: string) {
    await this.assertCanManageClub(currentUser, clubId);
    const promotion = await this.findPromotionOrFail(clubId, promotionId);

    await this.prisma.$transaction(async (tx) => {
      await tx.promotion.delete({ where: { id: promotionId } });
      await this.uploadsService.queueObjectDeletion(promotion.imageUrl, tx);
    });

    return {
      message: 'Promocion eliminada correctamente.',
    };
  }

  private async resolveItems(clubId: string, eventId: string | undefined, items: PromotionItemDto[]) {
    const resolvedItems = await Promise.all(
      items.map(async (item) => {
        if (item.itemType === PromotionItemType.PRODUCT) {
          if (!item.productId || item.ticketTypeId) {
            throw badRequest(
              'PROMOTION_ITEM_PRODUCT_INVALID',
              'Cada item PRODUCT debe incluir solo productId.',
            );
          }

          const product = await this.prisma.product.findFirst({
            where: {
              id: item.productId,
              clubId,
              status: { in: [ProductStatus.ACTIVE, ProductStatus.OUT_OF_STOCK, ProductStatus.INACTIVE] },
            },
          });

          if (!product) {
            throw notFound('PRODUCT_NOT_FOUND', 'No encontramos uno de los productos seleccionados.');
          }

          return resolveLineItem({
            itemType: item.itemType,
            productId: product.id,
            ticketTypeId: null,
            quantity: item.quantity,
            baseUnitPriceCents: product.priceCents,
            discountType: item.discountType ?? PromotionDiscountType.NONE,
            discountValueInput: item.discountValue ?? 0,
          });
        }

        if (!item.ticketTypeId || item.productId) {
          throw badRequest(
            'PROMOTION_ITEM_TICKET_INVALID',
            'Cada item TICKET debe incluir solo ticketTypeId.',
          );
        }

        const ticketType = await this.prisma.ticketType.findFirst({
          where: {
            id: item.ticketTypeId,
            clubId,
            ...(eventId ? { eventId } : { eventId: null }),
            status: {
              in: [TicketTypeStatus.ACTIVE, TicketTypeStatus.SOLD_OUT, TicketTypeStatus.INACTIVE],
            },
          },
        });

        if (!ticketType) {
          throw notFound('TICKET_TYPE_NOT_FOUND', 'No encontramos una de las entradas seleccionadas.');
        }

        return resolveLineItem({
          itemType: item.itemType,
          productId: null,
          ticketTypeId: ticketType.id,
          quantity: item.quantity,
          baseUnitPriceCents: ticketType.priceCents,
          discountType: item.discountType ?? PromotionDiscountType.NONE,
          discountValueInput: item.discountValue ?? 0,
        });
      }),
    );

    if (resolvedItems.length === 0) {
      throw badRequest('PROMOTION_ITEMS_REQUIRED', 'La promocion debe incluir al menos un item.');
    }

    return resolvedItems;
  }

  private async assertEventBelongsToClub(clubId: string, eventId?: string | null) {
    if (!eventId) {
      return;
    }

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, clubId },
      select: { id: true },
    });

    if (!event) {
      throw notFound('EVENT_NOT_FOUND', 'No encontramos el evento seleccionado.');
    }
  }

  private async assertCanManageClub(currentUser: AuthenticatedUser, clubId: string) {
    const club = await this.prisma.club.findUnique({ where: { id: clubId }, select: { id: true } });
    if (!club) {
      throw notFound('CLUB_NOT_FOUND', 'No encontramos el club solicitado.');
    }

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      return;
    }

    if (currentUser.role !== UserRole.ADMIN) {
      throw forbidden('CLUB_MANAGE_FORBIDDEN', 'No tienes permisos para administrar este club.');
    }

    const clubAdmin = await this.prisma.clubAdmin.findUnique({
      where: { clubId_userId: { clubId, userId: currentUser.id } },
      select: { id: true },
    });

    if (!clubAdmin) {
      throw forbidden('CLUB_MANAGE_FORBIDDEN', 'No tienes permisos para administrar este club.');
    }
  }

  private async findPromotionOrFail(clubId: string, promotionId: string) {
    const promotion = await this.prisma.promotion.findFirst({
      where: { id: promotionId, clubId },
      include: promotionInclude,
    });

    if (!promotion) {
      throw notFound('PROMOTION_NOT_FOUND', 'No encontramos la promocion solicitada.');
    }

    return promotion;
  }

  private assertImageMutationInput(imageUploadId?: string, removeImage?: boolean) {
    if (imageUploadId && removeImage) {
      throw badRequest(
        'PROMOTION_IMAGE_INPUT_CONFLICT',
        'No puedes enviar imageUploadId y removeImage al mismo tiempo.',
      );
    }
  }
}

const promotionInclude = {
  club: { select: { id: true, name: true } },
  event: { select: { id: true, name: true, startsAt: true, endsAt: true } },
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      product: { select: { id: true, name: true, imageUrl: true, priceCents: true, currency: true } },
      ticketType: {
        select: {
          id: true,
          name: true,
          priceCents: true,
          currency: true,
          eventId: true,
        },
      },
    },
  },
} as const;

const normalizeText = (value: string) => value.trim();
const normalizeOptionalText = (value?: string) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};
const normalizeCurrency = (value?: string) => (value?.trim().toUpperCase() || 'PEN').slice(0, 3);
const priceToCents = (value: number) => Math.round(value * 100);
const centsToPrice = (value: number) => value / 100;
const parseOptionalDate = (value?: string | null) => (value ? new Date(value) : null);

const assertDateRange = (startsAt: Date | null, endsAt: Date | null) => {
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw badRequest(
      'PROMOTION_DATE_RANGE_INVALID',
      'La fecha de fin de la promocion debe ser posterior a la fecha de inicio.',
    );
  }
};

type ResolvedPromotionItem = {
  itemType: PromotionItemType;
  productId: string | null;
  ticketTypeId: string | null;
  quantity: number;
  baseUnitPriceCents: number;
  discountType: PromotionDiscountType;
  discountValue: number;
  discountedUnitPriceCents: number;
  lineBaseTotalCents: number;
  lineFinalTotalCents: number;
};

const resolveLineItem = (input: {
  itemType: PromotionItemType;
  productId: string | null;
  ticketTypeId: string | null;
  quantity: number;
  baseUnitPriceCents: number;
  discountType: PromotionDiscountType;
  discountValueInput: number;
}): ResolvedPromotionItem => {
  const discountType = input.discountType ?? PromotionDiscountType.NONE;
  let normalizedDiscountValue = 0;
  let discountedUnitPriceCents = input.baseUnitPriceCents;

  if (discountType === PromotionDiscountType.PERCENTAGE) {
    if (input.discountValueInput < 0 || input.discountValueInput > 100) {
      throw badRequest(
        'PROMOTION_DISCOUNT_PERCENTAGE_INVALID',
        'El descuento porcentual debe estar entre 0 y 100.',
      );
    }

    normalizedDiscountValue = Math.round(input.discountValueInput);
    discountedUnitPriceCents = Math.max(
      input.baseUnitPriceCents - Math.round((input.baseUnitPriceCents * normalizedDiscountValue) / 100),
      0,
    );
  } else if (discountType === PromotionDiscountType.FIXED_AMOUNT) {
    normalizedDiscountValue = priceToCents(input.discountValueInput);
    if (normalizedDiscountValue < 0) {
      throw badRequest(
        'PROMOTION_DISCOUNT_AMOUNT_INVALID',
        'El descuento fijo no puede ser negativo.',
      );
    }
    discountedUnitPriceCents = Math.max(input.baseUnitPriceCents - normalizedDiscountValue, 0);
  }

  const lineBaseTotalCents = input.baseUnitPriceCents * input.quantity;
  const lineFinalTotalCents = discountedUnitPriceCents * input.quantity;

  return {
    itemType: input.itemType,
    productId: input.productId,
    ticketTypeId: input.ticketTypeId,
    quantity: input.quantity,
    baseUnitPriceCents: input.baseUnitPriceCents,
    discountType,
    discountValue: normalizedDiscountValue,
    discountedUnitPriceCents,
    lineBaseTotalCents,
    lineFinalTotalCents,
  };
};

const resolvePromotionTotals = (input: {
  pricingMode?: PromotionPricingMode;
  finalPrice?: number;
  items: ResolvedPromotionItem[];
}) => {
  const pricingMode = input.pricingMode ?? PromotionPricingMode.CALCULATED;
  const basePriceCents = input.items.reduce((sum, item) => sum + item.lineBaseTotalCents, 0);
  const calculatedFinalPriceCents = input.items.reduce((sum, item) => sum + item.lineFinalTotalCents, 0);

  if (pricingMode === PromotionPricingMode.MANUAL_FINAL_PRICE) {
    if (input.finalPrice === undefined) {
      throw badRequest(
        'PROMOTION_FINAL_PRICE_REQUIRED',
        'El precio final es obligatorio cuando la promocion usa precio manual.',
      );
    }

    return {
      basePriceCents,
      finalPriceCents: priceToCents(input.finalPrice),
    };
  }

  return {
    basePriceCents,
    finalPriceCents: calculatedFinalPriceCents,
  };
};

const toResolvedItemFromEntity = (item: {
  itemType: PromotionItemType;
  productId: string | null;
  ticketTypeId: string | null;
  quantity: number;
  baseUnitPriceCents: number;
  discountType: PromotionDiscountType;
  discountValue: number;
  discountedUnitPriceCents: number;
  lineBaseTotalCents: number;
  lineFinalTotalCents: number;
}): ResolvedPromotionItem => ({
  itemType: item.itemType,
  productId: item.productId,
  ticketTypeId: item.ticketTypeId,
  quantity: item.quantity,
  baseUnitPriceCents: item.baseUnitPriceCents,
  discountType: item.discountType,
  discountValue: item.discountValue,
  discountedUnitPriceCents: item.discountedUnitPriceCents,
  lineBaseTotalCents: item.lineBaseTotalCents,
  lineFinalTotalCents: item.lineFinalTotalCents,
});

const toPromotionResponse = (
  promotion: {
    id: string;
    clubId: string;
    eventId: string | null;
    name: string;
    description: string | null;
    imageUrl: string | null;
    pricingMode: PromotionPricingMode;
    basePriceCents: number;
    finalPriceCents: number;
    currency: string;
    status: PromotionStatus;
    startsAt: Date | null;
    endsAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    club: { id: string; name: string };
    event: { id: string; name: string; startsAt: Date; endsAt: Date } | null;
    items: Array<{
      id: string;
      itemType: PromotionItemType;
      productId: string | null;
      ticketTypeId: string | null;
      quantity: number;
      baseUnitPriceCents: number;
      discountType: PromotionDiscountType;
      discountValue: number;
      discountedUnitPriceCents: number;
      lineBaseTotalCents: number;
      lineFinalTotalCents: number;
      createdAt: Date;
      updatedAt: Date;
      product: { id: string; name: string; imageUrl: string | null; priceCents: number; currency: string } | null;
      ticketType: { id: string; name: string; priceCents: number; currency: string; eventId: string | null } | null;
    }>;
  },
  config: ConfigService,
) => ({
  id: promotion.id,
  clubId: promotion.clubId,
  eventId: promotion.eventId,
  scope: promotion.eventId != null ? 'event' : 'club',
  name: promotion.name,
  description: promotion.description,
  imageUrl: buildMediaUrl(promotion.imageUrl, config),
  imageObjectKey: promotion.imageUrl,
  pricingMode: promotion.pricingMode,
  basePrice: centsToPrice(promotion.basePriceCents),
  finalPrice: centsToPrice(promotion.finalPriceCents),
  currency: promotion.currency,
  status: promotion.status,
  startsAt: promotion.startsAt,
  endsAt: promotion.endsAt,
  createdAt: promotion.createdAt,
  updatedAt: promotion.updatedAt,
  club: promotion.club,
  event: promotion.event,
  items: promotion.items.map((item) => ({
    id: item.id,
    itemType: item.itemType,
    productId: item.productId,
    ticketTypeId: item.ticketTypeId,
    quantity: item.quantity,
    baseUnitPrice: centsToPrice(item.baseUnitPriceCents),
    discountType: item.discountType,
    discountValue: item.discountType === PromotionDiscountType.FIXED_AMOUNT
      ? centsToPrice(item.discountValue)
      : item.discountValue,
    discountedUnitPrice: centsToPrice(item.discountedUnitPriceCents),
    lineBaseTotal: centsToPrice(item.lineBaseTotalCents),
    lineFinalTotal: centsToPrice(item.lineFinalTotalCents),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    product: item.product
      ? {
          id: item.product.id,
          name: item.product.name,
          imageUrl: buildMediaUrl(item.product.imageUrl, config),
          price: centsToPrice(item.product.priceCents),
          currency: item.product.currency,
        }
      : null,
    ticketType: item.ticketType
      ? {
          id: item.ticketType.id,
          name: item.ticketType.name,
          price: centsToPrice(item.ticketType.priceCents),
          currency: item.ticketType.currency,
          eventId: item.ticketType.eventId,
        }
      : null,
  })),
});
