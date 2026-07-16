/**
 * Tests for Dual Engine Routes (dual-engine-routes.ts)
 *
 * Auto-generated route registration tests
 */

import { describe, it, expect } from '@jest/globals';

describe('Dual Engine Routes', () => {
  it('should export a valid Fastify plugin function', async () => {
    const mod = await import('../dual-engine-routes');
    expect(mod.dualEngineRoutes).toBeDefined();
    expect(typeof mod.dualEngineRoutes).toBe('function');
  });
});
