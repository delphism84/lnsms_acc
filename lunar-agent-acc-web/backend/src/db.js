import { MongoClient } from 'mongodb';

const DB_NAME = process.env.DB_NAME || 'lnsms';
const DOC_ID = 'db';
const SERIAL_DOC_ID = 'serial';

let client = null;
let db = null;

export async function connect() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required');
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(DB_NAME);
  return db;
}

export function getDb() {
  if (!db) throw new Error('DB not connected. Call connect() first.');
  return db;
}

export function getPhrasesCollection() {
  return getDb().collection('phrases');
}

export function getSerialSettingsCollection() {
  return getDb().collection('serial_settings');
}

export function getUsersCollection() {
  return getDb().collection('users');
}

export function getStoreCollection() {
  return getDb().collection('store');
}

export function getAgentSetsCollection() {
  return getDb().collection('agent_sets');
}

export { DOC_ID, SERIAL_DOC_ID };
