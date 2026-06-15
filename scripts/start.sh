#!/bin/bash
# Sobe o backend com PM2 e recarrega o Nginx (que serve o frontend dist/).

set -e

APP_DIR=/home/ubuntu/clinica-dev

# Permite que o Nginx (www-data) leia o build do frontend.
# A home do ubuntu é 700 — precisa do +x para "atravessar" até o dist.
chmod o+x /home/ubuntu
chmod -R o+rX "$APP_DIR/frontend/dist"

cd "$APP_DIR/backend"

# Inicia ou reinicia o backend
if pm2 describe iaso-backend > /dev/null 2>&1; then
  pm2 restart iaso-backend --update-env
else
  pm2 start src/server.js --name iaso-backend
fi

pm2 save

# Recarrega o Nginx para servir o novo build do frontend
nginx -t && systemctl reload nginx

exit 0
