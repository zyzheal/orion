/**
 * Tests for Pipeline Graph Routes (pipeline-graph-routes.ts)
 *
 * Auto-generated route registration tests
 */

import { describe, it, expect } from '@jest/globals';

describe('Pipeline Graph Routes', () => {
  it('should export a valid Fastify plugin function', async () => {
    const mod = await import('../pipeline-graph-routes');
    expect(mod.registerPipelineGraphRoutes).toBeDefined();
    expect(typeof mod.registerPipelineGraphRoutes).toBe('function');
  });
});
