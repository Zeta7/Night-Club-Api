import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationCategory, Prisma } from '@prisma/client';
import { isRecord, JsonObject } from '../../../shared/domain/json';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { badRequest, notFound } from '../../../shared/presentation/api-exception';
import { PHONE_MESSAGE_SENDER, PhoneMessageSender } from './ports/phone-message-sender.port';
import {
  MAX_PUSH_BATCH_SIZE,
  NotificationChannel,
  NotificationChannelMessage,
  NotificationDeliveryResult,
  PUSH_NOTIFICATION_CHANNEL,
} from './ports/notification-channel.port';
import { UpdateNotificationPreferenceDto } from '../presentation/notification.dto';

type SendPhoneVerificationCodeInput = {
  phoneCountryCode: string;
  phoneNumber: string;
  code: string;
  expirationMinutes: number;
};

@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationService.name);
  private deliveryTimer?: NodeJS.Timeout;
  private dispatching = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PHONE_MESSAGE_SENDER)
    private readonly phoneMessageSender: PhoneMessageSender,
    @Inject(PUSH_NOTIFICATION_CHANNEL)
    private readonly pushChannel: NotificationChannel,
  ) {}

  async onModuleInit() {
    await this.ensureTemplates();
    this.deliveryTimer = setInterval(() => this.dispatchInBackground(), 5_000);
    this.deliveryTimer.unref();
    this.dispatchInBackground();
  }

  private dispatchInBackground() {
    void this.dispatchPending().catch((error: unknown) => {
      this.logger.error('No se pudieron despachar las notificaciones pendientes.', error);
    });
  }

  onModuleDestroy() {
    if (this.deliveryTimer) clearInterval(this.deliveryTimer);
  }

  sendPhoneVerificationCode(input: SendPhoneVerificationCodeInput): Promise<void> {
    return this.phoneMessageSender.send({
      phoneCountryCode: input.phoneCountryCode,
      phoneNumber: input.phoneNumber,
      message: `Tu codigo de confirmacion de NightClub Platform es ${input.code}. Expira en ${input.expirationMinutes} minutos.`,
    });
  }

  sendPasswordRecoveryCode(input: SendPhoneVerificationCodeInput): Promise<void> {
    return this.phoneMessageSender.send({
      phoneCountryCode: input.phoneCountryCode,
      phoneNumber: input.phoneNumber,
      message: `Tu codigo para recuperar tu contrasena en NightClub Platform es ${input.code}. Expira en ${input.expirationMinutes} minutos.`,
    });
  }

  async notifyFromTemplate(
    userId: string,
    templateKey: string,
    variables: Record<string, string | number>,
    data: JsonObject = {},
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const template = await tx.notificationTemplate.findFirst({
      where: { key: templateKey, active: true },
      orderBy: { version: 'desc' },
    });
    if (!template)
      throw notFound('NOTIFICATION_TEMPLATE_NOT_FOUND', `No existe la plantilla ${templateKey}.`);
    const preference = await tx.notificationPreference.findUnique({
      where: { userId_category: { userId, category: template.category } },
    });
    const inAppEnabled = preference?.inAppEnabled ?? true;
    const pushEnabled = preference?.pushEnabled ?? true;
    if (!inAppEnabled && !pushEnabled) return null;
    const render = (value: string) =>
      value.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => String(variables[key] ?? ''));
    return tx.notification.create({
      data: {
        userId,
        category: template.category,
        templateKey: template.key,
        templateVersion: template.version,
        title: render(template.titleTemplate),
        body: render(template.bodyTemplate),
        deepLink: template.deepLinkTemplate === null ? null : render(template.deepLinkTemplate),
        data,
        deliveries: {
          create: [
            ...(inAppEnabled
              ? [
                  {
                    channel: 'IN_APP' as const,
                    status: 'SENT' as const,
                    provider: 'internal',
                    sentAt: new Date(),
                  },
                ]
              : []),
            ...(pushEnabled
              ? [{ channel: 'PUSH' as const, status: 'PENDING' as const, provider: 'simulated' }]
              : []),
          ],
        },
      },
    });
  }

  async list(
    userId: string,
    filters:
      | {
          category?: NotificationCategory;
          readStatus?: 'all' | 'unread' | 'read';
          cursor?: string;
          limit?: number;
        }
      | boolean = {},
  ) {
    const normalized =
      typeof filters === 'boolean'
        ? { readStatus: filters ? ('unread' as const) : ('all' as const) }
        : filters;
    const limit = normalized.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw badRequest('INVALID_NOTIFICATION_LIMIT', 'El límite debe estar entre 1 y 100.');
    }
    const cursor = normalized.cursor === undefined ? null : this.readInboxCursor(normalized.cursor);
    const readFilter =
      normalized.readStatus === 'unread'
        ? { readAt: null }
        : normalized.readStatus === 'read'
          ? { readAt: { not: null } }
          : {};
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: {
          userId,
          ...(normalized.category ? { category: normalized.category } : {}),
          ...readFilter,
          ...(cursor
            ? {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              }
            : {}),
          deliveries: { some: { channel: 'IN_APP', status: 'SENT' } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      }),
      this.prisma.notification.count({
        where: {
          userId,
          readAt: null,
          deliveries: { some: { channel: 'IN_APP', status: 'SENT' } },
        },
      }),
    ]);
    const page = items.slice(0, limit);
    const last = page.at(-1);
    const nextCursor =
      items.length > limit && last
        ? Buffer.from(
            JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id }),
          ).toString('base64url')
        : null;
    return { items: page, unreadCount, nextCursor };
  }

  private readInboxCursor(value: string): { createdAt: Date; id: string } {
    try {
      if (value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value))
        throw new Error('Invalid encoding');
      const decoded: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
      if (
        !isRecord(decoded) ||
        typeof decoded.createdAt !== 'string' ||
        typeof decoded.id !== 'string' ||
        decoded.id.length === 0 ||
        decoded.id.length > 128
      ) {
        throw new Error('Invalid cursor');
      }
      const createdAt = new Date(decoded.createdAt);
      if (!Number.isFinite(createdAt.getTime()) || createdAt.toISOString() !== decoded.createdAt) {
        throw new Error('Invalid date');
      }
      return { createdAt, id: decoded.id };
    } catch {
      throw badRequest('INVALID_NOTIFICATION_CURSOR', 'El cursor de notificaciones no es válido.');
    }
  }

  async markRead(userId: string, notificationId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      const exists = await this.prisma.notification.findFirst({
        where: { id: notificationId, userId },
      });
      if (!exists) throw notFound('NOTIFICATION_NOT_FOUND', 'No se encontró la notificación.');
    }
    return { notificationId, read: true };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null, deliveries: { some: { channel: 'IN_APP', status: 'SENT' } } },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async getPreferences(userId: string) {
    const stored = await this.prisma.notificationPreference.findMany({ where: { userId } });
    const byCategory = new Map(stored.map((item) => [item.category, item]));
    return {
      items: Object.values(NotificationCategory).map((category) => ({
        category,
        inAppEnabled: byCategory.get(category)?.inAppEnabled ?? true,
        pushEnabled: byCategory.get(category)?.pushEnabled ?? true,
        smsEnabled: byCategory.get(category)?.smsEnabled ?? false,
        emailEnabled: byCategory.get(category)?.emailEnabled ?? false,
      })),
    };
  }

  async updatePreference(userId: string, input: UpdateNotificationPreferenceDto) {
    await this.prisma.notificationPreference.upsert({
      where: { userId_category: { userId, category: input.category } },
      create: { userId, ...input },
      update: input,
    });
    return this.getPreferences(userId);
  }

  async registerDevice(userId: string, token: string, platform: string) {
    return this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform: platform.toLowerCase() },
      update: { userId, platform: platform.toLowerCase(), enabled: true, lastSeenAt: new Date() },
    });
  }

  async removeDevice(userId: string, deviceId: string) {
    const result = await this.prisma.deviceToken.updateMany({
      where: { id: deviceId, userId },
      data: { enabled: false },
    });
    if (result.count === 0) throw notFound('DEVICE_NOT_FOUND', 'No se encontró el dispositivo.');
    return { deviceId, enabled: false };
  }

  async dispatchPending() {
    if (this.dispatching) return { processed: 0 };
    this.dispatching = true;
    try {
      return await this.dispatchPendingDeliveries();
    } finally {
      this.dispatching = false;
    }
  }

  private async dispatchPendingDeliveries() {
    // Transactional event notices are a durable outbox. Unique key prevents duplicate enqueue.
    await this.prisma.$executeRaw(Prisma.sql`WITH candidates AS (
      SELECT n.id FROM "Notification" n WHERE n.category = 'EVENT'
        AND NOT EXISTS (SELECT 1 FROM "NotificationDelivery" d WHERE d."notificationId" = n.id AND d.channel = 'IN_APP')
      ORDER BY n."createdAt" LIMIT 100
    ), prepared AS (
      UPDATE "Notification" n SET "deepLink" = COALESCE(n."deepLink", CASE
        WHEN n.data->>'orderId' IS NOT NULL AND EXISTS (SELECT 1 FROM "Order" o WHERE o.id = n.data->>'orderId' AND o."userId" = n."userId") THEN 'beerry://customer/operations/orders/' || (n.data->>'orderId')
        WHEN EXISTS (SELECT 1 FROM "User" u WHERE u.id = n."userId" AND u.role = 'SUPER_ADMIN') THEN 'beerry://admin/event-resolutions'
        WHEN EXISTS (SELECT 1 FROM "User" u WHERE u.id = n."userId" AND u.role = 'ADMIN') THEN 'beerry://admin/club/events' || CASE WHEN NULLIF(n.data->>'eventId', '') IS NOT NULL THEN '/' || (n.data->>'eventId') ELSE '' END
        ELSE 'beerry://customer/qrs?filter=HISTORY' END)
      FROM candidates c WHERE n.id = c.id RETURNING n.*
    ) INSERT INTO "NotificationDelivery" (id, "notificationId", channel, status, provider, "updatedAt")
      SELECT gen_random_uuid()::text, n.id, ch.channel::"NotificationChannelType",
        CASE WHEN ch.channel = 'IN_APP' AND COALESCE(p."inAppEnabled", true) THEN 'SENT'::"NotificationDeliveryStatus"
          WHEN ch.channel = 'PUSH' AND COALESCE(p."pushEnabled", true) AND n."createdAt" > NOW() - INTERVAL '24 hours' THEN 'PENDING'::"NotificationDeliveryStatus"
          ELSE 'SKIPPED'::"NotificationDeliveryStatus" END, 'configured', NOW()
      FROM prepared n CROSS JOIN (VALUES ('IN_APP'),('PUSH')) ch(channel)
      LEFT JOIN "NotificationPreference" p ON p."userId" = n."userId" AND p.category = n.category
      ON CONFLICT ("notificationId", channel) DO NOTHING`);
    const deliveries = await this.prisma.notificationDelivery.findMany({
      where: { channel: 'PUSH', status: 'PENDING', nextAttemptAt: { lte: new Date() } },
      include: { notification: true },
      take: 50,
    });
    for (const delivery of deliveries) {
      const attempt = delivery.attempts + 1;
      const claimed = await this.prisma.notificationDelivery.updateMany({
        where: {
          id: delivery.id,
          status: 'PENDING',
          attempts: delivery.attempts,
          nextAttemptAt: { lte: new Date() },
        },
        data: { attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + 60_000) },
      });
      if (claimed.count !== 1) continue;
      const stored = isRecord(delivery.providerData) ? delivery.providerData : {};
      let pendingTokens =
        Array.isArray(stored.pendingTokens) &&
        stored.pendingTokens.every((token) => typeof token === 'string')
          ? (stored.pendingTokens as string[])
          : undefined;
      let sentCount =
        typeof stored.sentCount === 'number' &&
        Number.isSafeInteger(stored.sentCount) &&
        stored.sentCount >= 0
          ? stored.sentCount
          : 0;
      const claimedWhere = { id: delivery.id, status: 'PENDING' as const, attempts: attempt };
      try {
        const devices = await this.prisma.deviceToken.findMany({
          where: { userId: delivery.notification.userId, enabled: true },
          select: { token: true },
        });
        const activeTokens = new Set(devices.map((item) => item.token));
        pendingTokens = pendingTokens
          ? pendingTokens.filter((token) => activeTokens.has(token))
          : [...activeTokens];
        // Fix the recipient snapshot before sending; retries never add new devices.
        const prepared = await this.prisma.notificationDelivery.updateMany({
          where: claimedWhere,
          data: {
            providerData: { pendingTokens, sentCount },
            nextAttemptAt: new Date(Date.now() + 60_000),
          },
        });
        if (prepared.count !== 1) continue;
        const tokensForAttempt = [...pendingTokens];
        let errorMessage: string | null = null;
        let claimLost = false;
        for (let offset = 0; offset < tokensForAttempt.length; offset += MAX_PUSH_BATCH_SIZE) {
          const batch = tokensForAttempt.slice(offset, offset + MAX_PUSH_BATCH_SIZE);
          const result = await this.sendPushBatch(delivery.id, attempt, {
            notificationId: delivery.notificationId,
            userId: delivery.notification.userId,
            title: delivery.notification.title,
            body: delivery.notification.body,
            deepLink: delivery.notification.deepLink,
            data: isRecord(delivery.notification.data) ? delivery.notification.data : {},
            deviceTokens: batch,
          });
          const batchTokens = new Set(batch);
          const retryTokens = new Set(result.retryTokens.filter((token) => batchTokens.has(token)));
          pendingTokens = pendingTokens.filter(
            (token) => !batchTokens.has(token) || retryTokens.has(token),
          );
          sentCount += new Set(result.sentTokens.filter((token) => batchTokens.has(token))).size;
          errorMessage = result.errorMessage ?? errorMessage;
          // Checkpoint successful devices and disable invalid ones in the same commit.
          const checkpoint = await this.prisma.$transaction(async (tx) => {
            const saved = await tx.notificationDelivery.updateMany({
              where: claimedWhere,
              data: {
                provider: result.provider,
                providerData: {
                  pendingTokens: pendingTokens ?? [],
                  sentCount,
                  lastResult: result.metadata ?? {},
                },
                nextAttemptAt: new Date(Date.now() + 60_000),
              },
            });
            if (saved.count === 1 && result.invalidTokens.length > 0) {
              await tx.deviceToken.updateMany({
                where: {
                  userId: delivery.notification.userId,
                  token: { in: result.invalidTokens.filter((token) => batchTokens.has(token)) },
                },
                data: { enabled: false },
              });
            }
            return saved;
          });
          if (checkpoint.count !== 1) {
            claimLost = true;
            break;
          }
        }
        if (claimLost) continue;
        await this.prisma.notificationDelivery.updateMany({
          where: claimedWhere,
          data: {
            status:
              pendingTokens.length > 0
                ? attempt >= 5
                  ? 'FAILED'
                  : 'PENDING'
                : sentCount > 0
                  ? 'SENT'
                  : 'SKIPPED',
            sentAt: sentCount > 0 ? new Date() : null,
            errorMessage:
              pendingTokens.length > 0
                ? (errorMessage ?? 'Hay dispositivos pendientes de entrega.')
                : null,
            nextAttemptAt: new Date(Date.now() + Math.min(300_000, 2 ** attempt * 5000)),
          },
        });
      } catch (error) {
        await this.prisma.notificationDelivery.updateMany({
          where: claimedWhere,
          data: {
            status: attempt >= 5 ? 'FAILED' : 'PENDING',
            errorMessage: error instanceof Error ? error.message : String(error),
            nextAttemptAt: new Date(Date.now() + Math.min(300_000, 2 ** attempt * 5000)),
          },
        });
      }
    }
    return { processed: deliveries.length };
  }

  private async sendPushBatch(
    deliveryId: string,
    attempt: number,
    message: NotificationChannelMessage,
  ): Promise<NotificationDeliveryResult> {
    let renewal = Promise.resolve();
    const timer = setInterval(() => {
      renewal = renewal
        .then(async () => {
          await this.prisma.notificationDelivery.updateMany({
            where: { id: deliveryId, status: 'PENDING', attempts: attempt },
            data: { nextAttemptAt: new Date(Date.now() + 60_000) },
          });
        })
        .catch((error: unknown) => this.logger.error('No se pudo renovar la entrega push.', error));
    }, 20_000);
    timer.unref();
    try {
      return await this.pushChannel.send(message);
    } finally {
      clearInterval(timer);
      await renewal;
    }
  }

  private async ensureTemplates() {
    const templates = [
      [
        'PAYMENT_APPROVED',
        NotificationCategory.PAYMENT,
        'Pago aprobado',
        'Tu pago de S/ {amount} fue aprobado.',
        '/orders/{orderId}',
      ],
      [
        'PAYMENT_REJECTED',
        NotificationCategory.PAYMENT,
        'Pago rechazado',
        'No pudimos aprobar tu pago. Tu carrito se mantiene disponible.',
        '/orders/{orderId}',
      ],
      [
        'PAYMENT_EXPIRED',
        NotificationCategory.PAYMENT,
        'Pago vencido',
        'La reserva venció antes de completar el pago. Puedes intentarlo nuevamente.',
        '/orders/{orderId}',
      ],
      [
        'PAYMENT_PARTIALLY_REFUNDED',
        NotificationCategory.PAYMENT,
        'Devolución parcial confirmada',
        'Mercado Pago confirmó una devolución parcial de S/ {amount}.',
        '/orders/{orderId}',
      ],
      [
        'PAYMENT_REFUNDED',
        NotificationCategory.PAYMENT,
        'Devolución confirmada',
        'Mercado Pago confirmó tu devolución de S/ {amount}.',
        '/orders/{orderId}',
      ],
      [
        'PAYMENT_CHARGEBACK',
        NotificationCategory.PAYMENT,
        'Contracargo registrado',
        'Se registró un contracargo para la orden {orderId}.',
        '/orders/{orderId}',
      ],
      [
        'QR_AVAILABLE',
        NotificationCategory.QR,
        'QR disponible',
        'Tu compra fue confirmada y ya puedes usar tus QR.',
        '/customer/qrs?orderId={orderId}',
      ],
      [
        'ADMIN_NEW_SALE',
        NotificationCategory.ORDER,
        'Nueva venta: {saleType}',
        '{customerName} realizó una compra por S/ {amount}: {itemSummary}.',
        '/admin/sales',
      ],
      [
        'WITHDRAWAL_REQUESTED',
        NotificationCategory.WITHDRAWAL,
        'Retiro solicitado',
        'Registramos tu solicitud de retiro por S/ {amount}.',
        '/admin/wallet',
      ],
      [
        'WITHDRAWAL_APPROVED',
        NotificationCategory.WITHDRAWAL,
        'Retiro aprobado',
        'Tu retiro por S/ {amount} fue aprobado.',
        '/admin/wallet',
      ],
      [
        'WITHDRAWAL_REJECTED',
        NotificationCategory.WITHDRAWAL,
        'Retiro no procesado',
        'Tu retiro por S/ {amount} fue rechazado o no pudo procesarse.',
        '/admin/wallet',
      ],
      [
        'WITHDRAWAL_PAID',
        NotificationCategory.WITHDRAWAL,
        'Retiro pagado',
        'Tu retiro por S/ {amount} fue marcado como pagado.',
        '/admin/wallet',
      ],
      [
        'REFERRAL_ASSOCIATED',
        NotificationCategory.PROMOTION,
        'Nuevo referido',
        '{customer} se registró con tu código de referido.',
        '/referrals',
      ],
      [
        'REFERRAL_REWARD_PENDING',
        NotificationCategory.PROMOTION,
        'Recompensa pendiente',
        'Generaste S/ {amount} por una compra de tu referido. Te avisaremos cuando esté disponible.',
        '/referrals',
      ],
      [
        'REFERRAL_REWARD_AVAILABLE',
        NotificationCategory.PROMOTION,
        'Crédito Beerry disponible',
        'Ya tienes S/ {amount} adicionales en tu billetera.',
        '/wallet',
      ],
      [
        'REFERRAL_TRANSFER_RECEIVED',
        NotificationCategory.PROMOTION,
        'Recibiste Crédito Beerry',
        'Recibiste una transferencia de S/ {amount}.',
        '/wallet',
      ],
      [
        'BUSINESS_ACCESS_APPROVED',
        NotificationCategory.SYSTEM,
        'Solicitud comercial aprobada',
        'Ya puedes configurar y administrar {businessName}.',
        '/profile/business-access',
      ],
      [
        'BUSINESS_ACCESS_REJECTED',
        NotificationCategory.SYSTEM,
        'Solicitud comercial revisada',
        'La solicitud para {businessName} fue rechazada. {comment}',
        '/profile/business-access',
      ],
    ] as const;
    for (const [key, category, titleTemplate, bodyTemplate, deepLinkTemplate] of templates) {
      await this.prisma.notificationTemplate.upsert({
        where: { key_version: { key, version: 1 } },
        create: { key, version: 1, category, titleTemplate, bodyTemplate, deepLinkTemplate },
        update: { category, titleTemplate, bodyTemplate, deepLinkTemplate, active: true },
      });
    }
  }
}
