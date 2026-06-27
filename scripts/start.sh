#!/bin/bash
# Sobe o backend com PM2 e recarrega o Nginx (que serve o frontend dist/).
# IMPORTANTE: o CodeDeploy roda este script como root, mas o PM2 que de fato
# atende as portas (e que o systemd pm2-ubuntu ressuscita no boot) pertence ao
# usuario ubuntu. Por isso todo comando pm2 roda via `sudo -u ubuntu` — caso
# contrario o deploy mexe num PM2 do root paralelo e a mudanca nao pega.

set -e

APP_DIR=/home/ubuntu/clinica-dev
PM2=$(command -v pm2 || echo /usr/lib/node_modules/pm2/bin/pm2)

# Permite que o Nginx (www-data) leia o build do frontend.
# A home do ubuntu é 700 — precisa do +x para "atravessar" até o dist.
chmod o+x /home/ubuntu
chmod -R o+rX "$APP_DIR/frontend/dist"

# Roda o PM2 sempre como ubuntu (dono do daemon que serve as portas).
run_pm2() {
  sudo -u ubuntu -H "$PM2" "$@"
}

cd "$APP_DIR/backend"

# Inicia ou reinicia o backend
if run_pm2 describe iaso-backend > /dev/null 2>&1; then
  run_pm2 restart iaso-backend --update-env
else
  run_pm2 start src/server.js --name iaso-backend
fi

run_pm2 save

# Recarrega o Nginx para servir o novo build do frontend
nginx -t && systemctl reload nginx

exit 0
