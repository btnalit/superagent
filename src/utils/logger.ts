import pino from 'pino';

const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
const level = process.env.LOG_LEVEL || (verbose ? 'info' : 'silent');

export const logger = pino({
  level,
  name: 'mercury',
}, pino.destination(2),
);