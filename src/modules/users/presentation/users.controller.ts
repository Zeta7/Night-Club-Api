import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { UsersService } from '../application/users.service';
import { SearchUsersDto } from './dto/search-users.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Buscar usuarios por nombre o telefono (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Se usa para buscar usuarios por nombre, telefono o email y seleccionar uno sin ingresar su ID manualmente. ADMIN recibe usuarios activos; SUPER_ADMIN puede buscar usuarios de la plataforma.',
  })
  @ApiResponse({ status: 200, description: 'Usuarios encontrados correctamente.' })
  searchUsers(@CurrentUser() currentUser: AuthenticatedUser, @Query() query: SearchUsersDto) {
    return this.usersService.searchUsers(currentUser, query);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Actualizar perfil propio (CLIENTE, TRABAJADOR, ADMIN, SUPER_ADMIN)',
    description:
      'Permite actualizar nombre, email y foto de perfil del usuario autenticado usando accessToken.',
  })
  @ApiResponse({ status: 200, description: 'Perfil actualizado correctamente.' })
  updateMyProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: UpdateMyProfileDto,
  ) {
    return this.usersService.updateMyProfile(currentUser, body);
  }
}
