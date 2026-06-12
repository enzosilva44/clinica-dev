/**
 * Migração: sobe os arquivos locais (pasta uploads/) para o S3.
 *
 * Uso:
 *   1. Configure o .env com STORAGE_PROVIDER=s3 e as credenciais AWS.
 *   2. node scripts/migrate-uploads-to-s3.js          (faz a migração)
 *      node scripts/migrate-uploads-to-s3.js --dry     (só lista, não envia)
 *
 * A key no S3 é o caminho relativo dentro de uploads/, que é exatamente
 * o filePath salvo no banco — então os arquivos voltam a ser encontrados.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "../uploads");
const DRY = process.argv.includes("--dry");

function mimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  return {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  }[ext] ?? "application/octet-stream";
}

// Lista recursiva de todos os arquivos, com a key relativa a uploads/
function walk(dir, base = UPLOADS_DIR) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push({ full, key: path.relative(base, full) });
  }
  return out;
}

async function main() {
  if (process.env.STORAGE_PROVIDER !== "s3") {
    console.error("✗ STORAGE_PROVIDER não está como 's3'. Configure o .env primeiro.");
    process.exit(1);
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.error(`✗ Pasta não encontrada: ${UPLOADS_DIR}`);
    process.exit(1);
  }

  const { saveFile, fileExists } = await import("../src/providers/storage/index.js");
  const files = walk(UPLOADS_DIR);
  console.log(`Encontrados ${files.length} arquivos em uploads/\n`);

  let uploaded = 0, skipped = 0, failed = 0;
  for (const { full, key } of files) {
    try {
      if (await fileExists(key)) {
        console.log(`= já existe no S3: ${key}`);
        skipped++;
        continue;
      }
      if (DRY) {
        console.log(`→ (dry) enviaria: ${key}`);
        uploaded++;
        continue;
      }
      const buffer = fs.readFileSync(full);
      await saveFile(buffer, key, mimeFor(full));
      console.log(`✓ enviado: ${key} (${(buffer.length / 1024).toFixed(0)} KB)`);
      uploaded++;
    } catch (e) {
      console.error(`✗ falha em ${key}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nResumo: ${uploaded} enviado(s) · ${skipped} já existia(m) · ${failed} falha(s)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
