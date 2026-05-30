require('dotenv').config();
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 40000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function connectMongo() {
  let mongoUri = (process.env.MONGODB_URI || '').trim();
  let mongod = null;

  if (!mongoUri || mongoUri === 'memory') {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongod = await MongoMemoryServer.create({ instance: { dbName: 'lnsms' } });
    mongoUri = mongod.getUri();
    console.log(`✅ MongoMemoryServer: ${mongoUri}`);
  }

  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');

  const cleanup = async () => {
    try {
      await mongoose.disconnect();
    } catch {}
    try {
      if (mongod) await mongod.stop();
    } catch {}
  };
  process.on('SIGINT', async () => {
    await cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await cleanup();
    process.exit(0);
  });
}

async function bootstrap() {
  await connectMongo();
  const { seedGreenfield } = require('./bootstrap/seed');
  await seedGreenfield();
}

bootstrap().catch((e) => console.error('bootstrap failed:', e));

const adminAuthRouter = require('./routes/adminAuth');
const hostAuthRouter = require('./routes/hostAuth');
const hostPasswordRouter = require('./routes/hostPassword');
const hostSyncRouter = require('./routes/hostSync');
const hostUploadRouter = require('./routes/hostUpload');
const platformRouter = require('./routes/platform');
const storeSiteRouter = require('./routes/store/index');

app.use('/api/admin/auth', adminAuthRouter);
app.use('/api/host/auth', hostAuthRouter);
app.use('/api/host/:userid/:storeId', hostPasswordRouter);
app.use('/api/host/:userid/:storeId/sync', hostSyncRouter);
app.use('/api/host/:userid/:storeId/upload', hostUploadRouter);
app.use('/api/platform', platformRouter);
app.use('/api/store/:userid/:storeId', storeSiteRouter);

const uploadDir = process.env.UPLOAD_DIR || '/var/lnsms/uploads';
app.use('/uploads', express.static(uploadDir));

app.get('/', (req, res) => {
  res.json({ message: 'LNSMS Backend API' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), ws: true });
});

const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'The requested resource was not found' });
});

const server = http.createServer(app);
const { attachWsGateway } = require('./ws/gateway');
attachWsGateway(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`LNSMS BE listening on ${PORT} (HTTP + WS /ws)`);
});
