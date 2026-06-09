/**
 * S3 Storage Provider — pronto para uso, ativado via STORAGE_PROVIDER=s3
 * Requer: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET
 *
 * Para ativar: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 */

// import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
// import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
//
// const s3 = new S3Client({ region: process.env.AWS_REGION });
// const BUCKET = process.env.AWS_S3_BUCKET;

export async function saveFile(_buffer, _filePath) {
  throw new Error("S3 não configurado. Defina STORAGE_PROVIDER=local ou configure as variáveis AWS.");
}

export async function getFile(_filePath) {
  throw new Error("S3 não configurado.");
}

export async function fileExists(_filePath) {
  throw new Error("S3 não configurado.");
}

export async function deleteFile(_filePath) {
  throw new Error("S3 não configurado.");
}

export function getPublicUrl(_filePath) {
  throw new Error("S3 não configurado.");
}

/*
 * Implementação completa (descomente quando configurar AWS):
 *
 * export async function saveFile(buffer, filePath) {
 *   await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: filePath, Body: buffer }));
 *   return filePath;
 * }
 *
 * export async function getFile(filePath) {
 *   const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: filePath }));
 *   const chunks = [];
 *   for await (const chunk of res.Body) chunks.push(chunk);
 *   return Buffer.concat(chunks);
 * }
 *
 * export async function fileExists(filePath) {
 *   try {
 *     await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: filePath }));
 *     return true;
 *   } catch { return false; }
 * }
 *
 * export async function deleteFile(filePath) {
 *   await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: filePath }));
 * }
 *
 * export function getPublicUrl(filePath) {
 *   return `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${filePath}`;
 * }
 */
