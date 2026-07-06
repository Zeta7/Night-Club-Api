import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

type ApiExceptionBody = {
  data: null;
  meta: Record<string, unknown>;
  error: {
    code: string;
    message: string;
    details: unknown[];
  };
};

const buildBody = (code: string, message: string, details: unknown[] = []): ApiExceptionBody => ({
  data: null,
  meta: {},
  error: {
    code,
    message,
    details,
  },
});

export const badRequest = (code: string, message: string, details: unknown[] = []): HttpException =>
  new BadRequestException(buildBody(code, message, details));

export const conflict = (code: string, message: string, details: unknown[] = []): HttpException =>
  new ConflictException(buildBody(code, message, details));

export const forbidden = (code: string, message: string, details: unknown[] = []): HttpException =>
  new ForbiddenException(buildBody(code, message, details));

export const notFound = (code: string, message: string, details: unknown[] = []): HttpException =>
  new NotFoundException(buildBody(code, message, details));

export const unauthorized = (
  code: string,
  message: string,
  details: unknown[] = [],
): HttpException => new UnauthorizedException(buildBody(code, message, details));

export const serviceUnavailable = (
  code: string,
  message: string,
  details: unknown[] = [],
): HttpException => new ServiceUnavailableException(buildBody(code, message, details));
