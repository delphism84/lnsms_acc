import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { connectDb } from "./db.js";
import { Room } from "./models/Room.js";
import { registerSocketHandlers } from "./socket.js";

const PORT = Number(process.env.PORT || 53001);
const MONGO_URI = process.env.MONGO_URI;
const CORS_ORIGIN =
  process.env.CORS_ORIGIN ||
  "https://voice.dair.co.kr,http://voice.dair.co.kr,http://localhost:53002,http://127.0.0.1:53002";

const corsOrigins = CORS_ORIGIN.split(",").map((s) => s.trim());

const app = express();
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "lnvoice" });
});

app.get("/api/rooms", async (_req, res) => {
  try {
    const rooms = await Room.find().sort({ createdAt: -1 }).lean();
    res.json({
      rooms: rooms.map((r) => ({
        id: String(r._id),
        name: r.name,
        maxParticipants: r.maxParticipants ?? 8,
        createdAt: r.createdAt,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to list rooms" });
  }
});

app.post("/api/rooms", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      res.status(400).json({ error: "name required" });
      return;
    }
    const room = await Room.create({ name });
    res.status(201).json({
      room: {
        id: String(room._id),
        name: room.name,
        maxParticipants: room.maxParticipants,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to create room" });
  }
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: corsOrigins, credentials: true },
  path: "/socket.io",
});

registerSocketHandlers(io);

async function main() {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is required");
  }
  await connectDb(MONGO_URI);
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[lnvoice] http://0.0.0.0:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
