/**
 * Tests for Knowledge Routes (knowledge-routes.ts)
 *
 * Auto-generated route registration tests
 */

import { describe, it, expect } from '@jest/globals';

describe('Knowledge Routes', () => {
  it('should export a valid Fastify plugin function', async () => {
    const mod = await import('../knowledge-routes');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});
