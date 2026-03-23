// docs/secure_fw.c 기반 시드/난독화/CRC 코덱 (Node용)

const BASE_RAND_CHAR = 0x20;

function htoaNibble(n) {
  n &= 0x0f;
  return n <= 9 ? 0x30 + n : 0x61 + (n - 10); // '0'..'9','a'..'f'
}

function isHexChar(c) {
  return (
    (c >= 0x30 && c <= 0x39) || // 0-9
    (c >= 0x61 && c <= 0x66) || // a-f
    (c >= 0x41 && c <= 0x46) // A-F
  );
}

function fromHexChar(c) {
  if (c >= 0x30 && c <= 0x39) return c - 0x30;
  c |= 0x20;
  if (c >= 0x61 && c <= 0x66) return c - 0x61 + 10;
  throw new Error('invalid hex char');
}

function hexToBytes(hex) {
  const s = Buffer.from(hex, 'utf8');
  if (s.length % 2 !== 0) throw new Error('hex length must be even');
  const out = Buffer.alloc(s.length / 2);
  for (let i = 0; i < out.length; i++) {
    const hi = fromHexChar(s[i * 2]);
    const lo = fromHexChar(s[i * 2 + 1]);
    out[i] = (hi << 4) | lo;
  }
  return out;
}

function bytesToHex(buf) {
  const alphabet = '0123456789abcdef';
  let s = '';
  for (const b of buf) {
    s += alphabet[b >> 4];
    s += alphabet[b & 0x0f];
  }
  return s;
}

// secure_fw.c crc_8() 이식
function crc8(buf, size) {
  let crc = 0;
  for (let cnt = 0; cnt <= size; cnt++) {
    let ch = cnt === size ? 0 : buf[cnt];
    for (let bit = 0; bit < 8; bit++) {
      const flag = (crc & 0x80) !== 0;
      crc = (crc << 1) & 0xff;
      if ((ch & 0x80) !== 0) crc |= 0x01;
      else crc &= 0xfe;
      if (flag) crc ^= 0x07;
      ch = (ch << 1) & 0xff;
    }
  }
  return crc & 0xff;
}

function decodeSeedMarkString(mark44) {
  if (!mark44 || typeof mark44 !== 'string') throw new Error('mark44 required');
  if (mark44.length < 36) throw new Error('mark too short');

  const p = Buffer.from(mark44, 'utf8');
  const loc0 = p[0] - BASE_RAND_CHAR;
  const loc1 = p[1] - BASE_RAND_CHAR;
  const loc2 = p[34] - BASE_RAND_CHAR;
  const loc3 = p[35] - BASE_RAND_CHAR;

  const n12 = (p[2 + loc0] - BASE_RAND_CHAR) & 0x0f;
  const n8 = (p[2 + loc1] - BASE_RAND_CHAR) & 0x0f;
  const n4 = (p[2 + loc2] - BASE_RAND_CHAR) & 0x0f;
  const n0 = (p[2 + loc3] - BASE_RAND_CHAR) & 0x0f;

  return ((n12 << 12) | (n8 << 8) | (n4 << 4) | n0) & 0xffff;
}

function swap16(buf, a, b) {
  a &= 0x0f;
  b &= 0x0f;
  if (a === b) return;
  const t = buf[a];
  buf[a] = buf[b];
  buf[b] = t;
}

function encryptInner(innerPlain, sessionSeed) {
  const seed = sessionSeed & 0xffff;
  const s0 = seed & 0x0f;
  const s4 = (seed >> 4) & 0x0f;
  const s8 = (seed >> 8) & 0x0f;
  const s12 = (seed >> 12) & 0x0f;

  const plain = Buffer.from(String(innerPlain ?? ''), 'ascii');
  const p15 = Buffer.alloc(15, 0x00);
  plain.copy(p15, 0, 0, Math.min(15, plain.length));

  const c = Buffer.alloc(16);
  p15.copy(c, 0);
  c[15] = crc8(c, 15);

  swap16(c, s0, s12);
  swap16(c, s4, s8);

  for (let i = 0; i < 16; i++) {
    const b = c[i];
    let tmp;
    switch (i & 3) {
      case 0:
        tmp = (b + 0x55) & 0xff;
        c[i] = ((tmp ^ htoaNibble(s0)) + i) & 0xff;
        break;
      case 1:
        tmp = (b + 0x46) & 0xff;
        c[i] = ((tmp ^ htoaNibble(s4)) + i) & 0xff;
        break;
      case 2:
        tmp = (b + 0x37) & 0xff;
        c[i] = ((tmp ^ htoaNibble(s8)) + i) & 0xff;
        break;
      default:
        tmp = (b + 0x28) & 0xff;
        c[i] = ((tmp ^ htoaNibble(s12)) + i) & 0xff;
        break;
    }
  }

  return c;
}

function decryptHexPayload(encodedHex, sessionSeed) {
  const seed = sessionSeed & 0xffff;
  const s0 = seed & 0x0f;
  const s4 = (seed >> 4) & 0x0f;
  const s8 = (seed >> 8) & 0x0f;
  const s12 = (seed >> 12) & 0x0f;

  if (!encodedHex || encodedHex.length !== 32) return null;
  const buf = Buffer.from(encodedHex, 'utf8');
  for (const c of buf) if (!isHexChar(c)) return null;

  const d = hexToBytes(encodedHex);

  for (let i = 15; i >= 0; i--) {
    const b = d[i];
    let x;
    switch (i & 3) {
      case 3:
        x = ((b - i) & 0xff) ^ htoaNibble(s12);
        d[i] = (x - 0x28) & 0xff;
        break;
      case 2:
        x = ((b - i) & 0xff) ^ htoaNibble(s8);
        d[i] = (x - 0x37) & 0xff;
        break;
      case 1:
        x = ((b - i) & 0xff) ^ htoaNibble(s4);
        d[i] = (x - 0x46) & 0xff;
        break;
      default:
        x = ((b - i) & 0xff) ^ htoaNibble(s0);
        d[i] = (x - 0x55) & 0xff;
        break;
    }
  }

  swap16(d, s0, s12);
  swap16(d, s4, s8);

  if (crc8(d, 16) !== 0) return null;

  // 15바이트에서 trailing 0x00 trim
  let end = 14;
  while (end >= 0 && d[end] === 0x00) end--;
  const inner = end >= 0 ? d.slice(0, end + 1).toString('ascii') : '';
  return { inner, raw16: d };
}

module.exports = {
  decodeSeedMarkString,
  encryptInner,
  decryptHexPayload,
  bytesToHex,
};

