import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { badRequest, conflict, forbidden, notFound } from '../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { NotificationService } from '../../notification/application/notification.service';
import { CreateWithdrawalDto, UpsertFinancialProfileDto } from '../presentation/withdrawal.dto';
import { LedgerService } from './ledger.service';

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ledger: LedgerService,
    @Optional() private readonly notifications?: NotificationService,
  ) {}

  async upsertProfile(user: AuthenticatedUser, clubId: string, input: UpsertFinancialProfileDto) {
    await this.assertClubAdmin(user, clubId);
    const digits = input.bankAccountNumber.replace(/\D/g, '');
    if (digits.length < 8) throw badRequest('INVALID_BANK_ACCOUNT', 'La cuenta bancaria no es válida.');
    const profile = await (this.prisma as any).clubFinancialProfile.upsert({
      where: { clubId },
      create: {
        clubId, legalName: input.legalName.trim(), taxDocumentType: input.taxDocumentType.trim(),
        taxDocumentNumber: input.taxDocumentNumber.trim(), bankName: input.bankName.trim(),
        bankAccountType: input.bankAccountType.trim(), bankAccountEncrypted: this.encrypt(digits),
        bankAccountLast4: digits.slice(-4), bankAccountHolder: input.bankAccountHolder.trim(),
      },
      update: {
        legalName: input.legalName.trim(), taxDocumentType: input.taxDocumentType.trim(),
        taxDocumentNumber: input.taxDocumentNumber.trim(), bankName: input.bankName.trim(),
        bankAccountType: input.bankAccountType.trim(), bankAccountEncrypted: this.encrypt(digits),
        bankAccountLast4: digits.slice(-4), bankAccountHolder: input.bankAccountHolder.trim(), verifiedAt: null,
      },
    });
    await this.audit(user.id, clubId, 'UPSERT_FINANCIAL_PROFILE', 'CLUB_FINANCIAL_PROFILE', profile.id);
    return this.publicProfile(profile);
  }

  async getProfile(user: AuthenticatedUser, clubId: string) {
    await this.assertClubAdmin(user, clubId);
    const profile = await (this.prisma as any).clubFinancialProfile.findUnique({ where: { clubId } });
    return profile ? this.publicProfile(profile) : null;
  }

  async request(user: AuthenticatedUser, clubId: string, input: CreateWithdrawalDto) {
    await this.assertClubAdmin(user, clubId);
    const minimum = Number(this.config.get('WITHDRAWAL_MIN_CENTS') ?? 5000);
    if (input.amountCents < minimum) {
      throw badRequest('WITHDRAWAL_BELOW_MINIMUM', `El retiro mínimo es S/ ${(minimum / 100).toFixed(2)}.`);
    }
    const profile = await (this.prisma as any).clubFinancialProfile.findUnique({ where: { clubId } });
    if (!profile) throw badRequest('FINANCIAL_PROFILE_REQUIRED', 'Configura la cuenta bancaria antes de retirar.');
    const request = await this.prisma.$transaction(async (tx) => {
      const created = await (tx as any).withdrawalRequest.create({
        data: {
          clubId, requestedByUserId: user.id, amountCents: input.amountCents,
          bankAccountLast4: profile.bankAccountLast4, requestNote: input.note?.trim(),
        },
      });
      try {
        await this.ledger.moveClubFunds(tx, {
          clubId, amountCents: input.amountCents, from: 'AVAILABLE', to: 'HELD',
          reference: `WITHDRAWAL_HOLD:${created.id}`, description: 'Retención por solicitud de retiro',
          withdrawalRequestId: created.id, type: 'WITHDRAWAL',
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'INSUFFICIENT_FINANCIAL_BALANCE') {
          throw conflict('INSUFFICIENT_AVAILABLE_BALANCE', 'El negocio no tiene saldo disponible suficiente.');
        }
        throw error;
      }
      await (tx as any).auditLogEntry.create({
        data: { actorUserId: user.id, clubId, action: 'REQUEST_WITHDRAWAL', resourceType: 'WITHDRAWAL', resourceId: created.id, metadata: { amountCents: input.amountCents } },
      });
      return created;
    });
    await this.notify(user.id, 'WITHDRAWAL_REQUESTED', request);
    return request;
  }

  async listClub(user: AuthenticatedUser, clubId: string) {
    await this.assertClubAdmin(user, clubId);
    return { items: await (this.prisma as any).withdrawalRequest.findMany({ where: { clubId }, orderBy: { createdAt: 'desc' } }) };
  }

  async listPlatform(user: AuthenticatedUser, status?: string) {
    this.assertSuperAdmin(user);
    return { items: await (this.prisma as any).withdrawalRequest.findMany({ where: status ? { status } : {}, include: { club: true, requestedBy: true }, orderBy: { createdAt: 'desc' }, take: 200 }) };
  }

  async review(user: AuthenticatedUser, id: string, action: 'APPROVE' | 'REJECT', reason?: string) {
    this.assertSuperAdmin(user);
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await (tx as any).withdrawalRequest.findUnique({ where: { id } });
      if (!current) throw notFound('WITHDRAWAL_NOT_FOUND', 'No encontramos la solicitud de retiro.');
      if (!['REQUESTED', 'UNDER_REVIEW'].includes(current.status)) throw conflict('WITHDRAWAL_NOT_REVIEWABLE', 'El retiro ya fue revisado.');
      if (action === 'REJECT') {
        if (!reason?.trim()) throw badRequest('REJECTION_REASON_REQUIRED', 'Indica el motivo del rechazo.');
        await this.ledger.moveClubFunds(tx, {
          clubId: current.clubId, amountCents: current.amountCents, from: 'HELD', to: 'AVAILABLE',
          reference: `WITHDRAWAL_RELEASE:${id}`, description: 'Liberación por retiro rechazado',
          withdrawalRequestId: id, type: 'ADJUSTMENT',
        });
      }
      const updated = await (tx as any).withdrawalRequest.update({
        where: { id },
        data: action === 'APPROVE'
          ? { status: 'APPROVED', reviewedByUserId: user.id, reviewedAt: new Date(), approvedAt: new Date() }
          : { status: 'REJECTED', reviewedByUserId: user.id, reviewedAt: new Date(), rejectionReason: reason!.trim() },
      });
      await (tx as any).auditLogEntry.create({
        data: { actorUserId: user.id, clubId: current.clubId, action: action === 'APPROVE' ? 'WITHDRAWAL_APPROVED' : 'WITHDRAWAL_REJECTED', resourceType: 'WITHDRAWAL', resourceId: id, metadata: { reason: reason?.trim() } },
      });
      return updated;
    });
    await this.notify(result.requestedByUserId, action === 'APPROVE' ? 'WITHDRAWAL_APPROVED' : 'WITHDRAWAL_REJECTED', result);
    return result;
  }

  async markProcessing(user: AuthenticatedUser, id: string) {
    this.assertSuperAdmin(user);
    return this.transition(id, ['APPROVED'], { status: 'PROCESSING', processingAt: new Date() });
  }

  async markPaid(user: AuthenticatedUser, id: string, paymentReference: string, proofUrl?: string) {
    this.assertSuperAdmin(user);
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await (tx as any).withdrawalRequest.findUnique({ where: { id } });
      if (!current) throw notFound('WITHDRAWAL_NOT_FOUND', 'No encontramos la solicitud de retiro.');
      if (!['APPROVED', 'PROCESSING'].includes(current.status)) throw conflict('WITHDRAWAL_NOT_PAYABLE', 'El retiro no está listo para pagarse.');
      await this.ledger.moveClubFunds(tx, {
        clubId: current.clubId, amountCents: current.amountCents, from: 'HELD', to: 'WITHDRAWN',
        reference: `WITHDRAWAL_PAID:${id}`, description: 'Retiro pagado', withdrawalRequestId: id, type: 'WITHDRAWAL',
      });
      const updated = await (tx as any).withdrawalRequest.update({
        where: { id }, data: { status: 'PAID', paymentReference: paymentReference.trim(), proofUrl: proofUrl?.trim(), paidAt: new Date() },
      });
      await (tx as any).auditLogEntry.create({
        data: { actorUserId: user.id, clubId: current.clubId, action: 'WITHDRAWAL_PAID', resourceType: 'WITHDRAWAL', resourceId: id, metadata: { paymentReference, proofUrl } },
      });
      return updated;
    });
    await this.notify(result.requestedByUserId, 'WITHDRAWAL_PAID', result);
    return result;
  }

  async markFailed(user: AuthenticatedUser, id: string, reason: string) {
    this.assertSuperAdmin(user);
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await (tx as any).withdrawalRequest.findUnique({ where: { id } });
      if (!current) throw notFound('WITHDRAWAL_NOT_FOUND', 'No encontramos la solicitud de retiro.');
      if (!['APPROVED', 'PROCESSING'].includes(current.status)) throw conflict('WITHDRAWAL_NOT_FAILABLE', 'El retiro no puede marcarse como fallido.');
      await this.ledger.moveClubFunds(tx, {
        clubId: current.clubId, amountCents: current.amountCents, from: 'HELD', to: 'AVAILABLE',
        reference: `WITHDRAWAL_FAILED_RELEASE:${id}`, description: 'Liberación por retiro fallido', withdrawalRequestId: id, type: 'ADJUSTMENT',
      });
      return (tx as any).withdrawalRequest.update({ where: { id }, data: { status: 'FAILED', rejectionReason: reason.trim(), failedAt: new Date() } });
    });
    await this.notify(result.requestedByUserId, 'WITHDRAWAL_REJECTED', result);
    return result;
  }

  private async transition(id: string, allowed: string[], data: Record<string, unknown>) {
    const current = await (this.prisma as any).withdrawalRequest.findUnique({ where: { id } });
    if (!current) throw notFound('WITHDRAWAL_NOT_FOUND', 'No encontramos la solicitud de retiro.');
    if (!allowed.includes(current.status)) throw conflict('WITHDRAWAL_INVALID_TRANSITION', 'La transición del retiro no es válida.');
    return (this.prisma as any).withdrawalRequest.update({ where: { id }, data });
  }

  private async assertClubAdmin(user: AuthenticatedUser, clubId: string) {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (user.role !== UserRole.ADMIN) throw forbidden('WITHDRAWAL_FORBIDDEN', 'Solo un administrador puede gestionar retiros.');
    const admin = await this.prisma.clubAdmin.findUnique({ where: { clubId_userId: { clubId, userId: user.id } } });
    if (!admin) throw forbidden('WITHDRAWAL_FORBIDDEN', 'No administras este negocio.');
  }

  private assertSuperAdmin(user: AuthenticatedUser) {
    if (user.role !== UserRole.SUPER_ADMIN) throw forbidden('WITHDRAWAL_REVIEW_FORBIDDEN', 'Solo Super Admin puede revisar retiros.');
  }

  private encrypt(value: string) {
    const configured = this.config.get<string>('FINANCIAL_DATA_ENCRYPTION_KEY');
    if (!configured && this.config.get<string>('NODE_ENV') === 'production') throw new Error('FINANCIAL_DATA_ENCRYPTION_KEY_REQUIRED');
    const key = createHash('sha256').update(configured ?? 'beerry-dev-financial-key').digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  private publicProfile(profile: any) {
    const safeProfile = { ...profile };
    delete safeProfile.bankAccountEncrypted;
    return { ...safeProfile, maskedBankAccount: `•••• ${profile.bankAccountLast4}` };
  }

  private audit(actorUserId: string, clubId: string, action: string, resourceType: string, resourceId: string) {
    return this.prisma.auditLogEntry.create({ data: { actorUserId, clubId, action, resourceType, resourceId } });
  }

  private notify(userId: string, template: string, withdrawal: any) {
    return this.notifications?.notifyFromTemplate(userId, template, {
      amount: (withdrawal.amountCents / 100).toFixed(2), withdrawalId: withdrawal.id,
    }, { withdrawalId: withdrawal.id });
  }
}
