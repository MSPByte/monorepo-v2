import pino from 'pino';
import { env } from './env.js';
export const logger = pino({ name: 'mspbyte:pipeline', level: env.LOG_LEVEL ?? 'info' });
