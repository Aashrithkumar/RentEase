import { config, validateConfig } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { app } from './app.js';
validateConfig();
const server = app.listen(config.port, '0.0.0.0', () => console.log(`RentEase API: http://localhost:${config.port}`));
connectDatabase().then(() => console.log('MongoDB connected.')).catch(() => console.error('MongoDB connection failed. Check Atlas network access and credentials. The health endpoint reports the connection state.'));
let stopping = false;
async function shutdown() { if (stopping)
    return; stopping = true; server.close(async () => { await disconnectDatabase(); process.exit(0); }); setTimeout(() => process.exit(1), 10000).unref(); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
