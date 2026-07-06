import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  badRequest,
  forbidden,
  notFound,
  serviceUnavailable,
} from '../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import {
  CreatePresignedUploadUrlDto,
  UploadResourceType,
} from '../presentation/dto/create-presigned-upload-url.dto';

const ALLOWED_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SIGNED_URL_EXPIRES_IN_SECONDS = 5 * 60;

@Injectable()
export class UploadsService {
  private readonly s3Client: S3Client;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.s3Client = new S3Client({
      region: this.config.get<string>('AWS_REGION'),
    });
  }

  async createPresignedUploadUrl(
    currentUser: AuthenticatedUser,
    input: CreatePresignedUploadUrlDto,
  ) {
    this.assertUploadsConfigured();
    this.assertAllowedImageContentType(input.contentType);

    const resourceScope = await this.resolveResourceScope(currentUser, input);
    const extension = getExtensionForContentType(input.contentType);
    const key = `${resourceScope.folder}/${resourceScope.resourceId}/images/${randomUUID()}.${extension}`;
    const bucket = this.getRequiredConfig('AWS_S3_BUCKET');

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: input.contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: SIGNED_URL_EXPIRES_IN_SECONDS,
    });

    return {
      message: 'URL firmada generada correctamente.',
      upload: {
        method: 'PUT',
        uploadUrl,
        publicUrl: this.buildPublicUrl(key),
        key,
        expiresInSeconds: SIGNED_URL_EXPIRES_IN_SECONDS,
        headers: {
          'Content-Type': input.contentType,
        },
      },
    };
  }

  private async resolveResourceScope(
    currentUser: AuthenticatedUser,
    input: CreatePresignedUploadUrlDto,
  ) {
    if (input.resourceType === UploadResourceType.CLUB) {
      await this.assertCanManageClub(currentUser, input.resourceId);

      return {
        folder: 'clubs',
        resourceId: input.resourceId,
      };
    }

    const event = await this.prisma.event.findUnique({
      where: { id: input.resourceId },
      select: { id: true, clubId: true },
    });

    if (!event) {
      throw notFound('EVENT_NOT_FOUND', 'No encontramos el evento solicitado.');
    }

    await this.assertCanManageClub(currentUser, event.clubId);

    return {
      folder: `clubs/${event.clubId}/events`,
      resourceId: event.id,
    };
  }

  private async assertCanManageClub(currentUser: AuthenticatedUser, clubId: string) {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true },
    });

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
      where: {
        clubId_userId: {
          clubId,
          userId: currentUser.id,
        },
      },
      select: { id: true },
    });

    if (!clubAdmin) {
      throw forbidden('CLUB_MANAGE_FORBIDDEN', 'No tienes permisos para administrar este club.');
    }
  }

  private assertUploadsConfigured() {
    this.getRequiredConfig('AWS_REGION');
    this.getRequiredConfig('AWS_S3_BUCKET');
  }

  private assertAllowedImageContentType(contentType: string) {
    if (!ALLOWED_IMAGE_CONTENT_TYPES.includes(contentType)) {
      throw badRequest(
        'UPLOAD_CONTENT_TYPE_NOT_ALLOWED',
        'Solo se permiten imagenes JPG, PNG o WEBP.',
      );
    }
  }

  private buildPublicUrl(key: string) {
    const cloudFrontUrl = this.config.get<string>('AWS_CLOUDFRONT_URL')?.replace(/\/+$/, '');

    if (cloudFrontUrl) {
      return `${cloudFrontUrl}/${key}`;
    }

    const bucket = this.getRequiredConfig('AWS_S3_BUCKET');
    const region = this.getRequiredConfig('AWS_REGION');

    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  private getRequiredConfig(key: string) {
    const value = this.config.get<string>(key);

    if (!value) {
      throw serviceUnavailable(
        'UPLOADS_NOT_CONFIGURED',
        `Falta configurar la variable de entorno ${key}.`,
      );
    }

    return value;
  }
}

const getExtensionForContentType = (contentType: string) => {
  if (contentType === 'image/jpeg') {
    return 'jpg';
  }

  if (contentType === 'image/png') {
    return 'png';
  }

  return 'webp';
};
