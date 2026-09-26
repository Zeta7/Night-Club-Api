import { ApiProperty } from '@nestjs/swagger';
import { UploadStatus } from '@prisma/client';

export class UploadHeadersDto {
  @ApiProperty({
    enum: ['image/jpeg', 'image/png', 'image/webp'],
    enumName: 'UploadHeadersContent-Type',
  })
  'Content-Type'!: 'image/jpeg' | 'image/png' | 'image/webp';
}

export class PresignedUploadResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: 'string' })
  uploadId!: string;

  @ApiProperty({ type: 'string' })
  uploadUrl!: string;

  @ApiProperty({ type: 'string' })
  objectKey!: string;

  @ApiProperty({ type: 'integer' })
  expiresIn!: number;

  @ApiProperty({ type: () => UploadHeadersDto })
  headers!: UploadHeadersDto;
}

export class ConfirmedUploadResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: 'string' })
  uploadId!: string;

  @ApiProperty({ enum: UploadStatus, enumName: 'UploadStatus' })
  status!: UploadStatus;

  @ApiProperty({ type: 'string' })
  objectKey!: string;

  @ApiProperty({ type: 'string', nullable: true })
  url!: string | null;
}
