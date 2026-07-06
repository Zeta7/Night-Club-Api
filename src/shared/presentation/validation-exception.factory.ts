import { BadRequestException, ValidationError } from '@nestjs/common';

type ValidationErrorDetail = {
  field: string;
  messages: string[];
};

export const createValidationException = (errors: ValidationError[]) => {
  const details = flattenValidationErrors(errors);

  return new BadRequestException({
    data: null,
    meta: {},
    error: {
      code: 'VALIDATION_ERROR',
      message: 'La solicitud contiene datos inválidos.',
      details,
    },
  });
};

const flattenValidationErrors = (
  errors: ValidationError[],
  parentPath = '',
): ValidationErrorDetail[] => {
  return errors.flatMap((error) => {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    const currentMessages = Object.values(error.constraints ?? {});
    const current = currentMessages.length > 0 ? [{ field, messages: currentMessages }] : [];
    const children = flattenValidationErrors(error.children ?? [], field);

    return [...current, ...children];
  });
};
