import { startServer } from './app';

startServer().catch((error) => {
  console.error('[runner] Fatal error:', error);
  process.exit(1);
});
