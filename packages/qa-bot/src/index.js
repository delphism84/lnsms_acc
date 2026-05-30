#!/usr/bin/env node
const cfg = require('./config');
const { isBeUp, ensureBeRunning, stopManagedBe } = require('./watchdog');
const { runBeSmoke } = require('./smoke-be');
const { runFeSmoke } = require('./smoke-fe');

let lastBeUp = null;
let running = false;

function ts() {
  return new Date().toISOString().slice(11, 19);
}

function logResults(label, results) {
  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);
  if (failed.length === 0) {
    console.log(`[${ts()}] ${label} ✅ ${passed.length}/${results.length} (${passed.reduce((s, r) => s + r.ms, 0)}ms)`);
  } else {
    console.log(`[${ts()}] ${label} ❌ ${passed.length}/${results.length} pass`);
    for (const f of failed) {
      console.log(`  ✗ ${f.name}: ${f.error}`);
    }
  }
  return failed.length === 0;
}

async function runCycle() {
  if (running) return;
  running = true;
  try {
    const up = await isBeUp();
    if (!up) {
      console.log(`[${ts()}] BE DOWN ${cfg.beUrl}`);
      const recovered = await ensureBeRunning();
      if (!recovered) {
        console.log(`[${ts()}] BE still down — skip smoke`);
        lastBeUp = false;
        return;
      }
    } else if (lastBeUp === false) {
      console.log(`[${ts()}] BE back online`);
    }
    lastBeUp = true;

    const beOk = logResults('BE smoke', await runBeSmoke());
    const feOk = logResults('FE smoke', await runFeSmoke());

    if (!beOk || !feOk) {
      process.exitCode = 1;
    }
  } finally {
    running = false;
  }
}

async function main() {
  console.log(`[qa-bot] BE=${cfg.beUrl} FE=${cfg.feUrl} interval=${cfg.intervalMs}ms autoStartBe=${cfg.autoStartBe}`);
  await runCycle();
  if (cfg.once) {
    stopManagedBe();
    process.exit(process.exitCode || 0);
  }
  setInterval(runCycle, cfg.intervalMs);
  setInterval(async () => {
    if (!(await isBeUp())) {
      console.log(`[${ts()}] watchdog: BE health fail`);
      await ensureBeRunning();
    }
  }, cfg.healthIntervalMs);
}

process.on('SIGINT', () => {
  stopManagedBe();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopManagedBe();
  process.exit(0);
});

main().catch((e) => {
  console.error('[qa-bot] fatal', e);
  process.exit(1);
});
