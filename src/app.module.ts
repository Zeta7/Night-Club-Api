import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClubsModule } from './modules/clubs/clubs.module';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { PlatformModule } from './modules/platform/platform.module';
import { ProductsModule } from './modules/products/products.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { UsersModule } from './modules/users/users.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';
import { CommerceModule } from './modules/commerce/commerce.module';
import { AuditModule } from './modules/audit/audit.module';
import { ReferralsModule } from './modules/referrals/referrals.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    HealthModule,
    IdentityModule,
    PlatformModule,
    ClubsModule,
    EventsModule,
    ProductsModule,
    PromotionsModule,
    TicketsModule,
    UploadsModule,
    UsersModule,
    WalletsModule,
    CommerceModule,
    AuditModule,
    ReferralsModule,
  ],
})
export class AppModule {}
