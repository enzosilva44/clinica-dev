#!/bin/bash
# Gera o backend/.env a partir das variáveis de ambiente do CodeBuild.
# Mantido fora do buildspec.yml para evitar problemas de parsing YAML.

set -e

{
  echo "PORT=3000"
  echo "JWT_SECRET=${JWT_SECRET}"
  echo "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}"
  echo "DATABASE_URL=${DATABASE_URL}"
  echo "GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}"
  echo "ASAAS_API_KEY=${ASAAS_API_KEY}"
  echo "ASAAS_URL=${ASAAS_URL}"
  echo "WHATSAPP_PHONE_NUMBER_ID=${WHATSAPP_PHONE_NUMBER_ID}"
  echo "WHATSAPP_ACCESS_TOKEN=${WHATSAPP_ACCESS_TOKEN}"
  echo "OTP_TEST_MODE=${OTP_TEST_MODE}"
  echo "SMTP_HOST=${SMTP_HOST}"
  echo "SMTP_PORT=${SMTP_PORT}"
  echo "SMTP_SECURE=${SMTP_SECURE}"
  echo "SMTP_USER=${SMTP_USER}"
  echo "SMTP_PASS=${SMTP_PASS}"
  echo "SMTP_FROM=${SMTP_FROM}"
  echo "STORAGE_PROVIDER=${STORAGE_PROVIDER}"
  echo "AWS_REGION=${S3_REGION}"
  echo "AWS_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}"
  echo "AWS_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}"
  echo "AWS_S3_BUCKET=${S3_BUCKET}"
} > backend/.env

echo "backend/.env gerado com $(wc -l < backend/.env) linhas"
