#!/bin/bash
# Após copiar os arquivos: prepara o backend.
# O .env já vem pronto no artifact (gerado pelo CodeBuild).
# O frontend já vem compilado (dist/) — nada a fazer nele aqui.

set -e

APP_DIR=/home/ubuntu/clinica-dev

cd "$APP_DIR/backend"
# Regenera o Prisma client alinhado ao ambiente da EC2
npx prisma generate || true

# Ajusta dono dos arquivos
chown -R ubuntu:ubuntu "$APP_DIR"

exit 0
