import { ApiProperty } from '@nestjs/swagger';
import {
  ClubStatus,
  EventStatus,
  FeaturedTargetType,
  ProductStatus,
  PromotionStatus,
  TicketTypeStatus,
  UserRole,
} from '@prisma/client';
import { ClubContactResponseDto, ClubScheduleResponseDto } from './club-profile.response.dto';

export class CustomerHomeFeaturedItemDto {
  @ApiProperty({ type: 'string' })
  campaignId!: string;

  @ApiProperty({ enum: FeaturedTargetType, enumName: 'FeaturedTargetType' })
  targetType!: FeaturedTargetType;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string', nullable: true })
  eventId!: string | null;

  @ApiProperty({ type: 'boolean' })
  isSponsored!: boolean;
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

  @ApiProperty({ type: 'string' })
  type!: string;

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

  @ApiProperty({ type: 'string' })
  scope!: string;
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

export class CustomerHomeResponseDto {
  @ApiProperty({ type: () => [CustomerHomeFeaturedItemDto] })
  featuredItems!: CustomerHomeFeaturedItemDto[];

  @ApiProperty({ type: () => CustomerViewerDto })
  viewer!: CustomerViewerDto;

  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => CustomerLocationDto })
  location!: CustomerLocationDto;

  @ApiProperty({ type: 'boolean' })
  hasResults!: boolean;

  @ApiProperty({ type: () => [CustomerClubDto] })
  clubs!: CustomerClubDto[];

  @ApiProperty({ type: () => [CustomerEventDto] })
  events!: CustomerEventDto[];

  @ApiProperty({ type: () => [CustomerTicketTypeDto] })
  tickets!: CustomerTicketTypeDto[];

  @ApiProperty({ type: () => [CustomerPromotionDto] })
  promotions!: CustomerPromotionDto[];

  @ApiProperty({ type: () => [CustomerProductDto] })
  products!: CustomerProductDto[];

  @ApiProperty({ type: () => CustomerDiscoveryEmptyStateDto, nullable: true })
  emptyState!: CustomerDiscoveryEmptyStateDto | null;
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

  @ApiProperty({ type: 'number' })
  finalPrice!: number;

  @ApiProperty({ type: 'string' })
  scope!: string;
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

  @ApiProperty({ type: () => [CustomerClubDto] })
  clubs!: CustomerClubDto[];

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

  @ApiProperty({ type: 'string' })
  scope!: string;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  startsAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  endsAt!: Date | null;
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
