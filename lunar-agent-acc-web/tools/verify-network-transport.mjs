/**
 * NetworkTransport TCP/UDP 수신 자동 검수
 * 1) 에뮬레이터 기동 2) CareReceiverAgent.Host --headless 3) /api/bell/detect 폴링
 *
 * 사용: lunar-agent-acc-web 폴더에서
 *   node tools/verify-network-transport.mjs
 * 또는 repo 루트에서
 *   node lunar-agent-acc-web/tools/verify-network-transport.mjs
 */

import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, '..');
const HOST_PROJ = path.join(WEB_ROOT, 'CareReceiverAgent.Host', 'CareReceiverAgent.Host.csproj');
const OUT_BASE = path.join(WEB_ROOT, 'CareReceiverAgent.Host', 'bin', 'Debug', 'net9.0-windows');
const OUT_DIR = path.join(OUT_BASE, 'data');
const OUT_DATA = path.join(OUT_DIR, 'network_transport.json');
const HOST_DLL = path.join(OUT_BASE, 'CareReceiverAgent.Host.dll');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 자식 프로세스 stdout: "백엔드 시작: http://localhost:58000 ..." 에서 포트 추출 */
function parseBackendPortFromLog(log) {
  const m = /백엔드 시작:\s*http:\/\/localhost:(\d+)/.exec(log);
  return m ? parseInt(m[1], 10) : null;
}

async function pollBells(apiPort, durationMs) {
  const seen = new Set();
  const deadline = Date.now() + durationMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${apiPort}/api/bell/detect`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        const j = await res.json();
        if (j.bellCode) {
          seen.add(j.bellCode);
          console.log('[검수] 감지된 벨:', j.bellCode);
        }
      }
    } catch {
      /* ignore */
    }
    await sleep(150);
  }
  return seen;
}

async function postNetworkSettings(apiPort, fixtureName) {
  const body = fs.readFileSync(path.join(__dirname, 'fixtures', fixtureName), 'utf8');
  const res = await fetch(`http://127.0.0.1:${apiPort}/api/network-transport/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`network-transport settings 실패: ${res.status} ${t}`);
  }
}

async function main() {
  console.log('빌드 중…');
  execSync(`dotnet build "${HOST_PROJ}" -c Debug --nologo`, { stdio: 'inherit', cwd: WEB_ROOT });

  fs.mkdirSync(path.dirname(OUT_DATA), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'fixtures', 'network-transport-tcp-only.json'), OUT_DATA);
  console.log('출력 data/network_transport.json → TCP 전용으로 덮어씀:', OUT_DATA);

  const emu = spawn(process.execPath, [path.join(__dirname, 'network-transport-emulator.mjs')], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env, TCP_PORT: '29101', UDP_PORT: '29102' },
  });
  // process.execPath = node.exe (이 스크립트를 node 로 실행한 경우)

  await sleep(400);

  // 빌드된 DLL 직접 실행 — dotnet run 은 환경 변수가 앱까지 안 넘어가는 환경이 있음
  const agent = spawn(
    'dotnet',
    [HOST_DLL, '--headless'],
    {
      cwd: OUT_BASE,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DOTNET_ENVIRONMENT: 'Development',
        LUNAR_AGENT_DATA_DIR: OUT_DIR,
      },
    }
  );
  let agentLog = '';
  agent.stdout?.on('data', (d) => {
    const t = d.toString();
    agentLog += t;
    process.stdout.write(t);
  });
  agent.stderr?.on('data', (d) => {
    const t = d.toString();
    agentLog += t;
    process.stderr.write(t);
  });

  try {
    let apiPort = null;
    const waitUntil = Date.now() + 60000;
    while (Date.now() < waitUntil && apiPort == null) {
      apiPort = parseBackendPortFromLog(agentLog);
      if (apiPort != null) break;
      await sleep(200);
    }
    if (apiPort == null) {
      throw new Error(
        '에이전트가 백엔드 포트를 출력하기 전에 타임아웃했습니다. stdout:\n' + agentLog.slice(-2000)
      );
    }
    console.log('API 포트 (이번 dotnet run):', apiPort);

    let probeOk = false;
    for (let i = 0; i < 80; i++) {
      try {
        const probe = await fetch(`http://127.0.0.1:${apiPort}/api/network-transport/settings`, {
          signal: AbortSignal.timeout(2000),
        });
        if (probe.ok) {
          probeOk = true;
          break;
        }
      } catch {
        /* Kestrel 아직 미기동 */
      }
      await sleep(250);
    }
    if (!probeOk) {
      throw new Error(
        `GET /api/network-transport/settings 실패(연결 거부 등). 로그:\n${agentLog.slice(-3000)}`
      );
    }

    console.log('\n--- Phase 1: TCP만 (emulator.tcp 기대) — 시작 시 data/network_transport.json 이 TCP 전용이므로 POST 생략 ---');
    await sleep(2500);
    let seen = await pollBells(apiPort, 12000);
    if (!seen.has('emulator.tcp')) {
      throw new Error('TCP 수신 실패: emulator.tcp 가 /api/bell/detect 에 나타나지 않았습니다.');
    }
    console.log('TCP 검수 OK:', [...seen].join(', '));

    console.log('\n--- Phase 2: UDP만 (emulator.udp 기대) ---');
    await postNetworkSettings(apiPort, 'network-transport-udp-only.json');
    await sleep(2000);
    seen = await pollBells(apiPort, 8000);
    if (!seen.has('emulator.udp')) {
      throw new Error('UDP 수신 실패: emulator.udp 가 /api/bell/detect 에 나타나지 않았습니다.');
    }
    console.log('UDP 검수 OK:', [...seen].join(', '));

    console.log('\n전체 검수 통과 (TCP·UDP).');
  } finally {
    try {
      agent.kill('SIGTERM');
    } catch {
      /* */
    }
    try {
      emu.kill('SIGTERM');
    } catch {
      /* */
    }
    await sleep(300);
    try {
      agent.kill('SIGKILL');
    } catch {
      /* */
    }
    try {
      emu.kill('SIGKILL');
    } catch {
      /* */
    }
  }
}

main().catch((e) => {
  console.error('\n검수 실패:', e.message);
  process.exit(1);
});
