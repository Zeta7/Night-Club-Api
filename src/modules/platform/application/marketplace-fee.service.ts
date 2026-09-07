import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketplaceFeeSource, UserRole } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { conflict, forbidden, notFound } from '../../../shared/presentation/api-exception';
import { AuditService } from '../../audit/application/audit.service';
import { AuthenticatedUser } from '../../identity/presentation/current-user';

const SETTINGS_ID = 'platform';

export type MarketplaceFeeSnapshot = {
  marketplaceFeeBps: number;
  marketplaceFeeCents: number;
  sellerExpectedNetCents: number;
  feeSource: MarketplaceFeeSource;
};

@Injectable()
export class MarketplaceFeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  calculate(customerFundedCents: number, feeBps: number): number {
    if (!Number.isSafeInteger(customerFundedCents) || customerFundedCents < 0)
      throw conflict('INVALID_EXTERNAL_AMOUNT', 'El monto externo debe ser un entero no negativo.');
    this.assertFee(feeBps);
    return Math.floor((customerFundedCents * feeBps + 5000) / 10000);
  }

  async resolve(clubId: string, customerFundedCents: number): Promise<MarketplaceFeeSnapshot> {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: { marketplaceFeeBps: true },
    });
    if (!club) throw notFound('CLUB_NOT_FOUND', 'No encontramos el negocio.');
    const global = await this.readGlobal();
    const marketplaceFeeBps = club.marketplaceFeeBps ?? global.defaultMarketplaceFeeBps;
    if (marketplaceFeeBps == null)
      throw conflict(
        'MARKETPLACE_FEE_NOT_CONFIGURED',
        'Configura una comisión global válida antes de aceptar pagos reales.',
      );
    const marketplaceFeeCents = this.calculate(customerFundedCents, marketplaceFeeBps);
    return {
      marketplaceFeeBps,
      marketplaceFeeCents,
      sellerExpectedNetCents: customerFundedCents - marketplaceFeeCents,
      feeSource:
        club.marketplaceFeeBps == null
          ? MarketplaceFeeSource.GLOBAL
          : MarketplaceFeeSource.BUSINESS_OVERRIDE,
    };
  }

  async readGlobal() {
    const record = await this.prisma.platformSettings.findUnique({ where: { id: SETTINGS_ID } });
    const settings = parseSettings(record?.settingsJson);
    const explicit = integerOrNull(settings.defaultMarketplaceFeeBps);
    const legacyPercentage =
      typeof settings.commissionPercentage === 'number' &&
      Number.isFinite(settings.commissionPercentage)
        ? Math.round(settings.commissionPercentage * 100)
        : null;
    const defaultMarketplaceFeeBps = explicit ?? legacyPercentage;
    if (defaultMarketplaceFeeBps != null) this.assertFee(defaultMarketplaceFeeBps);
    return {
      defaultMarketplaceFeeBps,
      source:
        explicit != null
          ? 'BPS'
          : legacyPercentage != null
            ? 'LEGACY_PERCENTAGE'
            : 'NOT_CONFIGURED',
      maximumMarketplaceFeeBps: this.maximumFeeBps(),
    };
  }

  async updateGlobal(actor: AuthenticatedUser, feeBps: number, reason: string) {
    this.assertFee(feeBps);
    const previous = await this.readGlobal();
    const record = await this.prisma.platformSettings.findUnique({ where: { id: SETTINGS_ID } });
    const settings = parseSettings(record?.settingsJson);
    settings.defaultMarketplaceFeeBps = feeBps;
    delete settings.commissionPercentage;
    await this.prisma.platformSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, settingsJson: JSON.stringify(settings) },
      update: { settingsJson: JSON.stringify(settings) },
    });
    await this.audit.record({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: 'UPDATE_GLOBAL_MARKETPLACE_FEE',
      resourceType: 'PLATFORM_SETTINGS',
      resourceId: SETTINGS_ID,
      severity: 'CRITICAL',
      metadata: { previousFeeBps: previous.defaultMarketplaceFeeBps, newFeeBps: feeBps, reason },
    });
    return this.readGlobal();
  }

  async effectiveFor(actor: AuthenticatedUser, clubId: string) {
    await this.assertClubAdmin(actor, clubId);
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true, name: true, marketplaceFeeBps: true },
    });
    if (!club) throw notFound('CLUB_NOT_FOUND', 'No encontramos el negocio.');
    const global = await this.readGlobal();
    const effectiveFeeBps = club.marketplaceFeeBps ?? global.defaultMarketplaceFeeBps;
    return {
      clubId,
      businessName: club.name,
      effectiveFeeBps,
      feeSource: club.marketplaceFeeBps == null ? 'GLOBAL' : 'BUSINESS_OVERRIDE',
      businessOverrideFeeBps: club.marketplaceFeeBps,
      example:
        effectiveFeeBps == null
          ? null
          : {
              grossAmountCents: 10000,
              marketplaceFeeCents: this.calculate(10000, effectiveFeeBps),
              excludesMercadoPagoProcessingFee: true,
            },
    };
  }

  async setOverride(actor: AuthenticatedUser, clubId: string, feeBps: number, reason: string) {
    this.assertFee(feeBps);
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: { marketplaceFeeBps: true },
    });
    if (!club) throw notFound('CLUB_NOT_FOUND', 'No encontramos el negocio.');
    await this.prisma.club.update({ where: { id: clubId }, data: { marketplaceFeeBps: feeBps } });
    await this.audit.record({
      actorUserId: actor.id,
      actorRole: actor.role,
      clubId,
      action: 'SET_BUSINESS_MARKETPLACE_FEE',
      resourceType: 'CLUB',
      resourceId: clubId,
      severity: 'CRITICAL',
      metadata: { previousFeeBps: club.marketplaceFeeBps, newFeeBps: feeBps, reason },
    });
    return this.effectiveFor(actor, clubId);
  }

  async removeOverride(actor: AuthenticatedUser, clubId: string, reason: string) {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: { marketplaceFeeBps: true },
    });
    if (!club) throw notFound('CLUB_NOT_FOUND', 'No encontramos el negocio.');
    await this.prisma.club.update({ where: { id: clubId }, data: { marketplaceFeeBps: null } });
    await this.audit.record({
      actorUserId: actor.id,
      actorRole: actor.role,
      clubId,
      action: 'REMOVE_BUSINESS_MARKETPLACE_FEE',
      resourceType: 'CLUB',
      resourceId: clubId,
      severity: 'CRITICAL',
      metadata: { previousFeeBps: club.marketplaceFeeBps, newFeeBps: null, reason },
    });
    return this.effectiveFor(actor, clubId);
  }

  private assertFee(feeBps: number) {
    if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > this.maximumFeeBps())
      throw conflict(
        'INVALID_MARKETPLACE_FEE_BPS',
        `La comisión debe ser un entero entre 0 y ${this.maximumFeeBps()} puntos base.`,
      );
  }

  private maximumFeeBps() {
    const value = Number(this.config.get<string>('MAX_MARKETPLACE_FEE_BPS', '3000'));
    return Number.isInteger(value) && value >= 0 && value <= 10000 ? value : 3000;
  }

  private async assertClubAdmin(actor: AuthenticatedUser, clubId: string) {
    if (actor.role === UserRole.SUPER_ADMIN) return;
    const admin = await this.prisma.clubAdmin.findUnique({
      where: { clubId_userId: { clubId, userId: actor.id } },
      select: { id: true },
    });
    if (!admin)
      throw forbidden(
        'CLUB_ADMIN_REQUIRED',
        'Solo un administrador del negocio puede consultar esta configuración.',
      );
  }
}

const parseSettings = (json?: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(json ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};
const integerOrNull = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) ? value : null;
