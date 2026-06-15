#!/bin/bash
# Após copiar os arquivos: restaura o .env e prepara o backend.
# O frontend já vem compilado (dist/) do CodeBuild — nada a fazer nele aqui.

set -e

APP_DIR=/home/ubuntu/clinica-dev

# Restaura o .env do backend preservado no stop.sh
if [ -f /home/ubuntu/.env.backend.bak ]; then
  cp /home/ubuntu/.env.backend.bak "$APP_DIR/backend/.env"
  echo "backend/.env restaurado"
fi

# Dependências do backend já vêm instaladas do CodeBuild (node_modules no artifact),
# mas geramos o Prisma client de novo por garantia (alinha com o ambiente da EC2).
cd "$APP_DIR/backend"
npx prisma generate || true

# Ajusta dono dos arquivos
chown -R ubuntu:ubuntu "$APP_DIR"

exit 0
