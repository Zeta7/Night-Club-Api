import { Body, Controller, Post, UseGuards } from '@nestjs/common';
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
    summary: 'Generar URL firmada para subir imagen (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para generar una URL temporal de subida directa a S3 para imagenes de clubes o eventos existentes.',
  })
  @ApiResponse({ status: 201, description: 'URL firmada generada correctamente.' })
  createPresignedUploadUrl(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: CreatePresignedUploadUrlDto,
  ) {
    return this.uploadsService.createPresignedUploadUrl(currentUser, body);
  }
}
