import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// copies repo-root/resource/appicon.ico -> public/favicon.ico (if exists)
// otherwise falls back to ../assets/icons8_loudspeaker.ico
// so vite build always ships the latest icon without committing binary files into /public.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resourceDir = path.resolve(__dirname, '../../../resource');
const resourceIco = path.resolve(resourceDir, 'appicon.ico');
const fallbackIco = path.resolve(__dirname, '../../assets/icons8_loudspeaker.ico');
const src = (await fs.stat(resourceIco).then(() => resourceIco).catch(() => fallbackIco));

const dstDir = path.resolve(__dirname, '../public');
const dst = path.resolve(dstDir, 'favicon.ico');

// optional: resource/acc.png -> public/acc.png (알림 화면 이미지 교체)
const resourceAcc = path.resolve(resourceDir, 'acc.png');
const dstAcc = path.resolve(dstDir, 'acc.png');

// optional: resource/images/** -> public/images/**
const resourceImagesDir = path.resolve(resourceDir, 'images');
const dstImagesDir = path.resolve(dstDir, 'images');

async function main() {
  await fs.mkdir(dstDir, { recursive: true });
  await fs.copyFile(src, dst);
  await fs
    .copyFile(resourceAcc, dstAcc)
    .catch(() => Promise.resolve());

  await fs
    .cp(resourceImagesDir, dstImagesDir, { recursive: true, force: true })
    .catch(() => Promise.resolve());
  // keep quiet in normal builds
}

main().catch((err) => {
  console.error('[sync-favicon] failed:', err);
  process.exit(1);
});


