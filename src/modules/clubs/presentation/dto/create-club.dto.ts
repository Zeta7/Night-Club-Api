import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  ArrayMaxSize,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const businessTypes = ['club', 'discoteca', 'karaoke', 'bar', 'restobar', 'lounge'] as const;
const socialTypes = ['tiktok', 'instagram', 'facebook', 'web'] as const;
const scheduleDays = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export class ClubAddressDto {
  @ApiPropertyOptional({ example: 'Av. Larco 1234' })
  @IsString({ message: 'La direccion debe ser texto.' })
  @IsOptional()
  direccion?: string;

  @ApiPropertyOptional({ example: 'Miraflores' })
  @IsString({ message: 'El distrito debe ser texto.' })
  @IsOptional()
  distrito?: string;

  @ApiPropertyOptional({ example: 'Lima' })
  @IsString({ message: 'La provincia debe ser texto.' })
  @IsOptional()
  provincia?: string;

  @ApiPropertyOptional({ example: 'Lima' })
  @IsString({ message: 'El departamento debe ser texto.' })
  @IsOptional()
  departamento?: string;

  @ApiPropertyOptional({ example: 'Peru' })
  @IsString({ message: 'El pais debe ser texto.' })
  @IsOptional()
  pais?: string;

  @ApiPropertyOptional({ example: -12.1219 })
  @IsNumber({}, { message: 'La latitud debe ser numerica.' })
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: -77.0306 })
  @IsNumber({}, { message: 'La longitud debe ser numerica.' })
  @IsOptional()
  longitude?: number;
}

export class ClubContactDto {
  @ApiPropertyOptional({ example: '+51987654321' })
  @IsString({ message: 'El telefono debe ser texto.' })
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'contacto@minegocio.pe' })
  @ValidateIf((_, value) => value !== undefined && value !== '')
  @IsEmail({}, { message: 'El correo del club no tiene un formato valido.' })
  @IsOptional()
  email?: string;
}

export class ClubSocialMediaDto {
  @ApiProperty({ example: 'instagram', enum: socialTypes })
  @IsIn(socialTypes, { message: 'La red social no es valida.' })
  type!: (typeof socialTypes)[number];

  @ApiProperty({ example: 'https://instagram.com/point' })
  @IsUrl({}, { message: 'La URL de la red social debe ser valida.' })
  url!: string;
}

export class ClubScheduleDayDto {
  @ApiProperty({ example: 'friday', enum: scheduleDays })
  @IsIn(scheduleDays, { message: 'El dia del horario no es valido.' })
  day!: (typeof scheduleDays)[number];

  @ApiProperty({ example: true })
  @IsBoolean({ message: 'El estado abierto/cerrado debe ser booleano.' })
  isOpen!: boolean;

  @ApiPropertyOptional({ example: '22:00' })
  @IsString({ message: 'La hora de apertura debe ser texto.' })
  @Matches(/^$|^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'La hora de apertura debe tener formato HH:mm.',
  })
  @IsOptional()
  openTime?: string;

  @ApiPropertyOptional({ example: '07:00' })
  @IsString({ message: 'La hora de cierre debe ser texto.' })
  @Matches(/^$|^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'La hora de cierre debe tener formato HH:mm.',
  })
  @IsOptional()
  closeTime?: string;
}

export class CreateClubDto {
  @ApiProperty({ example: '' })
  @IsString({ message: 'La imagen de portada debe ser texto.' })
  coverImage!: string;

  @ApiPropertyOptional({ description: 'ID temporal de la nueva imagen de portada.' })
  @IsOptional()
  @IsUUID('4', { message: 'El identificador de portada no es valido.' })
  coverImageUploadId?: string;

  @ApiProperty({ example: '' })
  @IsString({ message: 'La imagen de perfil debe ser texto.' })
  profileImage!: string;

  @ApiPropertyOptional({ description: 'ID temporal de la nueva imagen de perfil.' })
  @IsOptional()
  @IsUUID('4', { message: 'El identificador de perfil no es valido.' })
  profileImageUploadId?: string;

  @ApiProperty({ example: 'Club Nocturno Central' })
  @IsString({ message: 'El nombre del club debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre del club es obligatorio.' })
  @MaxLength(120, { message: 'El nombre del club no debe superar 120 caracteres.' })
  name!: string;

  @ApiProperty({ example: 'club', enum: businessTypes })
  @IsIn(businessTypes, { message: 'El tipo de negocio no es valido.' })
  type!: (typeof businessTypes)[number];

  @ApiPropertyOptional({ example: 'Local nocturno ubicado en el centro de la ciudad.' })
  @IsString({ message: 'La descripcion debe ser texto.' })
  @IsOptional()
  description?: string;

  @ApiProperty({ type: ClubAddressDto })
  @ValidateNested()
  @Type(() => ClubAddressDto)
  address!: ClubAddressDto;

  @ApiProperty({ type: ClubContactDto })
  @ValidateNested()
  @Type(() => ClubContactDto)
  contact!: ClubContactDto;

  @ApiPropertyOptional({ type: [ClubSocialMediaDto] })
  @IsArray({ message: 'Las redes sociales deben enviarse como una lista.' })
  @ArrayMaxSize(10, { message: 'No puedes registrar mas de 10 redes sociales.' })
  @ValidateNested({ each: true })
  @Type(() => ClubSocialMediaDto)
  @IsOptional()
  socialMedia?: ClubSocialMediaDto[];

  @ApiProperty({ type: [ClubScheduleDayDto] })
  @IsArray({ message: 'El horario debe enviarse como una lista.' })
  @ArrayMaxSize(7, { message: 'El horario debe tener maximo 7 dias.' })
  @ValidateNested({ each: true })
  @Type(() => ClubScheduleDayDto)
  schedule!: ClubScheduleDayDto[];
}
