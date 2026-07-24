/**
 * Tests for Workflow Trigger Routes (workflow-trigger-routes.ts)
 *
 * Auto-generated route registration tests
 */

import { describe, it, expect } from '@jest/globals';

describe('Workflow Trigger Routes', () => {
  it('should export a valid Fastify plugin function', async () => {
    const mod = await import('../workflow-trigger-routes');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});
