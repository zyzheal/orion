/**
 * Tests for Plugin Hotreload Routes (plugin-hotreload-routes.ts)
 *
 * Auto-generated route registration tests
 */

import { describe, it, expect } from '@jest/globals';

describe('Plugin Hotreload Routes', () => {
  it('should export a valid Fastify plugin function', async () => {
    const mod = await import('../plugin-hotreload-routes');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});
