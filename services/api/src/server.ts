import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { logger } from './logger.js';

const server = createApp().listen(config.PORT, () => {
  logger.info({ port: config.PORT, payments: config.paymentsMode }, 'api listening');
});

// ALB idle timeout is 60s; keep sockets open slightly longer to avoid 502s on reuse.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 15_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
