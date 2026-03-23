const { SerialCareReceiverBot } = require('./serialBot');
const crypto = require('crypto');

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

function randBell5() {
  const alphabet = '0123456789abcdef';
  const b = crypto.randomBytes(5);
  let s = '';
  for (let i = 0; i < 5; i++) s += alphabet[b[i] % alphabet.length];
  return s;
}

function nowIso() {
  return new Date().toISOString();
}

async function main() {
  const args = parseArgs(process.argv);
  const port = args.port || 'COM2';
  const baud = Number(args.baud || 9600);
  const intervalMs = Number(args.intervalMs || 0); // 0이면 자동 송신 없음

  const bot = new SerialCareReceiverBot({
    portName: String(port),
    baudRate: baud,
    sendReadyOnOpen: args.ready !== 'false',
    onRxLine: (line) => console.log(`[${nowIso()}] [bot] RX: ${line}`),
    onTxLine: (line) => console.log(`[${nowIso()}] [bot] TX: ${line}`),
  });

  await bot.open();
  console.log(`[${nowIso()}] [bot] OPEN ${port} @ ${baud}`);
  console.log(`[${nowIso()}] [bot] 사용 예:`);
  console.log(`  - 벨: 자동 송신을 켜려면 --intervalMs=3000`);
  console.log(`  - 도움요청: 자동 송신은 selftest로 검증 권장`);

  if (intervalMs > 0) {
    setInterval(() => {
      const bell5 = randBell5();
      const key1 = String(Math.floor(Math.random() * 10));
      bot.sendBell(bell5, key1).catch((e) =>
        console.error(`[${nowIso()}] [bot] sendBell error:`, e?.message || e)
      );
    }, intervalMs);
  }

  // 종료 처리
  const shutdown = async () => {
    try {
      await bot.close();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

