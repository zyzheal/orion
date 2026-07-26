import { buildApp } from './app';
import { initializeTables } from './utils/database';
import config from './config';

/**
 * Community Service 入口
 */
async function main() {
  const { fastify } = await buildApp();

  const port = config.server.port;
  const host = config.server.host;

  try {
    if (config.server.nodeEnv === 'development') {
      await initializeTables();
    }

    await fastify.listen({ port, host });
    fastify.log.info(`Community Service listening on http://${host}:${port}`);
    fastify.log.info(`Health check: http://${host}:${port}/health`);
    fastify.log.info(`API v1 prefix: /api/v1/community, /api/v1/community-advanced`);
  } catch (err) {
    fastify.log.error(err, 'Failed to start Community Service');
    process.exit(1);
  }
}

main();
