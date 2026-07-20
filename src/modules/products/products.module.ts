import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ProductsService } from './application/products.service';
import { ClubProductsController } from './presentation/club-products.controller';

@Module({
  imports: [IdentityModule, UploadsModule],
  controllers: [ClubProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
