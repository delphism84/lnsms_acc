const { SerialPort } = require('serialport');
const { decodeSeedMarkString, encryptInner, bytesToHex } = require('./secureCodec');
const fs = require('fs');
const path = require('path');

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toPrintableAscii(buf) {
  let out = '';
  for (const b of buf) {
    // printable ASCII range
    if (b >= 0x20 && b <= 0x7e) out += String.fromCharCode(b);
    else if (b === 0x0d) out += '\\r';
    else if (b === 0x0a) out += '\\n';
    else if (b === 0x09) out += '\\t';
    else out += '.';
  }
  return out;
}

function toHexPairs(buf) {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}

/**
 * Care Receiver 에뮬레이터 (COM2 사용 가정)
 *
 * Host 기준 프로토콜(v4, sn prefix):
 * - PC -> Care Receiver: "<sn>\r" (sn 미확정이면 "00000000\r")
 * - Care Receiver -> PC: "<sn>.ok\r" (PC가 보낸 8자리와 동일 접두, 예: "00000000\r" → "00000000.ok\r"),
 *   "<sn>.ready\r", "<sn>.bell=xxxxxy\r", "<sn>.assist\r", 암호화 시 "<sn>.<32hex>\r"
 * - 라인 구분자는 \r 이 기본이며, \n은 무시 가능
 */
class SerialCareReceiverBot {
  /**
   * @param {object} opts
   * @param {string} opts.portName e.g. "COM2"
   * @param {number} [opts.baudRate=9600]
   * @param {boolean} [opts.sendReadyOnOpen=true]
   * @param {(line: string) => void} [opts.onRxLine]
   * @param {(line: string) => void} [opts.onTxLine]
   * @param {boolean} [opts.enableHexLog=false] selftest용 RX/TX hexdump 로깅
   * @param {string} [opts.hexLogPath] 로그 파일 경로
   */
  constructor(opts) {
    if (!opts?.portName) throw new Error('portName이 필요합니다. 예: COM2');
    this.portName = opts.portName;
    this.baudRate = opts.baudRate ?? 9600;
    this.sendReadyOnOpen = opts.sendReadyOnOpen ?? true;
    this.deviceSerial = String(opts.deviceSerial || '26020011').trim();
    this.onRxLine = opts.onRxLine;
    this.onTxLine = opts.onTxLine;
    this.enableHexLog = opts.enableHexLog ?? false;
    this.hexLogPath = opts.hexLogPath || null;

    /** @type {import('serialport').SerialPort | null} */
    this.port = null;
    this._buf = '';
    this._receivedCrcvCheck = 0;
    this._sessionSeed = null;
  }

  _appendHexLog(line) {
    if (!this.enableHexLog) return;
    if (!this.hexLogPath) return;
    try {
      fs.mkdirSync(path.dirname(this.hexLogPath), { recursive: true });
      fs.appendFileSync(this.hexLogPath, line + '\n', { encoding: 'utf8' });
    } catch {
      // 로그 실패는 테스트를 깨지 않도록 무시
    }
  }

  get receivedCrcvCheckCount() {
    return this._receivedCrcvCheck;
  }

  async open() {
    if (this.port?.isOpen) return;

    this.port = new SerialPort({
      path: this.portName,
      baudRate: this.baudRate,
      autoOpen: false,
    });

    await new Promise((resolve, reject) => {
      this.port.open((err) => (err ? reject(err) : resolve()));
    });

    this.port.on('data', (chunk) => {
      if (chunk && chunk.length) {
        this._appendHexLog(
          `[${nowIso()}] RX bytes(${chunk.length}): ${toHexPairs(chunk)} | ${toPrintableAscii(chunk)}`
        );
      }
      const s = chunk.toString('utf8');
      if (!s) return;
      this._processIncoming(s);
    });

    this.port.on('error', (err) => {
      // selftest에서 잡히도록 그냥 throw는 하지 않음. 로깅만.
      console.error(`[${nowIso()}] [bot] serial error:`, err?.message || err);
    });

    if (this.sendReadyOnOpen) {
      // Host는 Connect 직후 "crcv\r"를 보내기도 해서, ready는 약간 늦게 쏴도 무방
      await sleep(100);
      await this.sendReady();
    }
  }

  async close() {
    if (!this.port) return;
    const p = this.port;
    this.port = null;
    await new Promise((resolve) => p.close(() => resolve()));
  }

  _emitRx(line) {
    if (this.onRxLine) this.onRxLine(line);
  }

  _emitTx(line) {
    if (this.onTxLine) this.onTxLine(line);
  }

