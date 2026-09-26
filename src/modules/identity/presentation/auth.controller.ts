import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MessageResponseDto } from '../../../shared/presentation/response.dto';
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
import {
  LoginResponseDto,
  RefreshTokenResponseDto,
  UserProfileResponseDto,
} from './identity.response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Registrar una cuenta de cliente (PUBLIC)',
    description:
      'Acceso público. Crea una cuenta CUSTOMER pendiente de confirmación y envía un código al teléfono registrado.',
  })
  @ApiResponse({
    type: UserProfileResponseDto,
    status: 201,
    description: 'Registro inicial procesado.',
  })
  register(@Body() body: RegisterUserDto): Promise<UserProfileResponseDto> {
    return this.authService.register(body);
  }

  @ApiResponse({ status: 201, type: MessageResponseDto })
  @Post('confirm-phone')
  @ApiOperation({
    summary: 'Confirmar el teléfono con un código de verificación (PUBLIC)',
    description:
      'Acceso público para cualquier rol. Valida el código enviado al teléfono y activa la cuenta.',
  })
  confirmPhone(@Body() body: ConfirmPhoneDto): Promise<MessageResponseDto> {
    return this.authService.confirmPhone(body);
  }

  @ApiResponse({ status: 201, type: MessageResponseDto })
  @Post('resend-phone-code')
  @ApiOperation({
    summary: 'Reenviar el código de confirmación del teléfono (PUBLIC)',
    description:
      'Acceso público para cualquier rol. Envía un nuevo código al teléfono de una cuenta pendiente de confirmación.',
  })
  resendPhoneCode(@Body() body: ResendPhoneCodeDto): Promise<MessageResponseDto> {
    return this.authService.resendPhoneCode(body);
  }

  @Post('login')
  @ApiOperation({
    summary: 'Iniciar sesión con teléfono y contraseña (PUBLIC)',
    description:
      'Acceso público para CUSTOMER, WORKER, ADMIN y SUPER_ADMIN. Valida las credenciales y devuelve accessToken y refreshToken.',
  })
  @ApiResponse({ type: LoginResponseDto, status: 201, description: 'Inicio de sesion correcto.' })
  @ApiResponse({ status: 401, description: 'Credenciales invalidas o usuario no activo.' })
  login(@Body() body: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(body);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Renovar el token de acceso (CUSTOMER, WORKER, ADMIN, SUPER_ADMIN)',
    description:
      'No requiere accessToken. Requiere un refreshToken válido de la sesión que se desea renovar.',
  })
  @ApiResponse({
    type: RefreshTokenResponseDto,
    status: 201,
    description: 'Token renovado correctamente.',
  })
  refresh(@Body() body: RefreshTokenDto): Promise<RefreshTokenResponseDto> {
    return this.authService.refresh(body);
  }

  @Post('logout')
  @ApiOperation({
    summary: 'Cerrar mi sesión (CUSTOMER, WORKER, ADMIN, SUPER_ADMIN)',
    description:
      'No requiere accessToken. Recibe el refreshToken de la sesión que se desea revocar.',
  })
  @ApiResponse({
    type: MessageResponseDto,
    status: 201,
    description: 'Sesion cerrada correctamente.',
  })
  logout(@Body() body: LogoutDto): Promise<MessageResponseDto> {
    return this.authService.logout(body);
  }

  @Post('password-reset/request')
  @ApiOperation({
    summary: 'Solicitar un código para recuperar la contraseña (PUBLIC)',
    description:
      'Acceso público para cualquier rol. Envía un código de recuperación al teléfono registrado.',
  })
  @ApiResponse({
    type: MessageResponseDto,
    status: 201,
    description: 'Codigo de recuperacion enviado.',
  })
  requestPasswordReset(@Body() body: RequestPasswordResetDto): Promise<MessageResponseDto> {
    return this.authService.requestPasswordReset(body);
  }

  @Post('password-reset/confirm')
  @ApiOperation({
    summary: 'Confirmar el código y establecer una nueva contraseña (PUBLIC)',
    description:
      'Acceso público para cualquier rol. Valida el código de recuperación y actualiza la contraseña de la cuenta.',
  })
  @ApiResponse({
    type: MessageResponseDto,
    status: 201,
    description: 'Contrasena actualizada correctamente.',
  })
  resetPassword(@Body() body: ResetPasswordDto): Promise<MessageResponseDto> {
    return this.authService.resetPassword(body);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Consultar mi usuario autenticado (CUSTOMER, WORKER, ADMIN, SUPER_ADMIN)',
    description:
      'Usado por: Cliente, Trabajador, Admin y Super Admin. Requiere accessToken. Se usa para consultar los datos del usuario asociado al token enviado en la peticion.',
  })
  @ApiResponse({
    type: UserProfileResponseDto,
    status: 200,
    description: 'Usuario autenticado obtenido correctamente.',
  })
  me(@CurrentUser() user: AuthenticatedUser): Promise<UserProfileResponseDto> {
    return this.authService.me(user.id);
  }
}
