#!/bin/bash
# Para o backend antes de substituir os arquivos.
# Preserva o .env do backend (que não vem no deploy).

set -e

APP_DIR=/home/ubuntu/clinica-dev

# Guarda o .env do backend num local seguro, se existir
if [ -f "$APP_DIR/backend/.env" ]; then
  cp "$APP_DIR/backend/.env" /home/ubuntu/.env.backend.bak
  echo "backend/.env preservado"
fi

# Para o processo do backend (ignora erro se ainda não existe)
pm2 stop iaso-backend || true

exit 0