  _processIncoming(data) {
    this._buf += data;

    // Host는 \r 기준으로 프레이밍하며, \n은 무시
    while (this._buf.includes('\r') || this._buf.includes('\n')) {
      const idxR = this._buf.indexOf('\r');
      const idxN = this._buf.indexOf('\n');
      let cut = -1;
      if (idxR >= 0 && idxN >= 0) cut = Math.min(idxR, idxN);
      else cut = idxR >= 0 ? idxR : idxN;

      const line = this._buf.slice(0, cut).trim();
      this._buf = this._buf.slice(cut + 1);
      // 다음이 \r\n 이면 \n도 제거
      this._buf = this._buf.replace(/^\n+/, '');

      if (!line) continue;
      this._emitRx(line);
      this._autoRespond(line).catch((e) => {
        console.error(`[${nowIso()}] [bot] autoRespond error:`, e?.message || e);
      });
    }
  }

  async _autoRespond(line) {
    // (호환) PC 통신 체크: "crcv"
    if (line === 'crcv') {
      this._receivedCrcvCheck += 1;
      await this.sendOk();
      return;
    }

    // v4 통신 체크: "<sn>" 또는 "00000000" — 실제 모듈은 수신 시리얼과 동일 접두로 "<sn>.ok" 응답
    if (/^(\d{8})$/.test(line)) {
      this._receivedCrcvCheck += 1;
      await this.sendLine(`${line}.ok`);
      return;
    }

    // (호환) 시드 동기화: "crcv.seed=<mark>"
    if (line.startsWith('crcv.seed=')) {
      const mark = line.slice('crcv.seed='.length);
      try {
        this._sessionSeed = decodeSeedMarkString(mark);
        await this.sendOk();
      } catch (e) {
        // ignore
      }
      return;
    }

    // v4 시드 동기화: "<sn>.seed=<mark>"
    const mSeed = line.match(/^(\d{8})\.seed=(.+)$/);
    if (mSeed) {
      const sn = mSeed[1];
      const mark = mSeed[2];
      try {
        this._sessionSeed = decodeSeedMarkString(mark);
        await this.sendLine(`${sn}.ok`);
      } catch (e) {
        // ignore
      }
      return;
    }
  }

  async _writeRaw(raw) {
    if (!this.port?.isOpen) throw new Error('시리얼 포트가 열려있지 않습니다.');
    const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw), 'utf8');
    if (buf.length) {
      this._appendHexLog(
        `[${nowIso()}] TX bytes(${buf.length}): ${toHexPairs(buf)} | ${toPrintableAscii(buf)}`
      );
    }
    await new Promise((resolve, reject) => {
      this.port.write(buf, (err) => {
        if (err) return reject(err);
        this.port.drain((err2) => (err2 ? reject(err2) : resolve()));
      });
    });
  }

  async sendLine(line) {
    // Host는 \r만 전송/수신 프레이밍(코드 기준)
    const raw = `${line}\r`;
    this._emitTx(line);
    await this._writeRaw(raw);
  }

  async sendOk() {
    await this.sendLine('ok');
  }

  async sendReady() {
    await this.sendEventInner('ready');
  }

  async sendAssist() {
    await this.sendEventInner('assist');
  }

  /**
   * @param {string} bell5 5자리 벨 코드(예: "0d0af")
   * @param {string|number} key1 1자리 키(예: "3")
   */
  async sendBell(bell5, key1) {
    const bell = String(bell5 ?? '').trim();
    const key = String(key1 ?? '').trim();
    if (bell.length !== 5) throw new Error(`bell5는 5자리여야 합니다. got="${bell}"`);
    if (key.length !== 1) throw new Error(`key1은 1자리여야 합니다. got="${key}"`);
    await this.sendEventInner(`bell=${bell}${key}`);
  }

  async sendEventInner(inner) {
    // 시드가 있으면 암호화 모드: "<sn>.<32hex>"
    if (this._sessionSeed !== null && this._sessionSeed !== undefined) {
      const c16 = encryptInner(String(inner), this._sessionSeed);
      const hex = bytesToHex(c16);
      // selftest 로그용: 암호화 payload 자체(16bytes)도 같이 남김
      this._appendHexLog(`[${nowIso()}] TX secure(inner="${String(inner)}"): ${toHexPairs(Buffer.from(c16))}`);
      await this.sendLine(`${this.deviceSerial}.${hex}`);
      return;
    }
    // 시드가 없으면 평문(호환)
    await this.sendLine(`${this.deviceSerial}.${String(inner)}`);
  }
}

module.exports = { SerialCareReceiverBot };

