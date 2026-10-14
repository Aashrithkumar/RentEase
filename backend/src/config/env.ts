import dotenv from 'dotenv';
import dns from 'node:dns';
dotenv.config();
// This optional resolver override affects this process, never Windows settings.
if (process.env.MONGO_DNS_SERVERS)
    dns.setServers(process.env.MONGO_DNS_SERVERS.split(',').map(s => s.trim()).filter(Boolean));
export const config = {
    port: Number(process.env.PORT || 5000), mongoUri: process.env.MONGO_URI || '',
    jwtSecret: process.env.JWT_SECRET || '', production: process.env.NODE_ENV === 'production',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};
export function validateConfig() {
    if (!config.mongoUri || !config.jwtSecret)
        throw new Error('MONGO_URI and JWT_SECRET are required.');
    if (config.production && (config.jwtSecret.length < 32 || config.jwtSecret === 'your_secret_key'))
        throw new Error('Use a random JWT_SECRET of at least 32 characters in production.');
    if (config.production && !config.frontendUrl.startsWith('https://'))
        throw new Error('FRONTEND_URL must use HTTPS in production.');
}
