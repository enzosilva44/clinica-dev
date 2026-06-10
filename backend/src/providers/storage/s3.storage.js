import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET = process.env.AWS_S3_BUCKET;
const endpoint =
  process.env.AWS_S3_ENDPOINT ||
  (process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined);

function requireS3Config() {
  const missing = [];
  if (!BUCKET) missing.push("AWS_S3_BUCKET");
  if (!process.env.AWS_ACCESS_KEY_ID) missing.push("AWS_ACCESS_KEY_ID");
  if (!process.env.AWS_SECRET_ACCESS_KEY) missing.push("AWS_SECRET_ACCESS_KEY");

  if (missing.length > 0) {
    throw new Error(`Configuração S3 incompleta: ${missing.join(", ")}`);
  }
}

const s3 = new S3Client({
  region:      process.env.AWS_REGION ?? (endpoint ? "auto" : "us-east-1"),
  endpoint,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  // R2 exige path-style
  forcePathStyle: !!endpoint,
});

export async function saveFile(buffer, filePath, mimeType) {
  requireS3Config();
  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         filePath,
    Body:        buffer,
    ContentType: mimeType ?? "application/octet-stream",
  }));
  return filePath;
}

export async function getFile(filePath) {
  requireS3Config();
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: filePath }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function fileExists(filePath) {
  requireS3Config();
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: filePath }));
    return true;
  } catch { return false; }
}

export async function deleteFile(filePath) {
  requireS3Config();
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: filePath }));
}

// URL pública (bucket público R2) ou URL assinada com expiração
export function getPublicUrl(filePath) {
  if (process.env.R2_PUBLIC_URL) {
    return `${process.env.R2_PUBLIC_URL.replace(/\/$/, "")}/${filePath}`;
  }
  // fallback: caminho relativo (app serve via /uploads/)
  return filePath;
}

export async function getPresignedUrl(filePath, expiresIn = 3600) {
  requireS3Config();
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: filePath });
  return getSignedUrl(s3, cmd, { expiresIn });
}
