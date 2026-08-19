import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { notFound } from '../../../shared/presentation/api-exception';
import { PHONE_MESSAGE_SENDER, PhoneMessageSender } from './ports/phone-message-sender.port';
import {
  NotificationChannel,
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
  private deliveryTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PHONE_MESSAGE_SENDER)
    private readonly phoneMessageSender: PhoneMessageSender,
    @Inject(PUSH_NOTIFICATION_CHANNEL)
    private readonly pushChannel: NotificationChannel,
  ) {}

  async onModuleInit() {
    await this.ensureTemplates();
    this.deliveryTimer = setInterval(() => void this.dispatchPending(), 5_000);
    this.deliveryTimer.unref();
    void this.dispatchPending();
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
    data: Record<string, unknown> = {},
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const template = await tx.notificationTemplate.findFirst({
      where: { key: templateKey, active: true },
      orderBy: { version: 'desc' },
    });
    if (!template) throw notFound('NOTIFICATION_TEMPLATE_NOT_FOUND', `No existe la plantilla ${templateKey}.`);
    const preference = await tx.notificationPreference.findUnique({
      where: { userId_category: { userId, category: template.category } },
    });
    const inAppEnabled = preference?.inAppEnabled ?? true;
    const pushEnabled = preference?.pushEnabled ?? true;
    if (!inAppEnabled && !pushEnabled) return null;
    const render = (value: string | null) =>
      value?.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => String(variables[key] ?? '')) ?? null;
    return tx.notification.create({
      data: {
        userId,
        category: template.category,
        templateKey: template.key,
        templateVersion: template.version,
        title: render(template.titleTemplate)!,
        body: render(template.bodyTemplate)!,
        deepLink: render(template.deepLinkTemplate),
        data: data as Prisma.InputJsonValue,
        deliveries: {
          create: [
            ...(inAppEnabled
              ? [{ channel: 'IN_APP' as const, status: 'SENT' as const, provider: 'internal', sentAt: new Date() }]
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
    filters: {
      category?: NotificationCategory;
      readStatus?: 'all' | 'unread' | 'read';
    } | boolean = {},
  ) {
    const normalized = typeof filters === 'boolean'
      ? { readStatus: filters ? 'unread' as const : 'all' as const }
      : filters;
    const readFilter = normalized.readStatus === 'unread'
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
          deliveries: { some: { channel: 'IN_APP', status: 'SENT' } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.notification.count({
        where: { userId, readAt: null, deliveries: { some: { channel: 'IN_APP', status: 'SENT' } } },
      }),
    ]);
    return { items, unreadCount };
  }

  async markRead(userId: string, notificationId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      const exists = await this.prisma.notification.findFirst({ where: { id: notificationId, userId } });
      if (!exists) throw notFound('NOTIFICATION_NOT_FOUND', 'No se encontró la notificación.');
    }
    return { notificationId, read: true };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
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
    const deliveries = await this.prisma.notificationDelivery.findMany({
      where: { channel: 'PUSH', status: 'PENDING', nextAttemptAt: { lte: new Date() } },
      include: { notification: true },
      take: 50,
    });
    for (const delivery of deliveries) {
      const claimed = await this.prisma.notificationDelivery.updateMany({
        where: { id: delivery.id, status: 'PENDING' },
        data: { attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + 60_000) },
      });
      if (claimed.count !== 1) continue;
      try {
        const devices = await this.prisma.deviceToken.findMany({
          where: { userId: delivery.notification.userId, enabled: true },
          select: { token: true },
        });
        const result = await this.pushChannel.send({
          notificationId: delivery.notificationId,
          userId: delivery.notification.userId,
          title: delivery.notification.title,
          body: delivery.notification.body,
          deepLink: delivery.notification.deepLink,
          data: (delivery.notification.data ?? {}) as Record<string, unknown>,
          deviceTokens: devices.map((item) => item.token),
        });
        const invalidTokens = Array.isArray(result.metadata?.invalidTokens)
          ? result.metadata.invalidTokens.filter((token): token is string => typeof token === 'string')
          : [];
        if (invalidTokens.length > 0) {
          await this.prisma.deviceToken.updateMany({
            where: { token: { in: invalidTokens } },
            data: { enabled: false },
          });
        }
        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: result.skipped ? 'SKIPPED' : 'SENT',
            provider: result.provider,
            sentAt: result.skipped ? null : new Date(),
            providerData: result.metadata as Prisma.InputJsonValue | undefined,
          },
        });
      } catch (error) {
        const attempts = delivery.attempts + 1;
        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: attempts >= 5 ? 'FAILED' : 'PENDING',
            errorMessage: error instanceof Error ? error.message : String(error),
            nextAttemptAt: new Date(Date.now() + Math.min(300_000, 2 ** attempts * 5000)),
          },
        });
      }
    }
    return { processed: deliveries.length };
  }

  private async ensureTemplates() {
    const templates = [
      ['PAYMENT_APPROVED', NotificationCategory.PAYMENT, 'Pago aprobado', 'Tu pago de S/ {amount} fue aprobado.', '/orders/{orderId}'],
      ['PAYMENT_REJECTED', NotificationCategory.PAYMENT, 'Pago rechazado', 'No pudimos aprobar tu pago. Tu carrito se mantiene disponible.', '/cart'],
      ['PAYMENT_EXPIRED', NotificationCategory.PAYMENT, 'Pago vencido', 'La reserva venció antes de completar el pago. Puedes intentarlo nuevamente.', '/cart'],
      ['QR_AVAILABLE', NotificationCategory.QR, 'QR disponible', 'Tu compra fue confirmada y ya puedes usar tus QR.', '/qrs'],
      ['ADMIN_NEW_SALE', NotificationCategory.ORDER, 'Nueva venta: {saleType}', '{customerName} realizó una compra por S/ {amount}: {itemSummary}.', '/admin/sales'],
      ['WITHDRAWAL_REQUESTED', NotificationCategory.WITHDRAWAL, 'Retiro solicitado', 'Registramos tu solicitud de retiro por S/ {amount}.', '/admin/wallet'],
      ['WITHDRAWAL_APPROVED', NotificationCategory.WITHDRAWAL, 'Retiro aprobado', 'Tu retiro por S/ {amount} fue aprobado.', '/admin/wallet'],
      ['WITHDRAWAL_REJECTED', NotificationCategory.WITHDRAWAL, 'Retiro no procesado', 'Tu retiro por S/ {amount} fue rechazado o no pudo procesarse.', '/admin/wallet'],
      ['WITHDRAWAL_PAID', NotificationCategory.WITHDRAWAL, 'Retiro pagado', 'Tu retiro por S/ {amount} fue marcado como pagado.', '/admin/wallet'],
      ['REFERRAL_ASSOCIATED', NotificationCategory.PROMOTION, 'Nuevo referido', '{customer} se registró con tu código de referido.', '/referrals'],
      ['REFERRAL_REWARD_PENDING', NotificationCategory.PROMOTION, 'Recompensa pendiente', 'Generaste S/ {amount} por una compra de tu referido. Te avisaremos cuando esté disponible.', '/referrals'],
      ['REFERRAL_REWARD_AVAILABLE', NotificationCategory.PROMOTION, 'Crédito Beerry disponible', 'Ya tienes S/ {amount} adicionales en tu billetera.', '/wallet'],
      ['REFERRAL_TRANSFER_RECEIVED', NotificationCategory.PROMOTION, 'Recibiste Crédito Beerry', 'Recibiste una transferencia de S/ {amount}.', '/wallet'],
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
