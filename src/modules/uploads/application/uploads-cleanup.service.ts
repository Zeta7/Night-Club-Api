import {
  DeleteObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  NotFound,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadStatus } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 50;

@Injectable()
export class UploadsCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UploadsCleanupService.name);
  private readonly s3Client: S3Client;
  private intervalHandle?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.s3Client = new S3Client({
      region: this.config.get<string>('AWS_REGION'),
    });
  }

  onModuleInit() {
    this.intervalHandle = setInterval(() => {
      void this.run();
    }, CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }
  }

  async run() {
    await this.cleanupExpiredUploads();
    await this.processPendingFileDeletions();
  }

  private async cleanupExpiredUploads() {
    const expiredUploads = await this.prisma.upload.findMany({
      where: {
        status: { in: [UploadStatus.PENDING, UploadStatus.TEMPORARY] },
        expiresAt: { lt: new Date() },
      },
      orderBy: { expiresAt: 'asc' },
      take: CLEANUP_BATCH_SIZE,
    });

    for (const upload of expiredUploads) {
      try {
        await this.deleteObjectIfPresent(upload.objectKey);
        await this.prisma.upload.delete({ where: { id: upload.id } });
      } catch (error) {
        this.logger.warn(`No se pudo limpiar upload expirado ${upload.id}: ${String(error)}`);
      }
    }
  }

  private async processPendingFileDeletions() {
    const pendingDeletions = await this.prisma.pendingFileDeletion.findMany({
      where: {
        deletedAt: null,
        nextAttemptAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      take: CLEANUP_BATCH_SIZE,
    });

    for (const item of pendingDeletions) {
      try {
        await this.deleteObjectIfPresent(item.objectKey);
        await this.prisma.pendingFileDeletion.update({
          where: { id: item.id },
          data: {
            deletedAt: new Date(),
            lastError: null,
          },
        });
      } catch (error) {
        await this.prisma.pendingFileDeletion.update({
          where: { id: item.id },
          data: {
            attempts: { increment: 1 },
            lastError: String(error),
            nextAttemptAt: new Date(Date.now() + 15 * 60 * 1000),
          },
        });
      }
    }
  }

  private async deleteObjectIfPresent(objectKey: string) {
    const bucket = this.config.get<string>('AWS_S3_BUCKET');
    if (!bucket) {
      return;
    }

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    });

    try {
      await this.s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
    } catch (error) {
      if (error instanceof NotFound || error instanceof NoSuchKey) {
        return;
      }
    }

    await this.s3Client.send(command);
  }
}
