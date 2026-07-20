import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { UploadsService } from '../application/uploads.service';
import { CreatePresignedUploadUrlDto } from './dto/create-presigned-upload-url.dto';

@ApiTags('Uploads')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presigned-url')
  @ApiOperation({
    summary: 'Generar URL firmada para subir imagen',
    description:
      'Requiere accessToken. Se usa para generar una URL temporal de subida directa a S3 para imagenes que luego seran confirmadas y consumidas por otros modulos.',
  })
  @ApiResponse({ status: 201, description: 'URL firmada generada correctamente.' })
  createPresignedUploadUrl(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: CreatePresignedUploadUrlDto,
  ) {
    return this.uploadsService.createPresignedUploadUrl(currentUser, body);
  }

  @Post(':uploadId/confirm')
  @ApiOperation({
    summary: 'Confirmar upload temporal',
    description:
      'Requiere accessToken. Verifica el objeto en S3, valida tamano/tipo y deja el archivo disponible temporalmente para ser consumido por otro modulo.',
  })
  @ApiResponse({ status: 201, description: 'Upload confirmado correctamente.' })
  confirmUpload(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('uploadId') uploadId: string,
  ) {
    return this.uploadsService.confirmUpload(currentUser, uploadId);
  }
}
