import { OptionalField } from '../../../shared/presentation/dto-fields';
import { Transform } from 'class-transformer';
import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';

export class ValidateCodeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  code!: string;

  @OptionalField()
  @IsString()
  @MaxLength(2048)
  qrCode?: string;

  @OptionalField()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  confirm?: boolean;
}
