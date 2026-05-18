import pino from 'pino';
import { settings } from '../config/settings';

export const logger = pino({
  level: settings.logLevel,
  transport:
    process.env['NODE_ENV'] !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  base: { service: 'enterprise-agent' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function getLogger(name: string, ctx?: Record<string, unknown>): pino.Logger {
  return logger.child({ module: name, ...ctx });
}
