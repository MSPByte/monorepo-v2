import pino from 'pino';
import { env } from './env.js';
export const logger = pino({ name: 'mspbyte:ingestion', level: env.LOG_LEVEL ?? 'info' });
