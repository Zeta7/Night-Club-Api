#!/usr/bin/env bash

set -Eeuo pipefail

export PATH="/usr/bin:/bin"

PROJECT_DIR="/home/ubuntu/Night-Club-Api"
APP_NAME="beerry-api"
LOCK_FILE="/tmp/beerry-api-deployment.lock"

handle_error() {
  echo "ERROR: El despliegue falló en la línea $1."
}

trap 'handle_error $LINENO' ERR

exec 9>"$LOCK_FILE"

if ! flock -n 9; then
  echo "ERROR: Ya existe otro despliegue en ejecución."
  exit 1
fi

echo "Entrando al proyecto..."
cd "$PROJECT_DIR"

echo "Instalando dependencias..."
pnpm install --frozen-lockfile

echo "Generando Prisma Client..."
pnpm prisma:generate

echo "Compilando NestJS..."
pnpm build

echo "Aplicando migraciones pendientes..."
pnpm exec prisma migrate deploy

echo "Recargando la aplicación..."
pm2 reload "$APP_NAME" --update-env

echo "Guardando la lista de procesos..."
pm2 save

echo "Despliegue finalizado correctamente."
