#!/bin/bash
# Para o backend antes de substituir os arquivos.

set -e

# Para o processo do backend (ignora erro se ainda não existe)
pm2 stop iaso-backend || true

exit 0
