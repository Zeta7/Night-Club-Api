import { Body, Controller, Get, Headers, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PreLaunchService } from '../application/prelaunch.service';
import {
  CheckPreLaunchPhoneDto,
  CreateBusinessPreLaunchApplicationDto,
  PreLaunchAccessDto,
  RecoverPreLaunchAccessDto,
  RequestPreLaunchOtpDto,
  StartPreLaunchRegistrationDto,
  TrackPreLaunchEventDto,
  UpdatePreLaunchPreferencesDto,
  VerifyPreLaunchOtpDto,
} from './dto/prelaunch.dto';
import {
  PreLaunchAccessStatusResponseDto,
  PreLaunchBusinessApplicationResponseDto,
  PreLaunchLocationsResponseDto,
  PreLaunchMessageResponseDto,
  PreLaunchOtpChallengeResponseDto,
  PreLaunchOverviewResponseDto,
  PreLaunchPhoneStateResponseDto,
  PreLaunchPreferencesSavedResponseDto,
  PreLaunchRecordedResponseDto,
  PreLaunchVenueOptionsResponseDto,
} from './prelaunch.response.dto';

@ApiTags('Prelanzamiento público')
@Controller('prelaunch')
export class PreLaunchController {
  constructor(private readonly prelaunch: PreLaunchService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Obtener contadores, mercados y negocios públicos del prelanzamiento' })
  @ApiResponse({ status: 200, type: PreLaunchOverviewResponseDto })
  overview() {
    return this.prelaunch.overview();
  }

  @Get('locations')
  @ApiOperation({ summary: 'Obtener el catálogo oficial UBIGEO del Perú' })
  @ApiResponse({ status: 200, type: PreLaunchLocationsResponseDto })
  locations() {
    return this.prelaunch.locations();
  }

  @Get('venue-options')
  @ApiOperation({
    summary: 'Listar establecimientos disponibles para sugerencias del prelanzamiento',
  })
  @ApiResponse({ status: 200, type: PreLaunchVenueOptionsResponseDto })
  venueOptions() {
    return this.prelaunch.venueOptions();
  }

  @Post('phone-check')
  @ApiOperation({ summary: 'Saber si un celular ya está registrado, sin enviar ningún mensaje' })
  @ApiResponse({ status: 201, type: PreLaunchPhoneStateResponseDto })
  phoneCheck(
    @Body() body: CheckPreLaunchPhoneDto,
    @Req() request: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.prelaunch.checkPhone(body, context(request, userAgent));
  }

  @Post('access/recover')
  @ApiOperation({ summary: 'Enviar el código de recuperación a un registro ya verificado' })
  @ApiResponse({ status: 201, type: PreLaunchOtpChallengeResponseDto })
  recover(
    @Body() body: RecoverPreLaunchAccessDto,
    @Req() request: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.prelaunch.recoverAccess(body, context(request, userAgent));
  }

  @Post('registrations')
  @ApiOperation({ summary: 'Crear registro de acceso anticipado y enviar OTP' })
  @ApiResponse({ status: 201, type: PreLaunchOtpChallengeResponseDto })
  start(
    @Body() body: StartPreLaunchRegistrationDto,
    @Req() request: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.prelaunch.startRegistration(body, context(request, userAgent));
  }

  @Post('otp/resend')
  @ApiOperation({ summary: 'Reenviar OTP del registro de acceso anticipado' })
  @ApiResponse({ status: 201, type: PreLaunchMessageResponseDto })
  resend(
    @Body() body: RequestPreLaunchOtpDto,
    @Req() request: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.prelaunch.resendOtp(
      body.accessToken,
      body.turnstileToken,
      context(request, userAgent),
    );
  }

  @Post('otp/verify')
  @ApiOperation({ summary: 'Verificar teléfono y activar acceso anticipado' })
  @ApiResponse({ status: 201, type: PreLaunchAccessStatusResponseDto })
  verify(
    @Body() body: VerifyPreLaunchOtpDto,
    @Req() request: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.prelaunch.verifyOtp(body.accessToken, body.code, context(request, userAgent));
  }

  @Post('access/status')
  @ApiOperation({
    summary: 'Consultar posición, mercado, nivel y referidos del registro verificado',
  })
  @ApiResponse({ status: 201, type: PreLaunchAccessStatusResponseDto })
  status(@Body() body: PreLaunchAccessDto) {
    return this.prelaunch.accessStatus(body.accessToken);
  }

  @Post('preferences')
  @ApiOperation({ summary: 'Guardar preferencias opcionales después de verificar el acceso' })
  @ApiResponse({ status: 201, type: PreLaunchPreferencesSavedResponseDto })
  preferences(@Body() body: UpdatePreLaunchPreferencesDto) {
    return this.prelaunch.updatePreferences(body);
  }

  @Post('business-applications')
  @ApiOperation({ summary: 'Registrar solicitud de un negocio interesado' })
  @ApiResponse({ status: 201, type: PreLaunchBusinessApplicationResponseDto })
  business(
    @Body() body: CreateBusinessPreLaunchApplicationDto,
    @Req() request: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.prelaunch.createBusinessApplication(body, context(request, userAgent));
  }

  @Post('events')
  @ApiOperation({ summary: 'Registrar un evento público del embudo de prelanzamiento' })
  @ApiResponse({ status: 201, type: PreLaunchRecordedResponseDto })
  event(
    @Body() body: TrackPreLaunchEventDto,
    @Req() request: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.prelaunch.track(body, context(request, userAgent));
  }
}

const context = (request: Request, userAgent?: string) => ({
  ip: request.ip || request.socket.remoteAddress,
  userAgent: userAgent ?? null,
});
