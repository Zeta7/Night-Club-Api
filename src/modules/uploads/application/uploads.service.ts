import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UploadStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  buildMediaUrl,
  extractObjectKeyFromUrl,
} from '../../../shared/infrastructure/media/media-url';
import {
  badRequest,
  conflict,
  notFound,
  serviceUnavailable,
} from '../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { CreatePresignedUploadUrlDto } from '../presentation/dto/create-presigned-upload-url.dto';
import { UploadTransaction } from './uploads.types';

const ALLOWED_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_EXPIRES_IN_SECONDS = 5 * 60;
const TEMPORARY_UPLOAD_LIFETIME_MS = 6 * 60 * 60 * 1000;

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

  async createReadableImageUrl(value: string | null | undefined) {
    const normalized = value?.trim();
    if (!normalized) return null;
    const objectKey = extractObjectKeyFromUrl(normalized, this.config);
    if (!objectKey) return normalized;
    // Legacy images were stored as already-public root URLs. Only uploads
    // managed by the application live below a folder and require signing.
    if (/^https?:\/\//i.test(normalized) && !objectKey.includes('/')) {
      return normalized;
    }
    return buildMediaUrl(objectKey, this.config);
  }

  async createPublicImageRedirect(objectKeyValue: string) {
    const objectKey = extractObjectKeyFromUrl(objectKeyValue, this.config);
    if (!objectKey || !objectKey.startsWith('media/')) {
      throw notFound('MEDIA_NOT_FOUND', 'No encontramos la imagen solicitada.');
    }
    const bucket = this.getRequiredConfig('AWS_S3_BUCKET');
    return getSignedUrl(this.s3Client, new GetObjectCommand({ Bucket: bucket, Key: objectKey }), {
      expiresIn: SIGNED_URL_EXPIRES_IN_SECONDS,
    });
  }

  async createPresignedUploadUrl(
    currentUser: AuthenticatedUser,
    input: CreatePresignedUploadUrlDto,
  ) {
    this.assertUploadsConfigured();
    this.assertAllowedImageContentType(input.contentType);
    this.assertAllowedFileSize(input.sizeBytes);

    const sanitizedName = sanitizeOriginalName(input.fileName);
    const extension = resolveExtension(sanitizedName, input.contentType);
    const uploadId = randomUUID();
    const folderKey = buildFolderKey(input.folderName);
    const objectKey = `${folderKey}/${currentUser.id}/${uploadId}.${extension}`;
    const bucket = this.getRequiredConfig('AWS_S3_BUCKET');

    await this.prisma.upload.create({
      data: {
        id: uploadId,
        userId: currentUser.id,
        objectKey,
        originalName: sanitizedName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        status: UploadStatus.PENDING,
        expiresAt: new Date(Date.now() + TEMPORARY_UPLOAD_LIFETIME_MS),
      },
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: input.contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: SIGNED_URL_EXPIRES_IN_SECONDS,
    });

    return {
      message: 'URL firmada generada correctamente.',
      uploadId,
      uploadUrl,
      objectKey,
      expiresIn: SIGNED_URL_EXPIRES_IN_SECONDS,
      headers: {
        'Content-Type': input.contentType,
      },
    };
  }

  async confirmUpload(currentUser: AuthenticatedUser, uploadId: string) {
    this.assertUploadsConfigured();

    const upload = await this.prisma.upload.findFirst({
      where: {
        id: uploadId,
        userId: currentUser.id,
      },
    });

    if (!upload) {
      throw notFound('UPLOAD_NOT_FOUND', 'No encontramos el upload solicitado.');
    }

    if (upload.status !== UploadStatus.PENDING) {
      throw conflict(
        'UPLOAD_NOT_PENDING',
        'El upload ya no se encuentra pendiente de confirmacion.',
      );
    }

    if (upload.expiresAt && upload.expiresAt.getTime() < Date.now()) {
      throw badRequest('UPLOAD_EXPIRED', 'El upload ya expiro. Solicita una nueva URL.');
    }

    const bucket = this.getRequiredConfig('AWS_S3_BUCKET');

    try {
      const head = await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: upload.objectKey,
        }),
      );

      const contentType = head.ContentType ?? upload.contentType;
      const sizeBytes = Number(head.ContentLength ?? 0);
      this.assertAllowedImageContentType(contentType);
      this.assertAllowedFileSize(sizeBytes);

      const updated = await this.prisma.upload.update({
        where: { id: upload.id },
        data: {
          status: UploadStatus.TEMPORARY,
          confirmedAt: new Date(),
          contentType,
          sizeBytes,
        },
      });

      return {
        message: 'Upload confirmado correctamente.',
        uploadId: updated.id,
        status: updated.status,
        objectKey: updated.objectKey,
        url: buildMediaUrl(updated.objectKey, this.config),
      };
    } catch (error) {
      await this.safeDeleteObject(upload.objectKey);
      await this.prisma.upload.deleteMany({
        where: {
          id: upload.id,
          status: UploadStatus.PENDING,
        },
      });

      if (error instanceof NotFound || error instanceof NoSuchKey) {
        throw badRequest(
          'UPLOAD_FILE_NOT_FOUND',
          'No encontramos el archivo en S3. Vuelve a intentar la subida.',
        );
      }

      throw error;
    }
  }

  async consumeUpload(input: {
    uploadId: string;
    userId: string;
    transaction?: UploadTransaction;
  }) {
    const tx = input.transaction ?? this.prisma;
    const upload = await tx.upload.findFirst({
      where: {
        id: input.uploadId,
        userId: input.userId,
      },
    });

    if (!upload) {
      throw notFound('UPLOAD_NOT_FOUND', 'No encontramos el upload solicitado.');
    }

    this.assertTemporaryUploadAvailable(upload);

    const updateResult = await tx.upload.updateMany({
      where: {
        id: upload.id,
        userId: input.userId,
        status: UploadStatus.TEMPORARY,
      },
      data: {
        status: UploadStatus.USED,
        expiresAt: null,
      },
    });

    if (updateResult.count !== 1) {
      throw conflict('UPLOAD_ALREADY_USED', 'El upload ya fue consumido por otra operacion.');
    }

    return {
      id: upload.id,
      objectKey: upload.objectKey,
      url: buildMediaUrl(upload.objectKey, this.config),
    };
  }

  async consumeUploads(input: {
    uploadIds: string[];
    userId: string;
    transaction?: UploadTransaction;
  }) {
    const uniqueUploadIds = [
      ...new Set(input.uploadIds.map((item) => item.trim()).filter(Boolean)),
    ];
    if (uniqueUploadIds.length === 0) {
      return [];
    }

    const tx = input.transaction ?? this.prisma;
    const uploads = await tx.upload.findMany({
      where: {
        id: { in: uniqueUploadIds },
        userId: input.userId,
      },
    });

    if (uploads.length !== uniqueUploadIds.length) {
      throw notFound(
        'UPLOAD_NOT_FOUND',
        'Uno o mas uploads no existen o no pertenecen al usuario.',
      );
    }

    for (const upload of uploads) {
      this.assertTemporaryUploadAvailable(upload);
    }

    const updateResult = await tx.upload.updateMany({
      where: {
        id: { in: uniqueUploadIds },
        userId: input.userId,
        status: UploadStatus.TEMPORARY,
      },
      data: {
        status: UploadStatus.USED,
        expiresAt: null,
      },
    });

    if (updateResult.count !== uniqueUploadIds.length) {
      throw conflict('UPLOAD_ALREADY_USED', 'Uno o mas uploads ya fueron consumidos.');
    }

    const uploadMap = new Map(uploads.map((upload) => [upload.id, upload]));
    return uniqueUploadIds.map((uploadId) => {
      const upload = uploadMap.get(uploadId)!;
      return {
        id: upload.id,
        objectKey: upload.objectKey,
        url: buildMediaUrl(upload.objectKey, this.config),
      };
    });
  }

  async replaceUpload(input: {
    uploadId: string;
    userId: string;
    previousObjectKey?: string | null;
    transaction?: UploadTransaction;
  }) {
    const nextUpload = await this.consumeUpload(input);
    const normalizedPreviousKey = extractObjectKeyFromUrl(input.previousObjectKey, this.config);
    if (normalizedPreviousKey && normalizedPreviousKey !== nextUpload.objectKey) {
      const tx = input.transaction ?? this.prisma;
      await tx.pendingFileDeletion.upsert({
        where: { objectKey: normalizedPreviousKey },
        create: {
          objectKey: normalizedPreviousKey,
        },
        update: {
          deletedAt: null,
          nextAttemptAt: new Date(),
        },
      });
    }

    return nextUpload;
  }

  async queueObjectDeletion(objectKey: string | null | undefined, transaction?: UploadTransaction) {
    const normalizedKey = extractObjectKeyFromUrl(objectKey, this.config);
    if (!normalizedKey) {
      return;
    }

    const tx = transaction ?? this.prisma;
    await tx.pendingFileDeletion.upsert({
      where: { objectKey: normalizedKey },
      create: { objectKey: normalizedKey },
      update: {
        deletedAt: null,
        nextAttemptAt: new Date(),
      },
    });
  }

  private assertTemporaryUploadAvailable(upload: { status: UploadStatus; expiresAt: Date | null }) {
    if (upload.status !== UploadStatus.TEMPORARY) {
      throw conflict(
        'UPLOAD_NOT_TEMPORARY',
        'El upload no se encuentra disponible para ser usado.',
      );
    }

    if (upload.expiresAt && upload.expiresAt.getTime() < Date.now()) {
      throw badRequest('UPLOAD_EXPIRED', 'El upload ya expiro. Solicita una nueva subida.');
    }
  }

  private async safeDeleteObject(objectKey: string) {
    const bucket = this.config.get<string>('AWS_S3_BUCKET');
    if (!bucket) {
      return;
    }

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        }),
      );
    } catch {
      return;
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

  private assertAllowedFileSize(sizeBytes: number) {
    if (sizeBytes <= 0) {
      throw badRequest('UPLOAD_SIZE_INVALID', 'La imagen debe ser mayor a cero.');
    }

    if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
      throw badRequest('UPLOAD_TOO_LARGE', 'La imagen no debe superar 10 MB.');
    }
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

const sanitizeOriginalName = (fileName: string) => {
  const normalized = fileName.trim().replace(/[^\w.\- ]+/g, '_');
  return normalized || 'image';
};

const buildFolderKey = (folderName?: string) => {
  const slug = sanitizeFolderName(folderName);
  return slug ? `media/${slug}` : 'media/general';
};

const sanitizeFolderName = (folderName?: string) => {
  const normalized = folderName
    ?.trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return normalized || null;
};

const resolveExtension = (fileName: string, contentType: string) => {
  const extension = extname(fileName).replace('.', '').toLowerCase();
  const allowedByMime = getExtensionForContentType(contentType);

  if (!extension) {
    return allowedByMime;
  }

  if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
    throw badRequest(
      'UPLOAD_EXTENSION_NOT_ALLOWED',
      'La extension del archivo no es valida para imagenes permitidas.',
    );
  }

  if ((extension === 'jpg' || extension === 'jpeg') && contentType !== 'image/jpeg') {
    throw badRequest(
      'UPLOAD_EXTENSION_MISMATCH',
      'La extension no coincide con el tipo de imagen.',
    );
  }

  if (extension === 'png' && contentType !== 'image/png') {
    throw badRequest(
      'UPLOAD_EXTENSION_MISMATCH',
      'La extension no coincide con el tipo de imagen.',
    );
  }

  if (extension === 'webp' && contentType !== 'image/webp') {
    throw badRequest(
      'UPLOAD_EXTENSION_MISMATCH',
      'La extension no coincide con el tipo de imagen.',
    );
  }

  return extension === 'jpeg' ? 'jpg' : extension;
};

const getExtensionForContentType = (contentType: string) => {
  if (contentType === 'image/jpeg') {
    return 'jpg';
  }

  if (contentType === 'image/png') {
    return 'png';
  }

  return 'webp';
};
