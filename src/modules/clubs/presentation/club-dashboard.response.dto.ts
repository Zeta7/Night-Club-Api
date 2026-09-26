import { ApiProperty } from '@nestjs/swagger';
import {
  ClubStatus,
  ClubWorkerStatus,
  CommerceItemType,
  EventStatus,
  OrderStatus,
  PaymentAttemptStatus,
  ProductStatus,
  PromotionStatus,
  UserRole,
  UserStatus,
  WorkerPermission,
} from '@prisma/client';
import { BusinessType } from '../domain/business-type';
import {
  ClubAddressResponseDto,
  ClubContactResponseDto,
  ClubScheduleResponseDto,
  ClubSocialMediaResponseDto,
} from './club-profile.response.dto';

export class DashboardClubDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ enum: BusinessType, enumName: 'BusinessType' })
  type!: BusinessType;

  @ApiProperty({ enum: ClubStatus, enumName: 'ClubStatus' })
  status!: ClubStatus;

  @ApiProperty({ type: 'string', nullable: true })
  profileImage!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  coverImage!: string | null;

  @ApiProperty({ type: () => ClubAddressResponseDto })
  address!: ClubAddressResponseDto;

  @ApiProperty({ type: () => ClubContactResponseDto })
  contact!: ClubContactResponseDto;

  @ApiProperty({ type: () => [ClubSocialMediaResponseDto] })
  socialMedia!: ClubSocialMediaResponseDto[];

  @ApiProperty({ type: () => [ClubScheduleResponseDto] })
  schedule!: ClubScheduleResponseDto[];
}

export class ClubDashboardEmptyStateDto {
  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ type: 'string' })
  text!: string;

  @ApiProperty({ type: 'string' })
  actionLabel!: string;
}

export class ClubDashboardFeatureDto {
  @ApiProperty({ type: 'string' })
  icon!: string;

  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ type: 'string' })
  text!: string;
}

export class DashboardWorkerUserDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  fullName!: string;

  @ApiProperty({ type: 'string' })
  phoneCountryCode!: string;

  @ApiProperty({ type: 'string' })
  phoneNumber!: string;

  @ApiProperty({ type: 'string', nullable: true })
  email!: string | null;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role!: UserRole;

  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' })
  status!: UserStatus;
}

export class ClubDashboardWorkerContextDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string' })
  userId!: string;

  @ApiProperty({ type: 'string', nullable: true })
  roleLabel!: string | null;

  @ApiProperty({ enum: ClubWorkerStatus, enumName: 'ClubWorkerStatus' })
  status!: ClubWorkerStatus;

  @ApiProperty({ enum: WorkerPermission, enumName: 'WorkerPermission', isArray: true })
  permissions!: WorkerPermission[];

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: () => DashboardWorkerUserDto })
  user!: DashboardWorkerUserDto;
}

export class DashboardCapacityDto {
  @ApiProperty({ type: 'integer' })
  current!: number;

  @ApiProperty({ type: 'integer' })
  total!: number;
}

export class DashboardCountsDto {
  @ApiProperty({ type: 'integer' })
  events!: number;

  @ApiProperty({ type: 'integer' })
  activeEvents!: number;

  @ApiProperty({ type: 'integer' })
  promotions!: number;

  @ApiProperty({ type: 'integer' })
  products!: number;
}

export class ClubDashboardSummaryDto {
  @ApiProperty({ type: () => DashboardCapacityDto })
  capacity!: DashboardCapacityDto;

  @ApiProperty({ type: () => DashboardCountsDto })
  counts!: DashboardCountsDto;
}

export class DashboardSalesMetricsDto {
  @ApiProperty({ type: 'number' })
  amount!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'number' })
  trendPercent!: number;
}

export class DashboardMetricsDto {
  @ApiProperty({ type: () => DashboardSalesMetricsDto })
  sales!: DashboardSalesMetricsDto;

  @ApiProperty({ type: 'integer' })
  purchases!: number;

  @ApiProperty({ type: 'integer' })
  validatedQr!: number;

  @ApiProperty({ type: 'integer' })
  customers!: number;
}

export class ClubDashboardUpcomingEventDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  startsAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  endsAt!: Date;

  @ApiProperty({ type: 'integer' })
  capacity!: number;

  @ApiProperty({ type: 'integer' })
  sold!: number;

  @ApiProperty({ type: 'number' })
  priceFrom!: number;

  @ApiProperty({ enum: EventStatus, enumName: 'EventStatus' })
  status!: EventStatus;
}

