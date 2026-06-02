/**
 * SsoService - Unit Tests
 *
 * Tests for SSO/OIDC integration: initialization, authorization URL generation,
 * callback handling, configuration management, and state store operations.
 */

import { SsoService, SsoConfig, SsoStateStore } from '../SsoService';
import { OrionError, ErrorCode } from '../../../errors';

// Mock openid-client
jest.mock('openid-client', () => ({
  discovery: jest.fn(),
  buildAuthorizationUrl: jest.fn(),
  authorizationCodeGrant: jest.fn(),
  randomNonce: jest.fn().mockReturnValue('test-nonce'),
  randomState: jest.fn().mockReturnValue('test-state'),
  ClientSecretPost: jest.fn().mockReturnValue(() => 'client-auth'),
}));

// Mock SsoStateRepository
jest.mock('../../../repositories/SsoStateRepository', () => ({
  SsoStateRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
    findByState: jest.fn(),
    deleteByState: jest.fn(),
  })),
}));

// Mock pino
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  });
});

import {
  discovery,
  buildAuthorizationUrl,
  authorizationCodeGrant,
} from 'openid-client';

const mockDiscovery = discovery as jest.MockedFunction<typeof discovery>;
const mockBuildAuthUrl = buildAuthorizationUrl as jest.MockedFunction<typeof buildAuthorizationUrl>;
const mockAuthCodeGrant = authorizationCodeGrant as jest.MockedFunction<typeof authorizationCodeGrant>;

