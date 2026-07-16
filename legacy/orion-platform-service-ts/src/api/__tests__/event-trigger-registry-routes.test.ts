/**
 * Tests for Event Trigger Registry Routes (event-trigger-registry-routes.ts)
 *
 * Auto-generated route registration tests
 */

import { describe, it, expect } from '@jest/globals';

describe('Event Trigger Registry Routes', () => {
  it('should export a valid Fastify plugin function', async () => {
    const mod = await import('../event-trigger-registry-routes');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});
