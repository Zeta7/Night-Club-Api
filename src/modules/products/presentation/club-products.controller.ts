import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MessageResponseDto } from '../../../shared/presentation/response.dto';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { ProductsService } from '../application/products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto, ProductsResponseDto } from './products.response.dto';

@ApiTags('Club Products')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('clubs/:clubId/products')
export class ClubProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear producto del club (ADMIN, SUPER_ADMIN)',
    description:
      'Crea un producto de inventario o venta para el club, incluyendo imagen, precio y stock.',
  })
  @ApiResponse({
    type: ProductResponseDto,
    status: 201,
    description: 'Producto creado correctamente.',
  })
  createProduct(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: CreateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.createProduct(currentUser, clubId, body);
  }

  @Get()
  @ApiOperation({ summary: 'Listar productos del club (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({
    type: ProductsResponseDto,
    status: 200,
    description: 'Productos del club obtenidos correctamente.',
  })
  listProducts(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ): Promise<ProductsResponseDto> {
    return this.productsService.listProducts(currentUser, clubId);
  }

  @Get(':productId')
  @ApiOperation({ summary: 'Obtener producto del club (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({
    type: ProductResponseDto,
    status: 200,
    description: 'Producto obtenido correctamente.',
  })
  getProduct(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('productId') productId: string,
  ): Promise<ProductResponseDto> {
    return this.productsService.getProduct(currentUser, clubId, productId);
  }

  @Patch(':productId')
  @ApiOperation({ summary: 'Actualizar producto del club (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({
    type: ProductResponseDto,
    status: 200,
    description: 'Producto actualizado correctamente.',
  })
  updateProduct(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('productId') productId: string,
    @Body() body: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.updateProduct(currentUser, clubId, productId, body);
  }

  @Patch(':productId/activate')
  @ApiOperation({ summary: 'Activar producto del club (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({
    type: ProductResponseDto,
    status: 200,
    description: 'Producto activado correctamente.',
  })
  activateProduct(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('productId') productId: string,
  ): Promise<ProductResponseDto> {
    return this.productsService.activateProduct(currentUser, clubId, productId);
  }

  @Patch(':productId/deactivate')
  @ApiOperation({ summary: 'Desactivar producto del club (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({
    type: ProductResponseDto,
    status: 200,
    description: 'Producto desactivado correctamente.',
  })
  deactivateProduct(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('productId') productId: string,
  ): Promise<ProductResponseDto> {
    return this.productsService.deactivateProduct(currentUser, clubId, productId);
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Eliminar producto del club (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({
    type: MessageResponseDto,
    status: 200,
    description: 'Producto eliminado correctamente.',
  })
  deleteProduct(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('productId') productId: string,
  ): Promise<MessageResponseDto> {
    return this.productsService.deleteProduct(currentUser, clubId, productId);
  }
}
