/**
 * Tests for Cache Cleanup Routes (cache-cleanup-routes.ts)
 *
 * Auto-generated route registration tests
 */

import { describe, it, expect } from '@jest/globals';

describe('Cache Cleanup Routes', () => {
  it('should export a valid Fastify plugin function', async () => {
    const mod = await import('../cache-cleanup-routes');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});