describe('SsoService', () => {
  let service: SsoService;
  let mockStateStore: SsoStateStore;

  const validConfig: SsoConfig = {
    issuerUrl: 'https://accounts.example.com',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'https://app.example.com/callback',
    scopes: ['openid', 'email', 'profile'],
    enabled: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStateStore = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(undefined),
    };
    service = new SsoService(mockStateStore);
  });

  // ==================== initialize ====================

  describe('initialize', () => {
    it('should initialize SSO with valid config', async () => {
      const mockOidcConfig = { issuer: { href: 'https://accounts.example.com' } };
      mockDiscovery.mockResolvedValue(mockOidcConfig as any);

      await service.initialize(validConfig);

      expect(mockDiscovery).toHaveBeenCalled();
      expect(service.isConfigured()).toBe(true);
    });

    it('should skip initialization when disabled', async () => {
      await service.initialize({ ...validConfig, enabled: false });

      expect(mockDiscovery).not.toHaveBeenCalled();
      expect(service.isConfigured()).toBe(false);
    });

    it('should skip initialization when issuerUrl is missing', async () => {
      await service.initialize({ ...validConfig, issuerUrl: '' });

      expect(mockDiscovery).not.toHaveBeenCalled();
    });

    it('should skip initialization when clientId is missing', async () => {
      await service.initialize({ ...validConfig, clientId: '' });

      expect(mockDiscovery).not.toHaveBeenCalled();
    });

    it('should skip initialization when clientSecret is missing', async () => {
      await service.initialize({ ...validConfig, clientSecret: '' });

      expect(mockDiscovery).not.toHaveBeenCalled();
    });

    it('should handle discovery failure gracefully', async () => {
      mockDiscovery.mockRejectedValue(new Error('Discovery failed'));

      // Should not throw
      await service.initialize(validConfig);

      expect(service.isConfigured()).toBe(false);
    });
  });

  // ==================== isConfigured ====================

  describe('isConfigured', () => {
    it('should return false before initialization', () => {
      expect(service.isConfigured()).toBe(false);
    });

    it('should return false after failed initialization', async () => {
      mockDiscovery.mockRejectedValue(new Error('fail'));
      await service.initialize(validConfig);

      expect(service.isConfigured()).toBe(false);
    });
  });

  // ==================== getAuthorizationUrl ====================

  describe('getAuthorizationUrl', () => {
    beforeEach(async () => {
      mockDiscovery.mockResolvedValue({} as any);
      await service.initialize(validConfig);
    });

    it('should return authorization URL and state key', async () => {
      const mockUrl = new URL('https://accounts.example.com/authorize?client_id=test');
      mockBuildAuthUrl.mockReturnValue(mockUrl);

      const result = await service.getAuthorizationUrl();

      expect(result.url).toBeDefined();
      expect(result.stateKey).toBe('test-state');
      expect(mockStateStore.set).toHaveBeenCalledWith(
        'sso:state:test-state',
        expect.any(String),
        600
      );
    });

    it('should store nonce and state in state store', async () => {
      const mockUrl = new URL('https://accounts.example.com/authorize');
      mockBuildAuthUrl.mockReturnValue(mockUrl);

      await service.getAuthorizationUrl();

      expect(mockStateStore.set).toHaveBeenCalledWith(
        'sso:state:test-state',
        expect.stringContaining('test-nonce'),
        600
      );
    });

    it('should throw when SSO is not configured', async () => {
      const unconfiguredService = new SsoService(mockStateStore);

      await expect(unconfiguredService.getAuthorizationUrl()).rejects.toThrow(OrionError);
    });

    it('should use default scopes when not provided', async () => {
      const configNoScopes = { ...validConfig, scopes: undefined };
      mockDiscovery.mockResolvedValue({} as any);

      const serviceNoScopes = new SsoService(mockStateStore);
      await serviceNoScopes.initialize(configNoScopes);

      const mockUrl = new URL('https://auth.example.com');
      mockBuildAuthUrl.mockReturnValue(mockUrl);

      await serviceNoScopes.getAuthorizationUrl();

      expect(mockBuildAuthUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          scope: 'openid email profile',
        })
      );
    });
  });

  // ==================== handleCallback ====================

  describe('handleCallback', () => {
    beforeEach(async () => {
      mockDiscovery.mockResolvedValue({} as any);
      await service.initialize(validConfig);
    });

    it('should exchange code for tokens and return user profile', async () => {
      const storedState = JSON.stringify({ nonce: 'test-nonce', state: 'test-state' });
      (mockStateStore.get as jest.Mock).mockResolvedValue(storedState);

      mockAuthCodeGrant.mockResolvedValue({
        claims: () => ({
          sub: 'user-123',
          email: 'user@example.com',
          name: 'Test User',
          groups: ['admin'],
          roles: ['developer'],
        }),
      } as any);

      const callbackUrl = new URL('https://app.example.com/callback?code=auth-code&state=test-state');
      const profile = await service.handleCallback(callbackUrl, 'test-state');

      expect(profile.sub).toBe('user-123');
      expect(profile.email).toBe('user@example.com');
      expect(profile.name).toBe('Test User');
      expect(profile.groups).toEqual(['admin']);
      expect(profile.roles).toEqual(['developer']);
    });

    it('should clean up state after successful callback', async () => {
      const storedState = JSON.stringify({ nonce: 'test-nonce', state: 'test-state' });
      (mockStateStore.get as jest.Mock).mockResolvedValue(storedState);

      mockAuthCodeGrant.mockResolvedValue({
        claims: () => ({ sub: 'user-123', email: 'user@example.com', name: 'User' }),
      } as any);

      const callbackUrl = new URL('https://app.example.com/callback?code=code&state=test-state');
      await service.handleCallback(callbackUrl, 'test-state');

      expect(mockStateStore.del).toHaveBeenCalledWith('sso:state:test-state');
    });

    it('should throw when no matching state found', async () => {
      (mockStateStore.get as jest.Mock).mockResolvedValue(null);

      const callbackUrl = new URL('https://app.example.com/callback?code=code&state=bad-state');

      await expect(
        service.handleCallback(callbackUrl, 'bad-state')
      ).rejects.toThrow('SSO_STATE_MISMATCH');
    });

    it('should throw when SSO is not configured', async () => {
      const unconfiguredService = new SsoService(mockStateStore);
      const callbackUrl = new URL('https://app.example.com/callback?code=code&state=state');

      await expect(
        unconfiguredService.handleCallback(callbackUrl, 'state')
      ).rejects.toThrow(OrionError);
    });

    it('should throw when no claims in token', async () => {
      const storedState = JSON.stringify({ nonce: 'nonce', state: 'state' });
      (mockStateStore.get as jest.Mock).mockResolvedValue(storedState);

      mockAuthCodeGrant.mockResolvedValue({
        claims: () => null,
      } as any);

      const callbackUrl = new URL('https://app.example.com/callback?code=code&state=state');

      await expect(
        service.handleCallback(callbackUrl, 'state')
      ).rejects.toThrow();
    });

    it('should throw when claims has no sub', async () => {
      const storedState = JSON.stringify({ nonce: 'nonce', state: 'state' });
      (mockStateStore.get as jest.Mock).mockResolvedValue(storedState);

      mockAuthCodeGrant.mockResolvedValue({
        claims: () => ({ email: 'user@example.com' }),
      } as any);

      const callbackUrl = new URL('https://app.example.com/callback?code=code&state=state');

      await expect(
        service.handleCallback(callbackUrl, 'state')
      ).rejects.toThrow('SSO_NO_CLAIMS');
    });

    it('should use sub as email fallback', async () => {
      const storedState = JSON.stringify({ nonce: 'nonce', state: 'state' });
      (mockStateStore.get as jest.Mock).mockResolvedValue(storedState);

      mockAuthCodeGrant.mockResolvedValue({
        claims: () => ({ sub: 'user-123' }),
      } as any);

      const callbackUrl = new URL('https://app.example.com/callback?code=code&state=state');
      const profile = await service.handleCallback(callbackUrl, 'state');

      expect(profile.email).toBe('user-123');
      expect(profile.name).toBe('user-123');
    });
  });

  // ==================== getLoginUrl ====================

  describe('getLoginUrl', () => {
    it('should return login URL string', async () => {
      mockDiscovery.mockResolvedValue({} as any);
      await service.initialize(validConfig);

      const mockUrl = new URL('https://accounts.example.com/authorize');
      mockBuildAuthUrl.mockReturnValue(mockUrl);

      const url = await service.getLoginUrl();

      expect(typeof url).toBe('string');
    });
  });

  // ==================== getConfig ====================

  describe('getConfig', () => {
    it('should return safe config without secret', async () => {
      mockDiscovery.mockResolvedValue({} as any);
      await service.initialize(validConfig);

      const config = service.getConfig();

      expect(config).toBeDefined();
      expect(config!.clientId).toBe('test-client-id');
      expect(config!.issuerUrl).toBe('https://accounts.example.com');
      expect((config as any).clientSecret).toBeUndefined();
    });

    it('should return null before initialization', () => {
      expect(service.getConfig()).toBeNull();
    });
  });

  // ==================== state store variants ====================

  describe('state store', () => {
    it('should use PostgreSQL state store when db is provided', () => {
      const mockDb = { query: jest.fn() };
      const pgService = new SsoService(undefined, mockDb);

      // Should not throw
      expect(pgService).toBeDefined();
    });

    it('should use in-memory state store when no store or db provided', () => {
      const memService = new SsoService();

      // Should not throw
      expect(memService).toBeDefined();
    });
  });
});
