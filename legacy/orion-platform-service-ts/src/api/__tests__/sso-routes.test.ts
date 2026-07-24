/**
 * Tests for Sso Routes (sso-routes.ts)
 *
 * Auto-generated route registration tests
 */

import { describe, it, expect } from '@jest/globals';

// Mock openid-client (ESM module that Jest cannot parse)
jest.mock('openid-client', () => ({
  discovery: jest.fn(),
  Configuration: class MockConfiguration {},
  buildAuthorizationUrl: jest.fn(),
  authorizationCodeGrant: jest.fn(),
  fetchUserInfo: jest.fn(),
}));

// Mock oauth4webapi (dependency of openid-client)
jest.mock('oauth4webapi', () => ({}));

describe('Sso Routes', () => {
  it('should export a valid Fastify plugin function', async () => {
    const mod = await import('../sso-routes');
    expect(mod.registerSsoRoutes).toBeDefined();
    expect(typeof mod.registerSsoRoutes).toBe('function');
  });
});
