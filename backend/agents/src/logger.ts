import pino from 'pino';
import { env } from './env.js';
export const logger = pino({ name: 'mspbyte:agents', level: env.LOG_LEVEL ?? 'info' });
