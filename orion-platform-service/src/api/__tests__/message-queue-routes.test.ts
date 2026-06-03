/**
 * Tests for Message Queue Routes (message-queue-routes.ts)
 *
 * Auto-generated route registration tests
 */

import { describe, it, expect } from '@jest/globals';

describe('Message Queue Routes', () => {
  it('should export a valid Fastify plugin function', async () => {
    const mod = await import('../message-queue-routes');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});
