import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import {
  ClubStatus,
  EventStatus,
  FeaturedTargetType,
  ProductStatus,
  PromotionItemType,
  PromotionStatus,
  TicketTypeStatus,
  UserRole,
} from '@prisma/client';
import { OfferScope } from '../../../shared/domain/offer-scope';
import { BusinessType } from '../domain/business-type';
import {
  CustomerClubEmptyReason,
  CustomerCommerceStatus,
  CustomerHomeEmptyReason,
} from '../domain/customer-discovery-status';
import { ClubContactResponseDto, ClubScheduleResponseDto } from './club-profile.response.dto';

class CustomerHomeFeaturedBaseDto {
  @ApiProperty({ type: 'string' })
  campaignId!: string;

  @ApiProperty({ type: 'string' })
  targetId!: string;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ type: 'string' })
  imageUrl!: string;

  @ApiProperty({ type: 'string' })
  context!: string;

  @ApiProperty({ type: 'boolean' })
  isSponsored!: boolean;
}

export class CustomerHomeFeaturedClubDto extends CustomerHomeFeaturedBaseDto {
  @ApiProperty({ enum: [FeaturedTargetType.BUSINESS] })
  targetType!: 'BUSINESS';

  @ApiProperty({ type: 'string', nullable: true, example: null })
  eventId!: null;
}

export class CustomerHomeFeaturedEventDto extends CustomerHomeFeaturedBaseDto {
  @ApiProperty({ enum: [FeaturedTargetType.EVENT] })
  targetType!: 'EVENT';

  @ApiProperty({ type: 'string' })
  eventId!: string;
}

export class CustomerViewerDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role!: UserRole;
}

export class CustomerLocationDto {
  @ApiProperty({ type: 'string' })
  district!: string;

  @ApiProperty({ type: 'string' })
  province!: string;

  @ApiProperty({ type: 'string' })
  department!: string;
}

export class CustomerClubAddressDto {
  @ApiProperty({ type: 'string' })
  direccion!: string;

  @ApiProperty({ type: 'string' })
  distrito!: string;

  @ApiProperty({ type: 'string' })
  provincia!: string;

  @ApiProperty({ type: 'string' })
  departamento!: string;

  @ApiProperty({ type: 'string' })
  pais!: string;
}

export class CustomerClubDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ enum: BusinessType, enumName: 'BusinessType' })
  type!: BusinessType;

  @ApiProperty({ type: 'string', nullable: true })
  profileImage!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  coverImage!: string | null;

  @ApiProperty({ type: () => CustomerClubAddressDto })
  address!: CustomerClubAddressDto;

  @ApiProperty({ type: () => ClubContactResponseDto })
  contact!: ClubContactResponseDto;

  @ApiProperty({ type: () => [ClubScheduleResponseDto] })
  schedule!: ClubScheduleResponseDto[];

  @ApiProperty({ type: 'boolean' })
  isOpenNow!: boolean;

  @ApiProperty({ enum: ClubStatus, enumName: 'ClubStatus' })
  status!: ClubStatus;
}

export class CustomerHomeClubDto extends CustomerClubDto {
  @ApiProperty({
    enum: CustomerCommerceStatus,
    enumName: 'CustomerCommerceStatus',
    description: 'Indica si este Local puede ofrecer compras mediante Beerry.',
    example: CustomerCommerceStatus.AVAILABLE,
  })
  commerceStatus!: CustomerCommerceStatus;

  @ApiProperty({
    enum: CustomerClubEmptyReason,
    enumName: 'CustomerClubEmptyReason',
    nullable: true,
    description: 'Causa de ausencia de Eventos y Ofertas; null cuando hay contenido visible.',
    example: CustomerClubEmptyReason.NO_EVENTS_OR_OFFERS,
  })
  emptyReason!: CustomerClubEmptyReason | null;
}

export class CustomerEventDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string' })
  clubName!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  startsAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  endsAt!: Date;

  @ApiProperty({ enum: EventStatus, enumName: 'EventStatus' })
  status!: EventStatus;

  @ApiProperty({ type: 'integer' })
  capacity!: number;

  @ApiProperty({ type: 'integer' })
  sold!: number;

  @ApiProperty({ type: 'number', nullable: true })
  priceFrom!: number | null;

  @ApiProperty({ type: 'string' })
  currency!: string;
}

export class CustomerHomeEventDto extends CustomerEventDto {
  @ApiProperty({ type: 'integer' })
  available!: number;

  @ApiProperty({ enum: ['AVAILABLE', 'UNAVAILABLE', 'SOLD_OUT', 'INFORMATIONAL'] })
  accessStatus!: 'AVAILABLE' | 'UNAVAILABLE' | 'SOLD_OUT' | 'INFORMATIONAL';

