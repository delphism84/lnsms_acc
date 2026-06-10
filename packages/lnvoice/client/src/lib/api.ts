export type RoomSummary = {
  id: string;
  name: string;
  maxParticipants: number;
  createdAt?: string;
};

export async function fetchRooms(): Promise<RoomSummary[]> {
  const res = await fetch("/api/rooms");
  if (!res.ok) throw new Error("방 목록을 불러오지 못했습니다.");
  const data = await res.json();
  return data.rooms as RoomSummary[];
}

export async function createRoom(name: string): Promise<RoomSummary> {
  const res = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("방을 만들지 못했습니다.");
  const data = await res.json();
  return data.room as RoomSummary;
}
