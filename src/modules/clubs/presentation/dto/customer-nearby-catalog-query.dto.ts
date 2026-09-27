import { Type } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { OptionalField } from '../../../../shared/presentation/dto-fields';
import { CustomerHomeQueryDto } from './customer-home-query.dto';

export class CustomerNearbyCatalogQueryDto extends CustomerHomeQueryDto {
  @OptionalField({
    type: 'integer',
    minimum: 1,
    maximum: 30,
    default: 20,
    description: 'Cantidad máxima de resultados por página.',
    example: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number;

  @OptionalField({
    type: 'string',
    description: 'Valor exacto de nextCursor entregado por la página anterior.',
    example:
      'eyJ2ZXJzaW9uIjoxLCJjYXRlZ29yeSI6ImV2ZW50cyIsImxvY2F0aW9uIjp7ImRpc3RyaWN0IjoiTWlyYWZsb3JlcyIsInByb3ZpbmNlIjoiTGltYSIsImRlcGFydG1lbnQiOiJMaW1hIn0sImFzT2YiOiIyMDI2LTA5LTI3VDAwOjAwOjAwLjAwMFoiLCJhZnRlcklkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAxIn0',
  })
  @IsString()
  @MaxLength(2048)
  cursor?: string;
}