  @ApiProperty({ enum: ['ONGOING', 'TONIGHT', 'FUTURE', 'POSTPONED'] })
  timing!: 'ONGOING' | 'TONIGHT' | 'FUTURE' | 'POSTPONED';
}

export class CustomerTicketTypeDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string' })
  clubName!: string;

  @ApiProperty({ type: 'string', nullable: true })
  eventId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  eventName!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ type: 'number' })
  price!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'integer' })
  quantityAvailable!: number;

  @ApiProperty({ type: 'integer', nullable: true })
  perUserLimit!: number | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  saleStartAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  saleEndAt!: Date | null;

  @ApiProperty({ enum: TicketTypeStatus, enumName: 'TicketTypeStatus' })
  status!: TicketTypeStatus;
}

export class CustomerPromotionComponentDto {
  @ApiProperty({
    enum: PromotionItemType,
    enumName: 'PromotionItemType',
    description: 'Tipo de componente incluido en la Promoción.',
    example: PromotionItemType.PRODUCT,
  })
  type!: PromotionItemType;

  @ApiProperty({
    type: 'string',
    description: 'Nombre del Producto o la Entrada.',
    example: 'Agua',
  })
  name!: string;

  @ApiProperty({ type: 'integer', minimum: 1, description: 'Unidades incluidas.', example: 2 })
  quantity!: number;
}

export class CustomerPromotionDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string' })
  clubName!: string;

  @ApiProperty({ type: 'string', nullable: true })
  eventId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  eventName!: string | null;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ type: 'number' })
  finalPrice!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  startsAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  endsAt!: Date | null;

  @ApiProperty({ enum: PromotionStatus, enumName: 'PromotionStatus' })
  status!: PromotionStatus;

  @ApiProperty({ type: 'integer' })
  itemsCount!: number;

  @ApiProperty({
    type: () => [CustomerPromotionComponentDto],
    description: 'Componentes que el comprador recibirá con la Promoción.',
    example: [{ type: 'PRODUCT', name: 'Agua', quantity: 2 }],
  })
  items!: CustomerPromotionComponentDto[];

  @ApiProperty({ enum: OfferScope, enumName: 'OfferScope' })
  scope!: OfferScope;
}

export class CustomerProductDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string' })
  clubName!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ type: 'number' })
  price!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'integer' })
  stockQuantity!: number;

  @ApiProperty({ enum: ProductStatus, enumName: 'ProductStatus' })
  status!: ProductStatus;
}

export class DiscoveryEmptySectionsDto {
  @ApiProperty({ type: 'string' })
  clubs!: string;

  @ApiProperty({ type: 'string' })
  events!: string;

  @ApiProperty({ type: 'string' })
  promotions!: string;

  @ApiProperty({ type: 'string' })
  products!: string;
}

export class CustomerDiscoveryEmptyStateDto {
  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ type: 'string' })
  text!: string;

  @ApiProperty({ type: () => DiscoveryEmptySectionsDto })
  sections!: DiscoveryEmptySectionsDto;
}

export class CustomerHomeCountsDto {
  @ApiProperty({
    type: 'integer',
    description: 'Total de Locales elegibles en el ámbito de Inicio.',
    example: 3,
  })
  clubs!: number;

  @ApiProperty({
    type: 'integer',
    description: 'Total de Locales elegibles con pagos vigentes.',
    example: 2,
  })
  paymentReadyClubs!: number;

  @ApiProperty({
    type: 'integer',
    description: 'Total de Locales elegibles sin pagos vigentes.',
    example: 1,
  })
  paymentsUnavailableClubs!: number;

  @ApiProperty({
    type: 'integer',
    description:
      'Total de Eventos del catálogo cercano, incluidos los pospuestos fuera de la vista previa.',
    example: 1,
  })
  events!: number;

  @ApiProperty({
    type: 'integer',
    description: 'Total de Promociones elegibles en el ámbito de Inicio.',
    example: 0,
  })
  promotions!: number;
}

export class CustomerHomeEmptyReasonsDto {
  @ApiProperty({
    enum: CustomerHomeEmptyReason,
    enumName: 'CustomerHomeEmptyReason',
    nullable: true,
    description: 'Causa de ausencia de Locales; null cuando hay al menos uno.',
    example: CustomerHomeEmptyReason.NO_ACTIVE_CLUBS_IN_SCOPE,
  })
  clubs!: CustomerHomeEmptyReason | null;

  @ApiProperty({
    enum: CustomerHomeEmptyReason,
    enumName: 'CustomerHomeEmptyReason',
    nullable: true,
    description: 'Causa de ausencia de Eventos en la vista previa; null cuando hay al menos uno.',
    example: CustomerHomeEmptyReason.NO_VISIBLE_EVENTS,
  })
  events!: CustomerHomeEmptyReason | null;

