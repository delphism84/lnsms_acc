const http = require('http');
const crypto = require('crypto');
const { SerialCareReceiverBot } = require('./serialBot');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const DEFAULT_PORT = 58000;
const MAX_PORT = 58999;

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const [k, v] = a.slice(2).split('=');
    out[k] = v === undefined ? true : v;
  }
  return out;
}

async function findBackendPort() {
  for (let port = DEFAULT_PORT; port <= MAX_PORT; port++) {
    try {
      await apiRequestRaw(port, 'GET', '/api/settings/port');
      return port;
    } catch {
      // continue
    }
  }
  throw new Error('백엔드 포트를 찾을 수 없습니다. (기본 58000~58999 스캔)');
}

function startHostHeadless() {
  const projectPath = path.resolve(__dirname, '..', 'CareReceiverAgent.Host', 'CareReceiverAgent.Host.csproj');
  // selftest는 안정성이 중요하므로 기본은 --no-build로 실행 (Defender/동시 빌드로 인한 파일 잠금 방지)
  const child = spawn('dotnet', ['run', '--no-build', '--project', projectPath, '--', '--headless'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let detectedPort = null;
  let exited = false;
  let exitCode = null;

  child.stdout.on('data', (d) => {
    const s = d.toString('utf8').trim();
    if (s) {
      process.stdout.write(`[host] ${s}\n`);
      // 예: "백엔드 시작: http://localhost:58000" 또는 "Now listening on: http://localhost:58000"
      const m = s.match(/localhost:(\d{2,5})/);
      if (m && !detectedPort) detectedPort = Number(m[1]);
    }
  });
  child.stderr.on('data', (d) => {
    const s = d.toString('utf8').trim();
    if (s) process.stderr.write(`[host:err] ${s}\n`);
  });

  child.on('exit', (code) => {
    exited = true;
    exitCode = code;
  });

  child.__detectedPort = () => detectedPort;
  child.__exited = () => exited;
  child.__exitCode = () => exitCode;
  return child;
}

function apiRequestRaw(port, method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:${port}${endpoint}`);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const ok = res.statusCode >= 200 && res.statusCode < 300;
          if (!ok) {
            return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
          resolve({ status: res.statusCode, raw: data, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(2000, () => {
      req.destroy(new Error('Timeout'));
    });
    if (body !== undefined) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function apiRequestJson(port, method, endpoint, body) {
  const r = await apiRequestRaw(port, method, endpoint, body);
  if (!r.raw) return null;
  try {
    return JSON.parse(r.raw);
  } catch {
    return r.raw;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function randBell5() {
  const alphabet = '0123456789abcdef';
  const b = crypto.randomBytes(5);
  let s = '';
  for (let i = 0; i < 5; i++) s += alphabet[b[i] % alphabet.length];
  return s;
}

async function poll(fn, { timeoutMs, intervalMs, label }) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await sleep(intervalMs);
  }
  throw new Error(`timeout: ${label}`);
}

async function main() {
  const args = parseArgs(process.argv);
  const comMain = String(args.comMain || 'COM1'); // Host가 연결할 포트
  const comBot = String(args.comBot || 'COM2'); // 봇이 열 포트
  const baud = Number(args.baud || 9600);
  const deviceSerial = String(args.sn || args.deviceSerial || '26020011').trim();
  const startHost = args.startHost === undefined ? true : args.startHost !== 'false';
  const hexLog = args.hexLog === undefined ? true : args.hexLog !== 'false';

  console.log(`=== selftest 시작 (${nowIso()}) ===`);
  console.log(`- comMain=${comMain}`);
  console.log(`- comBot=${comBot}`);
  console.log(`- baud=${baud}`);
  console.log(`- sn=${deviceSerial}`);
  console.log(`- startHost=${startHost}`);
  console.log(`- hexLog=${hexLog}`);

  const tsSafe = nowIso().replace(/[:.]/g, '-');
  const hexLogPath = path.resolve(__dirname, 'logs', `serial-hex-${tsSafe}.log`);
  if (hexLog) {
    try {
      fs.mkdirSync(path.dirname(hexLogPath), { recursive: true });
      fs.writeFileSync(hexLogPath, `=== serial hex log (${nowIso()}) ===\n`, { encoding: 'utf8' });
    } catch {
      // ignore
    }
    console.log(`- hexLogPath=${hexLogPath}`);
  }

  let hostProc = null;
  const cleanupHost = () => {
    if (!hostProc) return;
    try {
      hostProc.kill();
    } catch {
      // ignore
    }
    hostProc = null;
  };
  let backendPort = null;
  console.log('\n1) 백엔드 포트 찾기/필요 시 headless Host 실행...');
  try {
    backendPort = await findBackendPort();
    console.log(`   ✓ backendPort=${backendPort} (이미 실행 중)`);
  } catch (e) {
    if (!startHost) throw e;
    hostProc = startHostHeadless();
    backendPort = await poll(
      async () => {
        if (typeof hostProc.__exited === 'function' && hostProc.__exited()) {
          throw new Error(`headless host exited early (code=${hostProc.__exitCode?.()})`);
        }
        const p = typeof hostProc.__detectedPort === 'function' ? hostProc.__detectedPort() : null;
        return p ? p : null;
      },
      { timeoutMs: 30000, intervalMs: 200, label: 'wait host headless port from stdout' }
    );
    console.log(`   ✓ backendPort=${backendPort} (headless로 기동됨)`);
  }

  // 포트 문자열을 stdout에서 먼저 잡아도, 실제 서버가 listen 완료 전일 수 있어 health-check를 한 번 더 수행
  await poll(
    async () => {
      try {
        await apiRequestRaw(backendPort, 'GET', '/api/settings/port');
        return true;
      } catch {
        return null;
      }
    },
    { timeoutMs: 10000, intervalMs: 200, label: 'wait backend ready (/api/settings/port)' }
  );

  process.on('SIGINT', () => {
    cleanupHost();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    cleanupHost();
    process.exit(143);
  });

  console.log('\n2) 시리얼 봇(COM2) 시작...');
  const botRx = [];
  const botTx = [];
  const bot = new SerialCareReceiverBot({
    portName: comBot,
    baudRate: baud,
    sendReadyOnOpen: true,
    deviceSerial: deviceSerial,
    onRxLine: (l) => botRx.push(l),
    onTxLine: (l) => botTx.push(l),
    enableHexLog: hexLog,
    hexLogPath: hexLog ? hexLogPath : null,
  });
  await bot.open();
  console.log('   ✓ bot open');

  console.log('\n3) 알림/벨 상태 초기화(가능 범위)...');
  try {
    await apiRequestJson(backendPort, 'POST', '/api/notifications/confirm', {});
  } catch {
    // ignore
  }

  console.log('\n4) 시리얼 연결 설정/재연결 (Host -> COM1)...');
  await apiRequestJson(backendPort, 'POST', '/api/serialport/settings', {
    portName: comMain,
    baudRate: baud,
    autoConnect: true,
    secureEnabled: true,
  });

  await poll(
    async () => {
      const st = await apiRequestJson(backendPort, 'GET', '/api/serialport/status');
      return st?.isConnected ? st : null;
    },
    { timeoutMs: 5000, intervalMs: 200, label: 'serialport.status isConnected' }
  );
  console.log('   ✓ host serial connected');

  console.log(
    '\n5) 핸드셰이크 검증: Host가 "<8자리>.seed=..."내면 봇이 동일 접두 "<sn>.ok" 응답 (실제 모듈은 00000000 조회 시 00000000.ok)'
  );
  await poll(
    async () => {
      const hasSeed = botRx.some((l) => /^\d{8}\.seed=/.test(l) || l.startsWith('crcv.seed='));
      const hasOk = botTx.some((l) => /^\d{8}\.ok$/i.test(l) || l === 'ok');
      return hasSeed && hasOk ? true : null;
    },
    { timeoutMs: 3000, intervalMs: 100, label: 'handshake (rx seed / tx ok)' }
  );
  console.log('   ✓ handshake ok');

  console.log('\n6) 장애인 도움요청 시나리오 (crcv.assist -> API 반영)');
  await bot.sendAssist();

  const detectedAssist = await poll(
    async () => {
      const d = await apiRequestJson(backendPort, 'GET', '/api/bell/detect');
      return d?.bellCode === 'crcv.assist' ? d : null;
    },
    { timeoutMs: 2000, intervalMs: 100, label: 'bell.detect assist' }
  );
  console.log(`   ✓ bell.detect: ${detectedAssist.bellCode}`);

  const activeAssist = await poll(
    async () => {
      const a = await apiRequestJson(backendPort, 'GET', '/api/notifications/active');
      const list = a?.notifications || [];
      return list.some((n) => n.uid === '90000001' && n.isRegistered === true) ? a : null;
    },
    { timeoutMs: 3000, intervalMs: 150, label: 'notifications.active assist(90000001)' }
  );
  assert(activeAssist, 'assist active notification이 생성되지 않았습니다.');
  console.log('   ✓ notifications.active: assist registered');

  // 다음 테스트에서 /api/notifications/latest가 assist를 먼저 반환할 수 있으므로, active를 비워둠
  try {
    await apiRequestJson(backendPort, 'POST', '/api/notifications/confirm', {});
  } catch {
    // ignore
  }

  console.log('\n7) 임의 밸코드 시나리오: 문구 등록 -> 시리얼 벨 송신 -> API 반영');
  const bell5 = randBell5();
  const key1 = String(Math.floor(Math.random() * 10));
  const bell6 = `${bell5}${key1}`.toLowerCase();

  // Host는 LoadPhrases 시 "[TEST]"로 시작하는 문구를 자동 정리하므로 해당 접두사는 쓰지 않음
  const phraseText = `[SELFTEST] bell ${bell6}`;
  const created = await apiRequestJson(backendPort, 'POST', '/api/phrases', {
    uid: '',
    text: phraseText,
    isEnabled: true,
    color: '#00AAFF',
    bellCodes: [bell6],
  });
  assert(created?.uid, '문구 생성 응답에 uid가 없습니다.');
  const createdUid = created.uid;
  console.log(`   ✓ phrase created uid=${createdUid}`);

  // 암호화 모드: bot.sendBell은 seed 수신 후 자동으로 암호화 프레임을 송신함
  await bot.sendBell(bell6.slice(0, 5), bell6.slice(5));

  const detectedBell = await poll(
    async () => {
      const d = await apiRequestJson(backendPort, 'GET', '/api/bell/detect');
      return d?.bellCode === bell6 ? d : null;
    },
    { timeoutMs: 2000, intervalMs: 100, label: 'bell.detect random bell' }
  );
  console.log(`   ✓ bell.detect: ${detectedBell.bellCode}`);

  const activeBell = await poll(
    async () => {
      const a = await apiRequestJson(backendPort, 'GET', '/api/notifications/active');
      const list = a?.notifications || [];
      const hit = list.find((n) => n.uid === createdUid && n.isRegistered === true);
      return hit ? hit : null;
    },
    { timeoutMs: 3000, intervalMs: 150, label: 'notifications.active for created uid' }
  );
  assert(activeBell.message === phraseText, `active.message 불일치: "${activeBell.message}"`);
  console.log('   ✓ notifications.active: message match');

  console.log('\n8) 정리: 테스트 문구 삭제, 시리얼 disconnect, 봇 종료');
  try {
    await apiRequestJson(backendPort, 'DELETE', `/api/phrases/${encodeURIComponent(createdUid)}`);
    console.log('   ✓ phrase deleted');
  } catch (e) {
    console.log(`   ⚠ phrase delete 실패(무시 가능): ${e?.message || e}`);
  }

  try {
    await apiRequestJson(backendPort, 'POST', '/api/serialport/disconnect', {});
  } catch {
    // ignore
  }

  await bot.close();
  console.log('\n=== selftest 통과! ===');
  cleanupHost();
}

main().catch((e) => {
  console.error('\n❌ selftest 실패:', e?.message || e);
  process.exit(1);
});


