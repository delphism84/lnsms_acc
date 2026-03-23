import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connect } from './db.js';
import phrasesRouter from './routes/phrases.js';
import serialportRouter from './routes/serialport.js';
import authRouter from './routes/auth.js';
import { getUsersCollection } from './db.js';
import usersRouter from './routes/users.js';
import storeRouter from './routes/store.js';
import setsRouter from './routes/sets.js';
import agentsRouter from './routes/agents.js';
import broadcastRouter from './routes/broadcast.js';

const PORT = Number(process.env.PORT) || 60000;

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api/phrases', phrasesRouter);
app.use('/api/serialport', serialportRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/store', storeRouter);
app.use('/api/sets', setsRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/broadcast', broadcastRouter);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: process.env.DB_NAME || 'lnsms' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

async function ensureAdmin() {
  const coll = getUsersCollection();
  const admin = await coll.findOne({ userid: 'admin' });
  if (!admin) {
    await coll.insertOne({ userid: 'admin', userpw: 'admin', createdAt: new Date() });
    console.log('Seeded default user: admin/admin');
  }
}

async function main() {
  await connect();
  await ensureAdmin();
  console.log('MongoDB connected, DB:', process.env.DB_NAME || 'lnsms');

  const HOST = process.env.HOST || '0.0.0.0';
  app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT} (localhost:${PORT})`);
  });
}

main().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
