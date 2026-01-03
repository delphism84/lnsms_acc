import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// copies ../assets/icons8_loudspeaker.ico -> public/favicon.ico
// so vite build always ships the latest icon without committing binary files into /public.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const src = path.resolve(__dirname, '../../assets/icons8_loudspeaker.ico');
const dstDir = path.resolve(__dirname, '../public');
const dst = path.resolve(dstDir, 'favicon.ico');

async function main() {
  await fs.mkdir(dstDir, { recursive: true });
  await fs.copyFile(src, dst);
  // keep quiet in normal builds
}

main().catch((err) => {
  console.error('[sync-favicon] failed:', err);
  process.exit(1);
});


