/**
 * Tests for Workflow Routes (workflow-routes.ts)
 *
 * Auto-generated route registration tests
 */

import { describe, it, expect } from '@jest/globals';

describe('Workflow Routes', () => {
  it('should export a valid Fastify plugin function', async () => {
    const mod = await import('../workflow-routes');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});