  @ApiProperty({
    enum: CustomerHomeEmptyReason,
    enumName: 'CustomerHomeEmptyReason',
    nullable: true,
    description: 'Causa de ausencia de Promociones; null cuando hay al menos una.',
    example: CustomerHomeEmptyReason.NO_ACTIVE_PROMOTIONS,
  })
  promotions!: CustomerHomeEmptyReason | null;
}

@ApiExtraModels(CustomerHomeFeaturedClubDto, CustomerHomeFeaturedEventDto)
export class CustomerHomeResponseDto {
  @ApiProperty({
    type: 'array',
    items: {
      oneOf: [
        { $ref: getSchemaPath(CustomerHomeFeaturedClubDto) },
        { $ref: getSchemaPath(CustomerHomeFeaturedEventDto) },
      ],
      discriminator: {
        propertyName: 'targetType',
        mapping: {
          BUSINESS: getSchemaPath(CustomerHomeFeaturedClubDto),
          EVENT: getSchemaPath(CustomerHomeFeaturedEventDto),
        },
      },
    },
  })
  featuredItems!: Array<CustomerHomeFeaturedClubDto | CustomerHomeFeaturedEventDto>;

  @ApiProperty({ type: () => CustomerViewerDto })
  viewer!: CustomerViewerDto;

  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => CustomerLocationDto })
  location!: CustomerLocationDto;

  @ApiProperty({ type: 'boolean' })
  hasResults!: boolean;

  @ApiProperty({ type: () => [CustomerHomeClubDto] })
  clubs!: CustomerHomeClubDto[];

  @ApiProperty({
    type: () => CustomerHomeCountsDto,
    description: 'Totales elegibles de las secciones de Inicio, antes del límite de vista previa.',
  })
  counts!: CustomerHomeCountsDto;

  @ApiProperty({
    type: () => CustomerHomeEmptyReasonsDto,
    description: 'Causas vacías por sección.',
  })
  emptyReasons!: CustomerHomeEmptyReasonsDto;

  @ApiProperty({ type: () => [CustomerHomeEventDto] })
  events!: CustomerHomeEventDto[];

  @ApiProperty({ type: () => [CustomerPromotionDto] })
  promotions!: CustomerPromotionDto[];
}

export class CustomerExplorePromotionDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ enum: PromotionStatus, enumName: 'PromotionStatus' })
  status!: PromotionStatus;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'string', nullable: true })
  eventId!: string | null;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ type: 'string' })
  clubName!: string;

  @ApiProperty({ type: 'string', nullable: true })
  eventName!: string | null;

  @ApiProperty({ type: 'integer' })
  itemsCount!: number;

  @ApiProperty({
    type: () => [CustomerPromotionComponentDto],
    description: 'Componentes de la Promoción en Explorar.',
    example: [{ type: 'PRODUCT', name: 'Agua', quantity: 2 }],
  })
  items!: CustomerPromotionComponentDto[];

  @ApiProperty({ type: 'number' })
  finalPrice!: number;

  @ApiProperty({ enum: OfferScope, enumName: 'OfferScope' })
  scope!: OfferScope;
}

export class CustomerExploreResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => [CustomerTicketTypeDto] })
  tickets!: CustomerTicketTypeDto[];

  @ApiProperty({ type: () => [CustomerEventDto] })
  events!: CustomerEventDto[];

  @ApiProperty({ type: () => [CustomerProductDto] })
  products!: CustomerProductDto[];

  @ApiProperty({ type: () => CustomerLocationDto })
  location!: CustomerLocationDto;

  @ApiProperty({ type: () => CustomerViewerDto })
  viewer!: CustomerViewerDto;

  @ApiProperty({ type: 'boolean' })
  hasResults!: boolean;

  @ApiProperty({ type: () => [CustomerClubDto] })
  clubs!: CustomerClubDto[];

  @ApiProperty({ type: () => CustomerDiscoveryEmptyStateDto, nullable: true })
  emptyState!: CustomerDiscoveryEmptyStateDto | null;

  @ApiProperty({ type: 'string' })
  query!: string;

  @ApiProperty({ enum: ['PERU'], enumName: 'CustomerExploreResponseScope' })
  scope!: 'PERU';

  @ApiProperty({ type: () => [CustomerExplorePromotionDto] })
  promotions!: CustomerExplorePromotionDto[];
}

