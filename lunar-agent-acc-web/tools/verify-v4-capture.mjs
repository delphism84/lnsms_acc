/**
 * 실장 캡처 32hex 라인과 SecureSerialCodec(v4) 일치 여부 검증.
 *
 * 동일 시드에서 두 캡처(1111/1234)가 모두 CRC 통과하는 시드는 소수이며,
 * 시드 0x1234(문서상 sd 미설정 시 기본값)에서 평문이 protocol-v2-serialadd.md §6 의
 * dt= 호출 프레임으로 복호화됨을 확인했습니다. (bell= 가 아님)
 *
 * 실행: node tools/verify-v4-capture.mjs
 */

function htoaNibble(n) {
  n &= 0x0f;
  return n <= 9 ? 0x30 + n : 0x61 + (n - 10);
}

function crc8(source, size) {
  let crc = 0;
  for (let cnt = 0; cnt <= size; cnt++) {
    let ch = cnt === size ? 0 : source[cnt];
    for (let bit = 0; bit < 8; bit++) {
      const flag = (crc & 0x80) !== 0;
      crc = (crc << 1) & 0xff;
      if ((ch & 0x80) !== 0) crc |= 1;
      else crc &= 0xfe;
      if (flag) crc ^= 0x07;
      ch = (ch << 1) & 0xff;
    }
  }
  return crc & 0xff;
}

function swap(buf, a, b) {
  a &= 0x0f;
  b &= 0x0f;
  if (a === b) return;
  const t = buf[a];
  buf[a] = buf[b];
  buf[b] = t;
}

function hexToBytes(hex) {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < b.length; i++) {
    b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return b;
}

function tryDecryptInner(data16, sessionSeed) {
  const plain16 = new Uint8Array(data16);
  const s0 = sessionSeed & 0x0f;
  const s4 = (sessionSeed >> 4) & 0x0f;
  const s8 = (sessionSeed >> 8) & 0x0f;
  const s12 = (sessionSeed >> 12) & 0x0f;

  for (let i = 15; i >= 0; i--) {
    let b = plain16[i];
    let x;
    switch (i & 3) {
      case 3:
        x = (b - i) ^ htoaNibble(s12);
        plain16[i] = (x - 0x28) & 0xff;
        break;
      case 2:
        x = (b - i) ^ htoaNibble(s8);
        plain16[i] = (x - 0x37) & 0xff;
        break;
      case 1:
        x = (b - i) ^ htoaNibble(s4);
        plain16[i] = (x - 0x46) & 0xff;
        break;
      default:
        x = (b - i) ^ htoaNibble(s0);
        plain16[i] = (x - 0x55) & 0xff;
        break;
    }
  }

  swap(plain16, s4, s8);
  swap(plain16, s0, s12);

  if (crc8(plain16, 16) !== 0) return null;

  let end = -1;
  for (let i = 0; i < 15; i++) {
    if (plain16[i] !== 0) end = i;
  }
  if (end < 0) return '';
  return Buffer.from(plain16.slice(0, end + 1)).toString('ascii');
}

const SEED = 0x1234;

const rows = [
  { label: '1111', hex32: '8d424a5701515757b94a6473be511383' },
  { label: '1234', hex32: '8d424a5701515757b94a6476c85613f8' },
  { label: '9999', hex32: '8d42ba5701515757b94a4c5bc65913ae' },
];

console.log('v4 복호(시드 0x1234) — CareReceiverAgent SecureSerialCodec 와 동일 알고리즘\n');

for (const r of rows) {
  const inner = tryDecryptInner(hexToBytes(r.hex32), SEED);
  console.log(`[${r.label}] 32hex=${r.hex32}`);
  console.log(`  → 평문(접두 점 뒤): ${JSON.stringify(inner)}`);
  console.log('');
}

console.log(
  '해석: 두 번째 줄은 docs/protocol-v2-serialadd.md 의 암호화 프레임이며,',
  '복호 후에는 §6 의 dt=…(호출/설정 등) 형식입니다. 벨코드 bell= 경로와는 별도입니다.',
);
