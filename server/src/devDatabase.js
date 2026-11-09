// Development only: runs a real MongoDB replica set, retaining files in the workspace.
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const dbPath = fileURLToPath(new URL('../../.local/mongodb', import.meta.url));
await mkdir(dbPath, { recursive: true });
const mongo = await MongoMemoryReplSet.create({
  instanceOpts: [{ dbPath, port: 27017 }],
  replSet: { count: 1, name: 'rs0', ip: '127.0.0.1', storageEngine: 'wiredTiger' },
});
console.log('MongoDB ready: mongodb://127.0.0.1:27017/QuanLyMuonSach?replicaSet=rs0');
console.log(
  'Development data retained in .local/mongodb. Keep this terminal open. Ctrl+C to stop.',
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await mongo.stop({ doCleanup: false, force: false });
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
