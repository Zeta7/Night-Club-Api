import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createOpenApiDocument } from './shared/presentation/openapi/openapi.document';

async function generateOpenApi(): Promise<void> {
  process.env.DATABASE_URL ??= 'postgresql://openapi:openapi@127.0.0.1:5432/openapi';

  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    app.setGlobalPrefix('api/v1');

    const document = createOpenApiDocument(app);
    const outputPath = resolve(process.argv[2] ?? 'dist/openapi.json');
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

    // createDocument only reads Nest metadata; no server or database connection is opened.
    process.stdout.write(`${outputPath}\n`);
  } finally {
    await app.close();
  }
}

void generateOpenApi();
