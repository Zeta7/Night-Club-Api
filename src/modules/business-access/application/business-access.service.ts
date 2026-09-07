import { Injectable } from '@nestjs/common';
import { BusinessAccessRequestStatus, BusinessAccessRequestType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { badRequest, conflict, notFound } from '../../../shared/presentation/api-exception';
import { AuditService } from '../../audit/application/audit.service';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { NotificationService } from '../../notification/application/notification.service';
import { CreateBusinessAccessRequestDto } from '../presentation/dto/create-business-access-request.dto';
import { ListBusinessAccessRequestsDto } from '../presentation/dto/list-business-access-requests.dto';

const ACTIVE_STATUSES: BusinessAccessRequestStatus[] = [
  BusinessAccessRequestStatus.PENDING,
  BusinessAccessRequestStatus.UNDER_REVIEW,
];

@Injectable()
export class BusinessAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  async create(user: AuthenticatedUser, input: CreateBusinessAccessRequestDto) {
    if (!input.acceptedReview) {
      throw badRequest(
        'BUSINESS_ACCESS_REVIEW_CONSENT_REQUIRED',
        'Debes aceptar que Beerry revise la información.',
      );
    }
    if (
      input.type === BusinessAccessRequestType.ADMINISTER_EXISTING_BUSINESS &&
      !input.requestedClubId
    ) {
      throw badRequest('REQUESTED_CLUB_REQUIRED', 'Selecciona el negocio que deseas administrar.');
    }
    if (input.type === BusinessAccessRequestType.REGISTER_NEW_BUSINESS && input.requestedClubId) {
      throw badRequest(
        'REQUESTED_CLUB_NOT_ALLOWED',
        'Una solicitud de registro nuevo no debe indicar un negocio existente.',
      );
    }
    if (input.requestedClubId) {
      const club = await this.prisma.club.findUnique({
        where: { id: input.requestedClubId },
        select: { id: true },
      });
      if (!club) throw notFound('CLUB_NOT_FOUND', 'No encontramos el negocio solicitado.');
      const authorized = await this.prisma.clubAdmin.findUnique({
        where: { clubId_userId: { clubId: club.id, userId: user.id } },
      });
      if (authorized)
        throw conflict('BUSINESS_ACCESS_ALREADY_GRANTED', 'Ya administras este negocio.');
    }
    const duplicate = await this.prisma.businessAccessRequest.findFirst({
      where: {
        userId: user.id,
        type: input.type,
        status: { in: ACTIVE_STATUSES },
        ...(input.requestedClubId
          ? { requestedClubId: input.requestedClubId }
          : { businessName: { equals: input.businessName.trim(), mode: 'insensitive' } }),
      },
    });
    if (duplicate)
      throw conflict(
        'BUSINESS_ACCESS_REQUEST_ACTIVE',
        'Ya tienes una solicitud activa para este negocio.',
      );
    const request = await this.prisma.businessAccessRequest.create({
      data: {
        userId: user.id,
        type: input.type,
        businessName: input.businessName.trim(),
        taxId: input.taxId?.trim() || null,
        location: input.location.trim(),
        phone: input.phone.trim(),
        socialUrl: input.socialUrl?.trim() || null,
        requestedClubId: input.requestedClubId ?? null,
        comment: input.comment?.trim() || null,
      },
    });
    await this.audit.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'CREATE_BUSINESS_ACCESS_REQUEST',
      resourceType: 'BUSINESS_ACCESS_REQUEST',
      resourceId: request.id,
      metadata: { type: request.type, requestedClubId: request.requestedClubId },
    });
    return { message: 'Solicitud enviada para revisión.', request };
  }

  async mine(userId: string) {
    return {
      items: await this.prisma.businessAccessRequest.findMany({
        where: { userId },
        include: { requestedClub: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    };
  }

  async getMine(userId: string, id: string) {
    const request = await this.prisma.businessAccessRequest.findFirst({
      where: { id, userId },
      include: { requestedClub: { select: { id: true, name: true } } },
    });
    if (!request)
      throw notFound('BUSINESS_ACCESS_REQUEST_NOT_FOUND', 'No encontramos la solicitud.');
    return { request };
  }

  async cancel(user: AuthenticatedUser, id: string) {
    const result = await this.prisma.businessAccessRequest.updateMany({
      where: { id, userId: user.id, status: BusinessAccessRequestStatus.PENDING },
      data: { status: BusinessAccessRequestStatus.CANCELLED },
    });
    if (result.count !== 1) {
      const existing = await this.prisma.businessAccessRequest.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing)
        throw notFound('BUSINESS_ACCESS_REQUEST_NOT_FOUND', 'No encontramos la solicitud.');
      throw conflict(
        'BUSINESS_ACCESS_REQUEST_NOT_CANCELLABLE',
        'Solo puedes cancelar una solicitud pendiente.',
      );
    }
    await this.audit.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'CANCEL_BUSINESS_ACCESS_REQUEST',
      resourceType: 'BUSINESS_ACCESS_REQUEST',
      resourceId: id,
    });
    return this.getMine(user.id, id);
  }

  async list(input: ListBusinessAccessRequestsDto) {
    const query = input.query?.trim();
    const where: Prisma.BusinessAccessRequestWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(query
        ? {
            OR: [
              { businessName: { contains: query, mode: 'insensitive' } },
              { taxId: { contains: query } },
              { user: { fullName: { contains: query, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.businessAccessRequest.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          requestedClub: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.businessAccessRequest.count({ where }),
    ]);
    return {
      items,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      },
    };
  }

  async getAdmin(id: string) {
    const request = await this.prisma.businessAccessRequest.findUnique({
      where: { id },
      include: { user: { select: { id: true, fullName: true, email: true } }, requestedClub: true },
    });
    if (!request)
      throw notFound('BUSINESS_ACCESS_REQUEST_NOT_FOUND', 'No encontramos la solicitud.');
    return { request };
  }

  async startReview(actor: AuthenticatedUser, id: string) {
    const result = await this.prisma.businessAccessRequest.updateMany({
      where: { id, status: BusinessAccessRequestStatus.PENDING },
      data: { status: BusinessAccessRequestStatus.UNDER_REVIEW, reviewedByUserId: actor.id },
    });
    if (result.count !== 1) {
      const current = await this.getAdmin(id);
      if (current.request.status === BusinessAccessRequestStatus.UNDER_REVIEW) return current;
      throw conflict(
        'BUSINESS_ACCESS_REQUEST_NOT_REVIEWABLE',
        'La solicitud ya no puede pasar a revisión.',
      );
    }
    await this.audit.record({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: 'START_BUSINESS_ACCESS_REVIEW',
      resourceType: 'BUSINESS_ACCESS_REQUEST',
      resourceId: id,
    });
    return this.getAdmin(id);
  }

  async approve(actor: AuthenticatedUser, id: string, reviewComment: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const request = await tx.businessAccessRequest.findUnique({ where: { id } });
      if (!request)
        throw notFound('BUSINESS_ACCESS_REQUEST_NOT_FOUND', 'No encontramos la solicitud.');
      if (request.status === BusinessAccessRequestStatus.APPROVED)
        return { request, clubId: request.requestedClubId };
      if (!ACTIVE_STATUSES.includes(request.status))
        throw conflict(
          'BUSINESS_ACCESS_REQUEST_NOT_APPROVABLE',
          'La solicitud ya no puede aprobarse.',
        );
      let clubId = request.requestedClubId;
      if (request.type === BusinessAccessRequestType.REGISTER_NEW_BUSINESS) {
        const club = await tx.club.create({
          data: {
            name: request.businessName,
            status: 'PENDING_APPROVAL',
            addressJson: { location: request.location },
            contactJson: { phone: request.phone },
            socialMediaJson: request.socialUrl
              ? { referenceUrl: request.socialUrl }
              : Prisma.JsonNull,
          },
        });
        clubId = club.id;
      }
      if (!clubId)
        throw conflict('REQUESTED_CLUB_REQUIRED', 'La solicitud no identifica un negocio.');
      await tx.clubAdmin.upsert({
        where: { clubId_userId: { clubId, userId: request.userId } },
        create: { clubId, userId: request.userId },
        update: {},
      });
      const approved = await tx.businessAccessRequest.update({
        where: { id },
        data: {
          status: BusinessAccessRequestStatus.APPROVED,
          requestedClubId: clubId,
          reviewedByUserId: actor.id,
          reviewComment: reviewComment.trim(),
          reviewedAt: new Date(),
        },
      });
      return { request: approved, clubId };
    });
    await this.audit.record({
      actorUserId: actor.id,
      actorRole: actor.role,
      clubId: result.clubId,
      action: 'APPROVE_BUSINESS_ACCESS_REQUEST',
      resourceType: 'BUSINESS_ACCESS_REQUEST',
      resourceId: id,
      severity: 'WARNING',
      metadata: { userId: result.request.userId, comment: reviewComment },
    });
    await this.notifications.notifyFromTemplate(
      result.request.userId,
      'BUSINESS_ACCESS_APPROVED',
      { businessName: result.request.businessName },
      { requestId: id, clubId: result.clubId },
    );
    return { message: 'Solicitud aprobada.', ...result };
  }

  async reject(actor: AuthenticatedUser, id: string, reviewComment: string) {
    const request = await this.prisma.businessAccessRequest.findUnique({ where: { id } });
    if (!request)
      throw notFound('BUSINESS_ACCESS_REQUEST_NOT_FOUND', 'No encontramos la solicitud.');
    if (request.status === BusinessAccessRequestStatus.REJECTED)
      return { message: 'Solicitud rechazada.', request };
    if (!ACTIVE_STATUSES.includes(request.status))
      throw conflict(
        'BUSINESS_ACCESS_REQUEST_NOT_REJECTABLE',
        'La solicitud ya no puede rechazarse.',
      );
    const rejected = await this.prisma.businessAccessRequest.update({
      where: { id },
      data: {
        status: BusinessAccessRequestStatus.REJECTED,
        reviewedByUserId: actor.id,
        reviewComment: reviewComment.trim(),
        reviewedAt: new Date(),
      },
    });
    await this.audit.record({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: 'REJECT_BUSINESS_ACCESS_REQUEST',
      resourceType: 'BUSINESS_ACCESS_REQUEST',
      resourceId: id,
      severity: 'WARNING',
      metadata: { userId: rejected.userId, comment: reviewComment },
    });
    await this.notifications.notifyFromTemplate(
      rejected.userId,
      'BUSINESS_ACCESS_REJECTED',
      { businessName: rejected.businessName, comment: rejected.reviewComment ?? '' },
      { requestId: id },
    );
    return { message: 'Solicitud rechazada.', request: rejected };
  }
}
