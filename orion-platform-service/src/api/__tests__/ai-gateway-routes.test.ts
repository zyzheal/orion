/**
 * Tests for Ai Gateway Routes (ai-gateway-routes.ts)
 *
 * Auto-generated route registration tests
 */

import { describe, it, expect } from '@jest/globals';

describe('Ai Gateway Routes', () => {
  it('should export a valid Fastify plugin function', async () => {
    const mod = await import('../ai-gateway-routes');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});
