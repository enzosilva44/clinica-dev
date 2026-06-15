#!/bin/bash
# Após copiar os arquivos: prepara o backend.
# O .env já vem pronto no artifact (gerado pelo CodeBuild).
# O Prisma Client e o build do frontend (dist/) também já vêm prontos
# do CodeBuild — nada a compilar/gerar aqui (evita estourar a CPU da EC2).

set -e

APP_DIR=/home/ubuntu/clinica-dev

# Ajusta dono dos arquivos
chown -R ubuntu:ubuntu "$APP_DIR"

exit 0
