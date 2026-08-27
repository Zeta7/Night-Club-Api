import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { setupOpenApi } from './shared/presentation/openapi/openapi.document';
import { createValidationException } from './shared/presentation/validation-exception.factory';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN')?.split(',') ?? true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: createValidationException,
    }),
  );

  setupOpenApi(app);

  const port = config.get<number>('PORT') ?? 3000;
  const host = config.get<string>('HOST') ?? '0.0.0.0';
  await app.listen(port, host);
}

void bootstrap();
