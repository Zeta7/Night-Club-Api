import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductStatus, UserRole } from '@prisma/client';
import { buildMediaUrl } from '../../../shared/infrastructure/media/media-url';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { badRequest, forbidden, notFound } from '../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { UploadsService } from '../../uploads/application/uploads.service';
import { CreateProductDto } from '../presentation/dto/create-product.dto';
import { UpdateProductDto } from '../presentation/dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
    private readonly config: ConfigService,
  ) {}

  async createProduct(currentUser: AuthenticatedUser, clubId: string, input: CreateProductDto) {
    await this.assertCanManageClub(currentUser, clubId);
    this.assertImageMutationInput(input.imageUploadId, input.removeImage);

    const product = await this.prisma.$transaction(async (tx) => {
      const consumedImage = input.imageUploadId
        ? await this.uploadsService.consumeUpload({
            uploadId: input.imageUploadId,
            userId: currentUser.id,
            transaction: tx,
          })
        : null;

      return tx.product.create({
        data: {
          clubId,
          name: normalizeText(input.name),
          description: normalizeOptionalText(input.description),
          imageUrl: consumedImage?.objectKey ?? null,
          priceCents: priceToCents(input.price),
          currency: normalizeCurrency(input.currency),
          stockQuantity: input.stockQuantity,
          status: resolveProductStatus(input.stockQuantity),
        },
      });
    });

    return {
      message: 'Producto creado correctamente.',
      product: toProductResponse(product, this.config),
    };
  }

  async listProducts(currentUser: AuthenticatedUser, clubId: string) {
    await this.assertCanManageClub(currentUser, clubId);
    const products = await this.prisma.product.findMany({
      where: { clubId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      message: 'Productos del club obtenidos correctamente.',
      products: products.map((product) => toProductResponse(product, this.config)),
    };
  }

  async getProduct(currentUser: AuthenticatedUser, clubId: string, productId: string) {
    await this.assertCanManageClub(currentUser, clubId);
    const product = await this.findProductOrFail(clubId, productId);

    return {
      message: 'Producto obtenido correctamente.',
      product: toProductResponse(product, this.config),
    };
  }

  async updateProduct(
    currentUser: AuthenticatedUser,
    clubId: string,
    productId: string,
    input: UpdateProductDto,
  ) {
    await this.assertCanManageClub(currentUser, clubId);
    const currentProduct = await this.findProductOrFail(clubId, productId);
    this.assertImageMutationInput(input.imageUploadId, input.removeImage);

    const data: {
      name?: string;
      description?: string | null;
      imageUrl?: string | null;
      priceCents?: number;
      currency?: string;
      stockQuantity?: number;
      status?: ProductStatus;
    } = {};

    if (input.name !== undefined) data.name = normalizeText(input.name);
    if (input.description !== undefined) {
      data.description = normalizeOptionalText(input.description);
    }
    if (input.price !== undefined) data.priceCents = priceToCents(input.price);
    if (input.currency !== undefined) data.currency = normalizeCurrency(input.currency);
    if (input.stockQuantity !== undefined) {
      data.stockQuantity = input.stockQuantity;
      data.status = currentProduct.status === ProductStatus.INACTIVE
        ? ProductStatus.INACTIVE
        : resolveProductStatus(input.stockQuantity);
    }

    const product = await this.prisma.$transaction(async (tx) => {
      if (input.imageUploadId) {
        const replacement = await this.uploadsService.replaceUpload({
          uploadId: input.imageUploadId,
          userId: currentUser.id,
          previousObjectKey: currentProduct.imageUrl,
          transaction: tx,
        });
        data.imageUrl = replacement.objectKey;
      } else if (input.removeImage) {
        data.imageUrl = null;
        await this.uploadsService.queueObjectDeletion(currentProduct.imageUrl, tx);
      }

      return tx.product.update({
        where: { id: productId },
        data,
      });
    });

    return {
      message: 'Producto actualizado correctamente.',
      product: toProductResponse(product, this.config),
    };
  }

  async activateProduct(currentUser: AuthenticatedUser, clubId: string, productId: string) {
    await this.assertCanManageClub(currentUser, clubId);
    const product = await this.findProductOrFail(clubId, productId);

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { status: resolveProductStatus(product.stockQuantity) },
    });

    return {
      message: 'Producto activado correctamente.',
      product: toProductResponse(updated, this.config),
    };
  }

  async deactivateProduct(currentUser: AuthenticatedUser, clubId: string, productId: string) {
    await this.assertCanManageClub(currentUser, clubId);
    await this.findProductOrFail(clubId, productId);

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { status: ProductStatus.INACTIVE },
    });

    return {
      message: 'Producto desactivado correctamente.',
      product: toProductResponse(updated, this.config),
    };
  }

  async deleteProduct(currentUser: AuthenticatedUser, clubId: string, productId: string) {
    await this.assertCanManageClub(currentUser, clubId);
    const product = await this.findProductOrFail(clubId, productId);

    await this.prisma.$transaction(async (tx) => {
      await tx.product.delete({ where: { id: productId } });
      await this.uploadsService.queueObjectDeletion(product.imageUrl, tx);
    });

    return {
      message: 'Producto eliminado correctamente.',
    };
  }

  private async assertCanManageClub(currentUser: AuthenticatedUser, clubId: string) {
    const club = await this.prisma.club.findUnique({ where: { id: clubId }, select: { id: true } });
    if (!club) {
      throw notFound('CLUB_NOT_FOUND', 'No encontramos el club solicitado.');
    }

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      return;
    }

    if (currentUser.role !== UserRole.ADMIN) {
      throw forbidden('CLUB_MANAGE_FORBIDDEN', 'No tienes permisos para administrar este club.');
    }

    const clubAdmin = await this.prisma.clubAdmin.findUnique({
      where: { clubId_userId: { clubId, userId: currentUser.id } },
      select: { id: true },
    });

    if (!clubAdmin) {
      throw forbidden('CLUB_MANAGE_FORBIDDEN', 'No tienes permisos para administrar este club.');
    }
  }

  private async findProductOrFail(clubId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, clubId },
    });

    if (!product) {
      throw notFound('PRODUCT_NOT_FOUND', 'No encontramos el producto solicitado.');
    }

    return product;
  }

  private assertImageMutationInput(imageUploadId?: string, removeImage?: boolean) {
    if (imageUploadId && removeImage) {
      throw badRequest(
        'PRODUCT_IMAGE_INPUT_CONFLICT',
        'No puedes enviar imageUploadId y removeImage al mismo tiempo.',
      );
    }
  }
}

const normalizeText = (value: string) => value.trim();
const normalizeOptionalText = (value?: string) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};
const normalizeCurrency = (value?: string) => (value?.trim().toUpperCase() || 'PEN').slice(0, 3);
const priceToCents = (value: number) => Math.round(value * 100);
const centsToPrice = (value: number) => value / 100;
const resolveProductStatus = (stockQuantity: number) =>
  stockQuantity > 0 ? ProductStatus.ACTIVE : ProductStatus.OUT_OF_STOCK;

const toProductResponse = (
  product: {
    id: string;
    clubId: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    priceCents: number;
    currency: string;
    stockQuantity: number;
    status: ProductStatus;
    createdAt: Date;
    updatedAt: Date;
  },
  config: ConfigService,
) => ({
  id: product.id,
  clubId: product.clubId,
  name: product.name,
  description: product.description,
  imageUrl: buildMediaUrl(product.imageUrl, config),
  imageObjectKey: product.imageUrl,
  price: centsToPrice(product.priceCents),
  currency: product.currency,
  stockQuantity: product.stockQuantity,
  status: product.status,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
});
