/**
 * Tests for Pipeline Version Routes (pipeline-version-routes.ts)
 *
 * Auto-generated route registration tests
 */

import { describe, it, expect } from '@jest/globals';

describe('Pipeline Version Routes', () => {
  it('should export a valid Fastify plugin function', async () => {
    const mod = await import('../pipeline-version-routes');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});
