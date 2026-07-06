# Infraestructura AWS

# Objetivo

La infraestructura debe permitir desplegar el MVP de forma simple, segura y preparada para crecimiento. La arquitectura inicial puede ser conservadora, evitando complejidad innecesaria.

## Servicios principales

- EC2 para backend NestJS.
- RDS PostgreSQL para base de datos.
- ElastiCache Redis para cache, locks y BullMQ.
- S3 para archivos y assets.
- CloudFront para distribucion de assets.
- Firebase Cloud Messaging para notificaciones push.

## Arquitectura inicial

```text
Cliente Web / Mobile
        |
   CloudFront
        |
  Backend NestJS en EC2
        |
  ---------------------
  |        |          |
 RDS   Redis/SQS     S3
```

Nota: BullMQ usara Redis, por lo que ElastiCache debe dimensionarse con cuidado.

## Ambientes

Ambientes sugeridos:

- development.
- staging.
- production.

Cada ambiente debe tener variables, base de datos y secretos separados.

## Compute

Para el MVP:

- EC2 con despliegue automatizado.
- Proceso Node.js administrado con PM2 o contenedor Docker.
- Nginx como reverse proxy si aplica.

Evolucion futura:

- ECS Fargate.
- Auto Scaling Group.
- Load Balancer.

## Base de datos

RDS PostgreSQL debe tener:

- Backups automaticos.
- Storage autoscaling si aplica.
- Acceso restringido por security groups.
- Monitoreo de CPU, conexiones y storage.
- Migraciones controladas.

## Redis

ElastiCache Redis se usara para:

- Locks.
- Cache.
- BullMQ.
- Contadores de apoyo.

Debe monitorearse:

- Memoria.
- Evictions.
- Latencia.
- Conexiones.
- Uso por colas.

## S3 y CloudFront

S3 puede almacenar:

- Imagenes de clubes.
- Imagenes de eventos.
- Assets publicos.
- Archivos generados.

CloudFront debe servir contenido publico con cache y HTTPS.

## Seguridad de infraestructura

Medidas:

- Secrets fuera del codigo.
- Security groups restrictivos.
- Acceso SSH limitado.
- HTTPS obligatorio.
- Backups habilitados.
- Logs centralizados.
- Separacion de ambientes.

## Variables de entorno

Variables esperadas:

- DATABASE_URL.
- REDIS_URL.
- JWT_SECRET.
- JWT_REFRESH_SECRET.
- CULQI_PUBLIC_KEY.
- CULQI_PRIVATE_KEY.
- AWS_REGION.
- AWS_S3_BUCKET.
- AWS_CLOUDFRONT_URL.
- AWS_ACCESS_KEY_ID.
- AWS_SECRET_ACCESS_KEY.
- FIREBASE_CONFIG.
- SENTRY_DSN.

## Configuracion de imagenes en AWS

Flujo recomendado:

1. El backend genera una URL firmada temporal para S3.
2. El cliente sube la imagen directamente a S3 con metodo PUT.
3. El backend guarda la URL publica servida por CloudFront en el campo correspondiente. Para clubes se usa imagen de portada o perfil; para eventos puede usarse `imageUrl`.

Configuracion sugerida en AWS Console:

1. Crear bucket S3 privado por ambiente, por ejemplo `nightclub-platform-staging-assets`.
2. Bloquear acceso publico del bucket.
3. Configurar CORS del bucket permitiendo PUT desde los dominios del frontend.
4. Crear una distribucion CloudFront con el bucket S3 como origen.
5. Usar Origin Access Control para que CloudFront pueda leer del bucket sin hacerlo publico.
6. Crear una policy IAM que permita `s3:PutObject` sobre `bucket/clubs/*`.
7. Crear un usuario o rol IAM para el backend con esa policy.
8. Configurar en el backend `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_CLOUDFRONT_URL`, `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY`.

CORS sugerido para el bucket:

```json
[
  {
    "AllowedHeaders": ["Content-Type"],
    "AllowedMethods": ["PUT"],
    "AllowedOrigins": ["https://app.example.com", "http://localhost:3000"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Policy IAM minima para subir imagenes:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::nightclub-platform-staging-assets/clubs/*"
    }
  ]
}
```

## Observabilidad

Debe incluir:

- Logs de aplicacion.
- Errores en Sentry.
- Metricas de API.
- Metricas de validacion QR.
- Metricas de BullMQ.
- Alertas para errores criticos.

## Estrategia de despliegue MVP

1. Build de backend.
2. Ejecutar migraciones Prisma.
3. Reiniciar proceso de aplicacion.
4. Verificar health check.
5. Verificar conexion a PostgreSQL y Redis.
6. Monitorear logs.
