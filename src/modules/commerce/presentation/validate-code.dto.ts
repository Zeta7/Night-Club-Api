import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ValidateCodeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  qrCode?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  confirm?: boolean;
}
