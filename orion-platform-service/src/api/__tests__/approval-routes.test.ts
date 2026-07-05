/**
 * Tests for Approval Routes (approval-routes.ts)
 *
 * Auto-generated route registration tests
 */

import { describe, it, expect } from '@jest/globals';

describe('Approval Routes', () => {
  it('should export a valid Fastify plugin function', async () => {
    const mod = await import('../approval-routes');
    expect(mod.registerApprovalRoutes).toBeDefined();
    expect(typeof mod.registerApprovalRoutes).toBe('function');
  });
});
