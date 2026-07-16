/**
 * Tests for Pipeline Budget Routes (pipeline-budget-routes.ts)
 *
 * Auto-generated route registration tests
 */

import { describe, it, expect } from '@jest/globals';

describe('Pipeline Budget Routes', () => {
  it('should export a valid Fastify plugin function', async () => {
    const mod = await import('../pipeline-budget-routes');
    expect(mod.registerBudgetRoutes).toBeDefined();
    expect(typeof mod.registerBudgetRoutes).toBe('function');
  });
});
