import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { OptionalField } from '../../../../shared/presentation/dto-fields';
import { CreatePromotionDto } from './create-promotion.dto';

export class UpdatePromotionDto extends PartialType(CreatePromotionDto, {
  skipNullProperties: false,
}) {
  @ApiPropertyOptional({ description: 'Quita el inicio programado. No combinar con startsAt.', default: false })
  @OptionalField()
  @IsBoolean()
  removeStartsAt?: boolean;

  @ApiPropertyOptional({ description: 'Quita el fin propio. El fin del evento sigue limitando la promoción. No combinar con endsAt.', default: false })
  @OptionalField()
  @IsBoolean()
  removeEndsAt?: boolean;
}
