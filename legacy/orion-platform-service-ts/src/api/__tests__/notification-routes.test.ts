/**
 * Tests for Notification Routes (notification-routes.ts)
 *
 * Auto-generated route registration tests
 */

import { describe, it, expect } from '@jest/globals';

describe('Notification Routes', () => {
  it('should export a valid Fastify plugin function', async () => {
    const mod = await import('../notification-routes');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});
