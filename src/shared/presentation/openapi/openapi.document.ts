import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { enhanceOpenApiDocument } from './openapi.enhancer';

const OPENAPI_TAGS = [
  ['Health', 'Estado y disponibilidad de la API.'],
  ['Auth', 'Registro, autenticación y administración de sesiones.'],
  ['Notification', 'Notificaciones, preferencias y dispositivos del usuario.'],
  ['Platform', 'Administración global de la plataforma.'],
  ['Audit', 'Consulta, política e integridad del registro de auditoría.'],
  ['Clubs', 'Administración y consulta de discotecas.'],
  ['Club Workers', 'Trabajadores, permisos, turnos y dispositivos autorizados.'],
  ['Events', 'Consulta pública de eventos.'],
  ['Admin Events', 'Indicadores globales de eventos.'],
  ['Club Events', 'Administración de eventos de una discoteca.'],
  ['Capacity', 'Aforo, historial, configuración y transmisión en tiempo real.'],
  ['Club Products', 'Catálogo de productos de una discoteca.'],
  ['Club Promotions', 'Promociones de una discoteca.'],
  ['Club Tickets', 'Tipos de entrada generales de una discoteca.'],
  ['Event Tickets', 'Tipos de entrada específicos de un evento.'],
  ['Uploads', 'Carga directa de archivos mediante URL firmada.'],
  ['Users', 'Búsqueda de usuarios y perfil propio.'],
  ['Wallets', 'Billeteras, conciliación, datos financieros y retiros.'],
  ['Commerce', 'Carrito, órdenes, pagos, validación y canjes.'],
  ['Flow Payments', 'Callbacks y retornos del proveedor de pagos Flow.'],
  ['Referrals', 'Referidos, recompensas, transferencias y configuración.'],
] as const;

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  let builder = new DocumentBuilder()
    .setTitle('Beerry API')
    .setDescription(
      'Contrato REST de Beerry Platform. Las respuestas exitosas son payloads directos; los errores compartidos usan el envelope { data, meta, error }.',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token JWT obtenido mediante el flujo de autenticación.',
      },
      'bearer',
    );

  for (const [name, description] of OPENAPI_TAGS) {
    builder = builder.addTag(name, description);
  }

  return enhanceOpenApiDocument(SwaggerModule.createDocument(app, builder.build()));
}

export function setupOpenApi(app: INestApplication): OpenAPIObject {
  const document = createOpenApiDocument(app);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    yamlDocumentUrl: 'api/docs-yaml',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
  return document;
}
