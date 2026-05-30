const { spawn } = require('child_process');
const cfg = require('./config');
const { fetchOk } = require('./http');

let beProcess = null;
let starting = false;

async function isBeUp() {
  try {
    const res = await fetchOk(`${cfg.beUrl}/health`, {}, 3000);
    return res.ok;
  } catch {
    return false;
  }
}

function startBe() {
  if (beProcess || starting || !cfg.autoStartBe) return;
  starting = true;
  console.log(`[qa-bot] BE down — starting: ${cfg.beStartCmd} (${cfg.beCwd})`);
  beProcess = spawn(cfg.beStartCmd, {
    cwd: cfg.beCwd,
    shell: true,
    stdio: 'ignore',
    detached: false,
    env: { ...process.env, PORT: '40000', MONGODB_URI: process.env.MONGODB_URI || 'memory' },
  });
  beProcess.on('exit', (code) => {
    console.log(`[qa-bot] BE process exited code=${code}`);
    beProcess = null;
    starting = false;
  });
  starting = false;
}

async function ensureBeRunning() {
  if (await isBeUp()) return true;
  startBe();
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await isBeUp()) {
      console.log('[qa-bot] BE recovered');
      return true;
    }
  }
  return false;
}

function stopManagedBe() {
  if (beProcess && !beProcess.killed) {
    beProcess.kill('SIGTERM');
    beProcess = null;
  }
}

module.exports = { isBeUp, ensureBeRunning, stopManagedBe };
