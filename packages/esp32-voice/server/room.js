/** Room hub — CALL_PROTOCOL_V2 §6.2 */

export class RoomHub {
  constructor() {
    /** @type {Map<string, Room>} */
    this.rooms = new Map();
  }

  list() {
    return [...this.rooms.values()].map((r) => r.toJSON());
  }

  get(id) {
    return this.rooms.get(id) ?? null;
  }

  create(id, meta = {}) {
    const rid = (id || randomId()).trim().slice(0, 64);
    if (this.rooms.has(rid)) return this.rooms.get(rid);
    const room = new Room(rid, meta);
    this.rooms.set(rid, room);
    return room;
  }

  ensure(id) {
    return this.get(id) || this.create(id);
  }

  /** Remove empty rooms (optional GC). */
  gc() {
    for (const [id, room] of this.rooms) {
      if (room.members.size === 0 && room.devices.size === 0) this.rooms.delete(id);
    }
  }
}

export class Room {
  constructor(id, meta = {}) {
    this.id = id;
    this.name = meta.name || id;
    this.createdAt = Date.now();
    /** browser / viewer members: viewerId -> Member */
    this.members = new Map();
    /** ESP32 endpoints: deviceId -> DeviceMember */
    this.devices = new Map();
  }

  addMember(m) {
    this.members.set(m.id, m);
  }

  removeMember(id) {
    this.members.delete(id);
  }

  addDevice(d) {
    this.devices.set(d.id, d);
  }

  removeDevice(id) {
    this.devices.delete(id);
  }

  memberList() {
    return [
      ...[...this.members.values()].map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        kind: "viewer",
        mutedIn: m.mutedIn,
        mutedOut: m.mutedOut,
        micGain: m.micGain,
        spkGain: m.spkGain,
        audioLevel: m.audioLevel || 0,
        audioActive: !!m.audioActive,
      })),
      ...[...this.devices.values()].map((d) => ({
        id: d.id,
        name: d.name || d.id,
        role: "endpoint",
        kind: "device",
        mutedIn: d.mutedIn,
        mutedOut: d.mutedOut,
        micGain: d.micGain,
        spkGain: d.spkGain,
        online: d.online,
        audioLevel: d.audioLevel || 0,
        audioActive: !!d.audioActive,
      })),
    ];
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      memberCount: this.members.size + this.devices.size,
      members: this.memberList(),
    };
  }
}

export function randomId(n = 8) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += alphabet[(Math.random() * alphabet.length) | 0];
  return s;
}
