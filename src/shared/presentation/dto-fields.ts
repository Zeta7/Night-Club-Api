import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiPropertyOptions } from '@nestjs/swagger';
import { IsInt, ValidateIf, ValidationOptions } from 'class-validator';

/** Validate a whole number and publish the same constraint to SDK generators. */
export function IsInteger(options?: ValidationOptions): PropertyDecorator {
  return applyDecorators(ApiProperty({ type: 'integer' }), IsInt(options));
}

/** Omission skips validation; explicit null only does so when documented as nullable. */
export function OptionalField(options: ApiPropertyOptions = {}): PropertyDecorator {
  const nullable = options.nullable === true;
  return applyDecorators(
    ApiPropertyOptional({ ...options, nullable }),
    ValidateIf((_, value: unknown) => value !== undefined && !(nullable && value === null)),
  );
}