export class CustomerClubDetailResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => [CustomerTicketTypeDto] })
  tickets!: CustomerTicketTypeDto[];

  @ApiProperty({ type: () => [CustomerPromotionDto] })
  promotions!: CustomerPromotionDto[];

  @ApiProperty({ type: () => [CustomerEventDto] })
  events!: CustomerEventDto[];

  @ApiProperty({ type: () => [CustomerProductDto] })
  products!: CustomerProductDto[];

  @ApiProperty({ type: () => CustomerLocationDto })
  location!: CustomerLocationDto;

  @ApiProperty({ type: () => CustomerViewerDto })
  viewer!: CustomerViewerDto;

  @ApiProperty({ type: () => [CustomerHomeClubDto] })
  clubs!: CustomerHomeClubDto[];

  @ApiProperty({ type: () => CustomerDiscoveryEmptyStateDto, nullable: true })
  emptyState!: CustomerDiscoveryEmptyStateDto | null;

  @ApiProperty({ type: 'boolean' })
  hasResults!: boolean;
}

export class CustomerEventDetailEventDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string' })
  clubName!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  startsAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  endsAt!: Date;

  @ApiProperty({ enum: EventStatus, enumName: 'EventStatus' })
  status!: EventStatus;

  @ApiProperty({ type: 'number', nullable: true })
  priceFrom!: number | null;

  @ApiProperty({ type: 'string' })
  currency!: string;
}

export class CustomerEventDetailTicketDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string' })
  clubName!: string;

  @ApiProperty({ type: 'string' })
  eventId!: string;

  @ApiProperty({ type: 'string' })
  eventName!: string;

  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ type: 'number' })
  price!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'integer' })
  quantityAvailable!: number;

  @ApiProperty({ type: 'integer', nullable: true })
  perUserLimit!: number | null;

  @ApiProperty({ type: 'integer', nullable: true })
  remainingUserLimit!: number | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  saleStartAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  saleEndAt!: Date | null;

  @ApiProperty({ enum: TicketTypeStatus, enumName: 'TicketTypeStatus' })
  status!: TicketTypeStatus;
}

export class CustomerEventDetailPromotionDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string' })
  clubName!: string;

  @ApiProperty({ type: 'string' })
  eventId!: string;

  @ApiProperty({ type: 'string' })
  eventName!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ type: 'number' })
  finalPrice!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ enum: PromotionStatus, enumName: 'PromotionStatus' })
  status!: PromotionStatus;

  @ApiProperty({ type: 'integer' })
  itemsCount!: number;

  @ApiProperty({
    type: () => [CustomerPromotionComponentDto],
    description: 'Componentes de la Promoción en el detalle del Evento.',
    example: [{ type: 'TICKET', name: 'General', quantity: 1 }],
  })
  items!: CustomerPromotionComponentDto[];

  @ApiProperty({ enum: OfferScope, enumName: 'OfferScope' })
  scope!: OfferScope;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  startsAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  endsAt!: Date | null;
}

class CustomerNearbyCatalogPageDto {
  @ApiProperty({
    type: () => CustomerLocationDto,
    description: 'Ámbito administrativo aplicado al catálogo.',
    example: { district: 'Miraflores', province: 'Lima', department: 'Lima' },
  })
  location!: CustomerLocationDto;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Total de resultados antes de paginar.',
    example: 24,
  })
  total!: number;

  @ApiProperty({
    type: 'string',
    nullable: true,
    description: 'Continuación de la siguiente página; null al terminar.',
    example: null,
  })
  nextCursor!: string | null;
}

export class CustomerNearbyClubsResponseDto extends CustomerNearbyCatalogPageDto {
  @ApiProperty({
    type: () => [CustomerHomeClubDto],
    description: 'Locales de esta página en el orden de Inicio.',
    example: [],
  })
  items!: CustomerHomeClubDto[];
}

export class CustomerNearbyEventsResponseDto extends CustomerNearbyCatalogPageDto {
  @ApiProperty({
    type: () => [CustomerHomeEventDto],
    description: 'Eventos de esta página en el orden de Inicio, con pospuestos al final.',
    example: [],
  })
  items!: CustomerHomeEventDto[];
}

export class CustomerNearbyPromotionsResponseDto extends CustomerNearbyCatalogPageDto {
  @ApiProperty({
    type: () => [CustomerPromotionDto],
    description: 'Promociones de esta página en el orden de Inicio.',
    example: [],
  })
  items!: CustomerPromotionDto[];
}

export class CustomerEventDetailResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => CustomerViewerDto })
  viewer!: CustomerViewerDto;

  @ApiProperty({ type: () => CustomerEventDetailEventDto })
  event!: CustomerEventDetailEventDto;

  @ApiProperty({ type: () => CustomerClubDto })
  club!: CustomerClubDto;

  @ApiProperty({ type: () => [CustomerEventDetailTicketDto] })
  tickets!: CustomerEventDetailTicketDto[];

  @ApiProperty({ type: () => [CustomerEventDetailPromotionDto] })
  promotions!: CustomerEventDetailPromotionDto[];
}
