import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR = path.resolve(__dirname, "../../../../uploads");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export async function saveFile(buffer, filePath) {
  const full = path.join(BASE_DIR, filePath);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, buffer);
  return filePath;
}

export async function getFile(filePath) {
  const full = path.join(BASE_DIR, filePath);
  if (!fs.existsSync(full)) throw new Error(`Arquivo não encontrado: ${filePath}`);
  return fs.readFileSync(full);
}

export async function fileExists(filePath) {
  return fs.existsSync(path.join(BASE_DIR, filePath));
}

export async function deleteFile(filePath) {
  const full = path.join(BASE_DIR, filePath);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

export function getPublicUrl(filePath) {
  return filePath;
}
