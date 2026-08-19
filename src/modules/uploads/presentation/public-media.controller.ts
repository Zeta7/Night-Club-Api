import { Controller, Get, Param, Redirect } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { UploadsService } from '../application/uploads.service';

@ApiExcludeController()
@Controller('media')
export class PublicMediaController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get('*path')
  @Redirect(undefined, 302)
  async readImage(@Param('path') path: string | string[]) {
    const normalizedPath = Array.isArray(path) ? path.join('/') : path;
    const url = await this.uploadsService.createPublicImageRedirect(normalizedPath);
    return { url };
  }
}
