import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationModule } from '../notification/notification.module';
import { AuthService } from './application/auth.service';
import { TokenService } from './application/token.service';
import { VerificationCodeService } from './application/verification-code.service';
import { AuthController } from './presentation/auth.controller';
import { AccessTokenGuard } from './presentation/guards/access-token.guard';

@Module({
  imports: [JwtModule.register({}), NotificationModule],
  controllers: [AuthController],
  providers: [AccessTokenGuard, AuthService, TokenService, VerificationCodeService],
  exports: [AccessTokenGuard, TokenService],
})
export class IdentityModule {}
