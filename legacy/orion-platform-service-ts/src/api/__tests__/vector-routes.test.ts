/**
 * Tests for Vector Routes (vector-routes.ts)
 *
 * Auto-generated route registration tests
 */

import { describe, it, expect } from '@jest/globals';

describe('Vector Routes', () => {
  it('should export a valid Fastify plugin function', async () => {
    const mod = await import('../vector-routes');
    expect(mod.vectorRoutes).toBeDefined();
    expect(typeof mod.vectorRoutes).toBe('function');
  });
});