export class ClubDashboardQuickActionDto {
  @ApiProperty({ type: 'string' })
  key!: string;

  @ApiProperty({ type: 'string' })
  label!: string;

  @ApiProperty({ type: 'string' })
  icon!: string;
}

export class ClubDashboardAlertDto {
  @ApiProperty({ type: 'string' })
  type!: string;

  @ApiProperty({ type: 'string' })
  severity!: string;

  @ApiProperty({ type: 'string' })
  resourceId!: string;

  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ type: 'integer' })
  value!: number;
}

export class ClubDashboardLatestSaleItemDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ enum: CommerceItemType, enumName: 'CommerceItemType' })
  type!: CommerceItemType;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'integer' })
  quantity!: number;

  @ApiProperty({ type: 'integer' })
  totalCents!: number;
}

export class ClubDashboardLatestSaleDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  customerName!: string;

  @ApiProperty({ type: 'number' })
  amount!: number;

  @ApiProperty({ type: 'integer' })
  amountCents!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status!: OrderStatus;

  @ApiProperty({ enum: PaymentAttemptStatus, enumName: 'PaymentAttemptStatus', nullable: true })
  paymentStatus!: PaymentAttemptStatus | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  paidAt!: Date | null;

  @ApiProperty({ enum: [...Object.values(CommerceItemType), 'MIXED'], enumName: 'SaleCategory' })
  category!: CommerceItemType | 'MIXED';

  @ApiProperty({ type: () => [ClubDashboardLatestSaleItemDto] })
  items!: ClubDashboardLatestSaleItemDto[];
}

export class ClubDashboardTopProductDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'integer' })
  stockQuantity!: number;

  @ApiProperty({ type: 'number' })
  price!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ enum: ProductStatus, enumName: 'ProductStatus' })
  status!: ProductStatus;

  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;
}

export class ClubDashboardTopPromotionDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'number' })
  finalPrice!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ enum: PromotionStatus, enumName: 'PromotionStatus' })
  status!: PromotionStatus;

  @ApiProperty({ type: 'integer' })
  itemsCount!: number;

  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;
}

export class ClubDashboardRecentActivityDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  actorName!: string;

  @ApiProperty({ type: 'string' })
  action!: string;

  @ApiProperty({ type: 'string' })
  resourceType!: string;

  @ApiProperty({ type: 'string' })
  resourceId!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;
}

export class ClubDashboardResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: 'boolean' })
  hasClub!: boolean;

  @ApiProperty({ type: () => DashboardClubDto, nullable: true })
  club!: DashboardClubDto | null;

  @ApiProperty({ type: () => ClubDashboardEmptyStateDto, nullable: true })
  emptyState!: ClubDashboardEmptyStateDto | null;

  @ApiProperty({ type: () => [ClubDashboardFeatureDto] })
  features!: ClubDashboardFeatureDto[];

  @ApiProperty({ type: () => ClubDashboardWorkerContextDto, nullable: true })
  workerContext!: ClubDashboardWorkerContextDto | null;

  @ApiProperty({ type: () => ClubDashboardSummaryDto, nullable: true })
  summary!: ClubDashboardSummaryDto | null;

  @ApiProperty({ type: () => DashboardMetricsDto, nullable: true })
  metrics!: DashboardMetricsDto | null;

  @ApiProperty({ type: () => [ClubDashboardUpcomingEventDto] })
  upcomingEvents!: ClubDashboardUpcomingEventDto[];

  @ApiProperty({ type: () => [ClubDashboardQuickActionDto] })
  quickActions!: ClubDashboardQuickActionDto[];

  @ApiProperty({ type: () => [ClubDashboardAlertDto] })
  alerts!: ClubDashboardAlertDto[];

  @ApiProperty({ type: () => [ClubDashboardLatestSaleDto] })
  latestSales!: ClubDashboardLatestSaleDto[];

  @ApiProperty({ type: () => [ClubDashboardTopProductDto] })
  topProducts!: ClubDashboardTopProductDto[];

  @ApiProperty({ type: () => [ClubDashboardTopPromotionDto] })
  topPromotions!: ClubDashboardTopPromotionDto[];

  @ApiProperty({ type: () => [ClubDashboardRecentActivityDto] })
  recentActivity!: ClubDashboardRecentActivityDto[];
}
