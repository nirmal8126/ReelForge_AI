import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

// Try to use pino-pretty if available, otherwise use basic logger
let transport;
if (isDevelopment) {
  try {
    require.resolve('pino-pretty');
    transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  } catch {
    // pino-pretty not available, use default
    transport = undefined;
  }
}

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport,
  base: {
    service: 'reelforge-worker',
  },
});

export default logger;
