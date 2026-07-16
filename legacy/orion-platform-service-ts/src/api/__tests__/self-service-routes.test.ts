/**
 * Tests for Self-Service Routes (self-service-routes.ts)
 *
 * Auto-generated route registration tests
 */

import { describe, it, expect } from '@jest/globals';

describe('Self-Service Routes', () => {
  it('should export a valid Fastify plugin function', async () => {
    const mod = await import('../self-service-routes');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});
