import { OptionalField } from '../../../../shared/presentation/dto-fields';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateMyProfileDto {
  @ApiPropertyOptional({ example: 'Edson Meza' })
  @IsString({ message: 'El nombre completo debe ser texto.' })
  @MaxLength(120, { message: 'El nombre completo no puede exceder 120 caracteres.' })
  @OptionalField()
  fullName?: string;

  @ApiPropertyOptional({ example: 'admin@beerry.app' })
  @ValidateIf((object: UpdateMyProfileDto) => (object.email ?? '') != '')
  @IsEmail({}, { message: 'El correo electronico no es valido.' })
  @OptionalField({ nullable: true, type: String })
  email?: string | null;

  @ApiPropertyOptional({ example: 'uuid-del-upload' })
  @IsString({ message: 'El imageUploadId debe ser texto.' })
  @OptionalField()
  imageUploadId?: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean({ message: 'removeProfileImage debe ser booleano.' })
  @OptionalField()
  removeProfileImage?: boolean;
}
