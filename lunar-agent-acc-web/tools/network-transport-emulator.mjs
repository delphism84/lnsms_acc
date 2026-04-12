/**
 * TCP/UDP 송신 에뮬레이터 — 에이전트(NetworkTransport) 수신 검수용
 *
 * TCP: 127.0.0.1:TCP_PORT 에 서버. 클라이언트(에이전트) 접속 시 `0.bell=emulator.tcp\r` 전송.
 * UDP: 127.0.0.1:UDP_PORT 에 바인드. 에이전트 hello 수신 시 같은 소켓에서 `0.bell=emulator.udp\r` 로 회신.
 *
 * 실행: node network-transport-emulator.mjs
 */

import net from 'node:net';
import dgram from 'node:dgram';

// TCP 기본: telnet 관례 23 (권한 필요 시 TCP_PORT=29101 등으로 재정의)
const TCP_PORT = Number(process.env.TCP_PORT || 23);
const UDP_PORT = Number(process.env.UDP_PORT || 29102);
const LINE_TCP = '0.bell=emulator.tcp\r';
const LINE_UDP = '0.bell=emulator.udp\r';

const tcpServer = net.createServer((socket) => {
  console.log('[TCP] client connected from', socket.remoteAddress, socket.remotePort);
  const send = () => {
    try {
      socket.write(LINE_TCP);
      console.log('[TCP] sent bell line');
    } catch (e) {
      console.error('[TCP] write error', e);
    }
  };
  send();
  const iv = setInterval(send, 8000);
  socket.on('close', () => {
    clearInterval(iv);
    console.log('[TCP] client disconnected');
  });
  socket.on('error', (e) => console.error('[TCP] socket error', e.message));
});

tcpServer.listen(TCP_PORT, '127.0.0.1', () => {
  console.log(`[TCP] listening 127.0.0.1:${TCP_PORT}`);
});

const udpServer = dgram.createSocket('udp4');
udpServer.on('message', (msg, rinfo) => {
  console.log('[UDP] recv from', `${rinfo.address}:${rinfo.port}`, msg.toString('utf8').replace(/\r/g, '\\r'));
  udpServer.send(Buffer.from(LINE_UDP, 'utf8'), rinfo.port, rinfo.address, (err) => {
    if (err) console.error('[UDP] send error', err);
    else console.log('[UDP] sent bell line to', `${rinfo.address}:${rinfo.port}`);
  });
});
udpServer.on('error', (e) => console.error('[UDP] server error', e));
udpServer.bind(UDP_PORT, '127.0.0.1', () => {
  console.log(`[UDP] listening 127.0.0.1:${UDP_PORT}`);
});
