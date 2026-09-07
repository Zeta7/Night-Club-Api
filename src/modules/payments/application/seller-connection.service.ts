import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SellerConnectionStatus, UserRole } from '@prisma/client';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from '../../../shared/presentation/api-exception';
import { AuditService } from '../../audit/application/audit.service';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { MercadoPagoOAuthClient } from '../infrastructure/mercado-pago-oauth.client';
import { SellerCredentialCipher } from '../infrastructure/seller-credential-cipher';

const PROVIDER = 'mercado_pago';
const REQUIRED_SCOPES = ['read', 'write', 'offline_access'] as const;

@Injectable()
export class SellerConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly oauth: MercadoPagoOAuthClient,
    private readonly cipher: SellerCredentialCipher,
    private readonly audit: AuditService,
  ) {}

  async status(actor: AuthenticatedUser, clubId: string) {
    await this.assertAdmin(actor, clubId);
    const connection = await this.prisma.marketplaceSellerConnection.findUnique({
      where: { clubId_provider: { clubId, provider: PROVIDER } },
    });
    if (!connection)
      return {
        provider: 'MERCADO_PAGO',
        status: SellerConnectionStatus.NOT_CONNECTED,
        accountHint: null,
        connectedAt: null,
        tokenExpiresAt: null,
        lastError: null,
      };
    const status =
      connection.status === SellerConnectionStatus.CONNECTED &&
      connection.tokenExpiresAt &&
      connection.tokenExpiresAt <= new Date()
        ? SellerConnectionStatus.REAUTHORIZATION_REQUIRED
        : connection.status;
    return {
      provider: 'MERCADO_PAGO',
      status,
      accountHint: connection.externalAccountHint,
      connectedAt: connection.connectedAt,
      tokenExpiresAt: connection.tokenExpiresAt,
      lastError: connection.lastError,
    };
  }

  async start(actor: AuthenticatedUser, clubId: string) {
    await this.assertAdmin(actor, clubId);
    const nonce = randomBytes(32).toString('base64url');
    const signature = createHmac('sha256', this.stateSecret()).update(nonce).digest('base64url');
    const state = `${nonce}.${signature}`;
    await this.prisma.marketplaceOAuthState.create({
      data: {
        clubId,
        userId: actor.id,
        provider: PROVIDER,
        stateHash: hash(state),
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    return {
      provider: 'MERCADO_PAGO',
      authorizationUrl: this.oauth.authorizationUrl(state),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    };
  }

  async callback(state: string, code: string) {
    this.verifyStateSignature(state);
    const stateHash = hash(state);
    const previousState = await this.prisma.marketplaceOAuthState.findUnique({
      where: { stateHash },
    });
    if (previousState?.consumedAt) {
      const existing = await this.prisma.marketplaceSellerConnection.findUnique({
        where: { clubId_provider: { clubId: previousState.clubId, provider: PROVIDER } },
      });
      if (existing?.status === SellerConnectionStatus.CONNECTED) {
        return { clubId: previousState.clubId, status: existing.status };
      }
      throw conflict('OAUTH_STATE_ALREADY_USED', 'Este enlace de conexión ya fue utilizado.');
    }
    const oauthState = await this.prisma.$transaction(async (tx) => {
      const current = await tx.marketplaceOAuthState.findUnique({ where: { stateHash } });
      if (!current || current.provider !== PROVIDER)
        throw unauthorized('INVALID_OAUTH_STATE', 'El estado OAuth no es válido.');
      if (current.consumedAt)
        throw conflict('OAUTH_STATE_ALREADY_USED', 'Este enlace de conexión ya fue utilizado.');
      if (current.expiresAt <= new Date())
        throw unauthorized('OAUTH_STATE_EXPIRED', 'El enlace de conexión venció.');
      const claimed = await tx.marketplaceOAuthState.updateMany({
        where: { id: current.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (claimed.count !== 1)
        throw conflict('OAUTH_STATE_ALREADY_USED', 'Este enlace de conexión ya fue utilizado.');
      return current;
    });
    const token = await this.oauth.exchangeCode(code);
    const scopes = this.assertRequiredScopes(token.scope);
    const externalSellerId = String(token.user_id);
    const existingSeller = await this.prisma.marketplaceSellerConnection.findFirst({
      where: { provider: PROVIDER, externalSellerId, NOT: { clubId: oauthState.clubId } },
      select: { clubId: true },
    });
    if (existingSeller)
      throw conflict(
        'MERCADO_PAGO_ACCOUNT_ALREADY_CONNECTED',
        'Esta cuenta de Mercado Pago ya está conectada a otro negocio.',
      );
    const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null;
    const connection = await this.prisma.marketplaceSellerConnection.upsert({
      where: { clubId_provider: { clubId: oauthState.clubId, provider: PROVIDER } },
      create: {
        clubId: oauthState.clubId,
        provider: PROVIDER,
        externalSellerId,
        externalAccountHint: maskSeller(externalSellerId),
        accessTokenEncrypted: this.cipher.encrypt(token.access_token),
        refreshTokenEncrypted: token.refresh_token
          ? this.cipher.encrypt(token.refresh_token)
          : null,
        tokenExpiresAt: expiresAt,
        scopes,
        status: SellerConnectionStatus.CONNECTED,
        connectedAt: new Date(),
      },
      update: {
        externalSellerId,
        externalAccountHint: maskSeller(externalSellerId),
        accessTokenEncrypted: this.cipher.encrypt(token.access_token),
        refreshTokenEncrypted: token.refresh_token
          ? this.cipher.encrypt(token.refresh_token)
          : undefined,
        tokenExpiresAt: expiresAt,
        scopes,
        status: SellerConnectionStatus.CONNECTED,
        connectedAt: new Date(),
        disconnectedAt: null,
        lastError: null,
      },
    });
    await this.audit.record({
      actorUserId: oauthState.userId,
      clubId: oauthState.clubId,
      action: 'CONNECT_MERCADO_PAGO',
      resourceType: 'MARKETPLACE_SELLER_CONNECTION',
      resourceId: connection.id,
      severity: 'CRITICAL',
      metadata: { provider: PROVIDER, externalSellerId },
    });
    return { clubId: oauthState.clubId, status: connection.status };
  }

  async disconnect(actor: AuthenticatedUser, clubId: string) {
    await this.assertAdmin(actor, clubId);
    const connection = await this.prisma.marketplaceSellerConnection.findUnique({
      where: { clubId_provider: { clubId, provider: PROVIDER } },
    });
    if (!connection) return this.status(actor, clubId);
    await this.prisma.marketplaceSellerConnection.update({
      where: { id: connection.id },
      data: { status: SellerConnectionStatus.DISCONNECTED, disconnectedAt: new Date() },
    });
    await this.audit.record({
      actorUserId: actor.id,
      actorRole: actor.role,
      clubId,
      action: 'DISCONNECT_MERCADO_PAGO',
      resourceType: 'MARKETPLACE_SELLER_CONNECTION',
      resourceId: connection.id,
      severity: 'CRITICAL',
    });
    return this.status(actor, clubId);
  }

  async accessTokenForClub(clubId: string) {
    const connection = await this.prisma.marketplaceSellerConnection.findUnique({
      where: { clubId_provider: { clubId, provider: PROVIDER } },
    });
    if (!connection || connection.status !== SellerConnectionStatus.CONNECTED)
      throw conflict(
        'MERCADO_PAGO_NOT_CONNECTED',
        'El negocio debe conectar Mercado Pago antes de recibir pagos.',
      );
    if (connection.tokenExpiresAt && connection.tokenExpiresAt <= new Date()) {
      if (!connection.refreshTokenEncrypted) {
        throw conflict(
          'MERCADO_PAGO_REAUTHORIZATION_REQUIRED',
          'La conexión de Mercado Pago venció y debe renovarse.',
        );
      }
      try {
        const refreshed = await this.oauth.refresh(
          this.cipher.decrypt(connection.refreshTokenEncrypted),
        );
        if (String(refreshed.user_id) !== connection.externalSellerId)
          throw new Error('MERCADO_PAGO_REFRESH_SELLER_MISMATCH');
        const scopes = this.assertRequiredScopes(refreshed.scope, connection.scopes);
        const tokenExpiresAt = refreshed.expires_in
          ? new Date(Date.now() + refreshed.expires_in * 1000)
          : null;
        await this.prisma.marketplaceSellerConnection.update({
          where: { id: connection.id },
          data: {
            accessTokenEncrypted: this.cipher.encrypt(refreshed.access_token),
            refreshTokenEncrypted: refreshed.refresh_token
              ? this.cipher.encrypt(refreshed.refresh_token)
              : connection.refreshTokenEncrypted,
            tokenExpiresAt,
            scopes,
            status: SellerConnectionStatus.CONNECTED,
            lastError: null,
          },
        });
        return {
          accessToken: refreshed.access_token,
          sellerExternalId: connection.externalSellerId,
        };
      } catch (error) {
        await this.prisma.marketplaceSellerConnection.update({
          where: { id: connection.id },
          data: {
            status: SellerConnectionStatus.REAUTHORIZATION_REQUIRED,
            lastError: error instanceof Error ? error.message.slice(0, 500) : 'OAUTH_REFRESH_FAILED',
          },
        });
        throw conflict(
          'MERCADO_PAGO_REAUTHORIZATION_REQUIRED',
          'Mercado Pago requiere que el negocio autorice nuevamente la conexión.',
        );
      }
    }
    return {
      accessToken: this.cipher.decrypt(connection.accessTokenEncrypted),
      sellerExternalId: connection.externalSellerId,
    };
  }

  private async assertAdmin(actor: AuthenticatedUser, clubId: string) {
    const club = await this.prisma.club.findUnique({ where: { id: clubId }, select: { id: true } });
    if (!club) throw notFound('CLUB_NOT_FOUND', 'No encontramos el negocio.');
    if (actor.role === UserRole.SUPER_ADMIN) return;
    const admin = await this.prisma.clubAdmin.findUnique({
      where: { clubId_userId: { clubId, userId: actor.id } },
    });
    if (!admin)
      throw forbidden(
        'CLUB_ADMIN_REQUIRED',
        'Solo un administrador del negocio puede configurar sus pagos.',
      );
  }
  private stateSecret() {
    const value = this.config.get<string>('MERCADO_PAGO_OAUTH_STATE_SECRET')?.trim();
    if (!value || value.length < 32) throw new Error('MERCADO_PAGO_OAUTH_STATE_SECRET_REQUIRED');
    return value;
  }
  private assertRequiredScopes(value?: string, fallback: string[] = []) {
    const scopes = value?.split(/[,\s]+/).filter(Boolean) ?? fallback;
    const missing = REQUIRED_SCOPES.filter((scope) => !scopes.includes(scope));
    if (missing.length)
      throw conflict(
        'MERCADO_PAGO_PERMISSIONS_REQUIRED',
        `Mercado Pago no concedió los permisos requeridos: ${missing.join(', ')}.`,
      );
    return scopes;
  }
  private verifyStateSignature(state: string) {
    const [nonce, supplied] = state.split('.');
    if (!nonce || !supplied)
      throw unauthorized('INVALID_OAUTH_STATE', 'El estado OAuth no es válido.');
    const expected = createHmac('sha256', this.stateSecret()).update(nonce).digest();
    let actual: Buffer;
    try {
      actual = Buffer.from(supplied, 'base64url');
    } catch {
      throw unauthorized('INVALID_OAUTH_STATE', 'El estado OAuth no es válido.');
    }
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw unauthorized('INVALID_OAUTH_STATE', 'El estado OAuth no es válido.');
  }
}

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const maskSeller = (value: string) => (value.length <= 4 ? `••${value}` : `••••${value.slice(-4)}`);
