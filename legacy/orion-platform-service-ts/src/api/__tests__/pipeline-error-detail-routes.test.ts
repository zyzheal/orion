/**
 * Tests for Pipeline Error Detail Routes (pipeline-error-detail-routes.ts)
 *
 * Auto-generated route registration tests
 */

import { describe, it, expect } from '@jest/globals';

describe('Pipeline Error Detail Routes', () => {
  it('should export a valid Fastify plugin function', async () => {
    const mod = await import('../pipeline-error-detail-routes');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});
