import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../application/auth.service';
import { AuthenticatedUser, CurrentUser } from './current-user';
import { ConfirmPhoneDto } from './dto/confirm-phone.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResendPhoneCodeDto } from './dto/resend-phone-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AccessTokenGuard } from './guards/access-token.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Registrar cliente con telefono y contrasena (CLIENTE)',
    description:
      'Usado por: Cliente. No requiere token. Se usa para crear una cuenta de cliente con telefono, contrasena y datos basicos; deja el usuario pendiente de confirmacion y envia un codigo al telefono registrado.',
  })
  @ApiResponse({ status: 201, description: 'Registro inicial procesado.' })
  register(@Body() body: RegisterUserDto) {
    return this.authService.register(body);
  }

  @Post('confirm-phone')
  @ApiOperation({
    summary: 'Confirmar telefono con codigo de verificacion (CLIENTE)',
    description:
      'Usado por: Cliente. No requiere token. Se usa para validar el codigo recibido por telefono, confirmar la propiedad del numero y completar la activacion inicial de la cuenta.',
  })
  confirmPhone(@Body() body: ConfirmPhoneDto) {
    return this.authService.confirmPhone(body);
  }

  @Post('resend-phone-code')
  @ApiOperation({
    summary: 'Reenviar codigo de confirmacion telefonica (CLIENTE)',
    description:
      'Usado por: Cliente. No requiere token. Se usa cuando el cliente necesita recibir nuevamente el codigo de confirmacion para poder verificar su telefono.',
  })
  resendPhoneCode(@Body() body: ResendPhoneCodeDto) {
    return this.authService.resendPhoneCode(body);
  }

  @Post('login')
  @ApiOperation({
    summary: 'Iniciar sesion con telefono y contrasena (CLIENTE, TRABAJADOR, ADMIN, SUPER_ADMIN)',
    description:
      'Usado por: Cliente, Trabajador, Admin y Super Admin. No requiere token. Se usa para autenticar credenciales validas y obtener accessToken y refreshToken para consumir endpoints protegidos.',
  })
  @ApiResponse({ status: 201, description: 'Inicio de sesion correcto.' })
  @ApiResponse({ status: 401, description: 'Credenciales invalidas o usuario no activo.' })
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Renovar token de acceso (USUARIO AUTENTICADO)',
    description:
      'Usado por: Usuario autenticado previamente. No requiere accessToken; requiere refreshToken valido. Se usa para generar un nuevo accessToken sin volver a iniciar sesion.',
  })
  @ApiResponse({ status: 201, description: 'Token renovado correctamente.' })
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body);
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cerrar sesion actual (CLIENTE, TRABAJADOR, ADMIN, SUPER_ADMIN)',
    description:
      'Usado por: Cliente, Trabajador, Admin y Super Admin. Requiere refreshToken para revocar la sesion. Se usa para cerrar sesion e invalidar el refreshToken entregado.',
  })
  @ApiResponse({ status: 201, description: 'Sesion cerrada correctamente.' })
  logout(@Body() body: LogoutDto) {
    return this.authService.logout(body);
  }

  @Post('password-reset/request')
  @ApiOperation({
    summary: 'Solicitar codigo para recuperar contrasena (CLIENTE, TRABAJADOR, ADMIN, SUPER_ADMIN)',
    description:
      'Usado por: Cliente, Trabajador, Admin y Super Admin. No requiere token. Se usa para iniciar la recuperacion de contrasena enviando un codigo de verificacion al telefono registrado.',
  })
  @ApiResponse({ status: 201, description: 'Codigo de recuperacion enviado.' })
  requestPasswordReset(@Body() body: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(body);
  }

  @Post('password-reset/confirm')
  @ApiOperation({
    summary:
      'Confirmar codigo y establecer nueva contrasena (CLIENTE, TRABAJADOR, ADMIN, SUPER_ADMIN)',
    description:
      'Usado por: Cliente, Trabajador, Admin y Super Admin. No requiere token. Se usa para validar el codigo de recuperacion y guardar una nueva contrasena para la cuenta.',
  })
  @ApiResponse({ status: 201, description: 'Contrasena actualizada correctamente.' })
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener usuario autenticado actual (CLIENTE, TRABAJADOR, ADMIN, SUPER_ADMIN)',
    description:
      'Usado por: Cliente, Trabajador, Admin y Super Admin. Requiere accessToken. Se usa para consultar los datos del usuario asociado al token enviado en la peticion.',
  })
  @ApiResponse({ status: 200, description: 'Usuario autenticado obtenido correctamente.' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }
}
