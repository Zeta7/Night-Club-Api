import { OmitType, PartialType } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { OptionalField } from '../../../../shared/presentation/dto-fields';
import { CreateClubDto } from './create-club.dto';

export class UpdateClubDto extends PartialType(
  OmitType(CreateClubDto, ['coverImage', 'profileImage'] as const),
  { skipNullProperties: false },
) {
  @OptionalField({ type: String, nullable: true, example: '' })
  @IsString({ message: 'La imagen de portada debe ser texto.' })
  coverImage?: string | null;

  @OptionalField({ type: String, nullable: true, example: '' })
  @IsString({ message: 'La imagen de perfil debe ser texto.' })
  profileImage?: string | null;
}
