import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { UploadsModule } from '../uploads/uploads.module';
import { UsersService } from './application/users.service';
import { UsersController } from './presentation/users.controller';

@Module({
  imports: [IdentityModule, UploadsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
