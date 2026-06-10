import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(window.location.origin, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
  }
  return socket;
}

/** 시그널링 전 socket.id 확보 */
export function waitForSocket(): Promise<Socket> {
  const s = getSocket();
  if (s.connected && s.id) return Promise.resolve(s);
  return new Promise((resolve) => {
    const done = () => resolve(s);
    if (s.connected && s.id) {
      done();
      return;
    }
    s.once("connect", done);
    s.connect();
  });
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
