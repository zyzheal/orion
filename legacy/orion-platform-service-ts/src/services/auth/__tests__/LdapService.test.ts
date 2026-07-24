/**
 * LdapService - Unit Tests
 *
 * Tests for LDAP authentication, connection management, and connection testing.
 *
 * Note: ldapjs is not installed and is stubbed in the source as `const ldap = {} as any`.
 * This means all real LDAP operations (connect, authenticate, search) will fail
 * because `ldap.createClient` is undefined. We test the service's defensive behavior
 * when LDAP operations fail.
 */

// Mock pino to suppress log output
// Must support .child() since createLogger uses rootLogger.child({module})
const mockChildFn = jest.fn().mockReturnValue({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});
jest.mock('pino', () => {
  return jest.fn(() => ({
    child: mockChildFn,
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }));
});

import { LdapService, LdapConfig } from '../LdapService';

describe('LdapService', () => {
  let service: LdapService;
  const enabledConfig: LdapConfig = {
    enabled: true,
    url: 'ldap://localhost:389',
    bindDn: 'cn=admin,dc=example,dc=com',
    bindPassword: 'password',
    baseDn: 'ou=users,dc=example,dc=com',
    userFilter: '(uid={username})',
    groupFilter: '(member={userdn})',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LdapService(enabledConfig);
  });

  // ==================== constructor ====================

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should accept TLS configuration', () => {
      const tlsService = new LdapService({
        ...enabledConfig,
        tls: { rejectUnauthorized: false },
      });
      expect(tlsService.isConnected()).toBe(false);
    });

    it('should accept custom user filter', () => {
      const customService = new LdapService({
        ...enabledConfig,
        userFilter: '(sAMAccountName={username})',
      });
      expect(customService.isConnected()).toBe(false);
    });

    it('should accept custom group filter', () => {
      const customService = new LdapService({
        ...enabledConfig,
        groupFilter: '(uniqueMember={userdn})',
      });
      expect(customService.isConnected()).toBe(false);
    });
  });

  // ==================== isConnected ====================

  describe('isConnected', () => {
    it('should return false initially', () => {
      expect(service.isConnected()).toBe(false);
    });
  });

  // ==================== connect ====================

  describe('connect', () => {
    it('should skip connection when LDAP is disabled', async () => {
      const disabledService = new LdapService({ ...enabledConfig, enabled: false });
      await disabledService.connect();
      expect(disabledService.isConnected()).toBe(false);
    });

    it('should skip connection when URL is missing', async () => {
      const noUrlService = new LdapService({ ...enabledConfig, url: '' });
      await noUrlService.connect();
      expect(noUrlService.isConnected()).toBe(false);
    });

    it('should skip connection when bindDn is missing', async () => {
      const noDnService = new LdapService({ ...enabledConfig, bindDn: '' });
      await noDnService.connect();
      expect(noDnService.isConnected()).toBe(false);
    });

    it('should skip connection when bindPassword is missing', async () => {
      const noPwService = new LdapService({ ...enabledConfig, bindPassword: '' });
      await noPwService.connect();
      expect(noPwService.isConnected()).toBe(false);
    });

    it('should handle connection failure gracefully', async () => {
      // ldap.createClient is undefined (stubbed), so connect will throw
      await expect(service.connect()).rejects.toThrow();
      expect(service.isConnected()).toBe(false);
    });
  });

  // ==================== authenticate ====================

  describe('authenticate', () => {
    it('should return null when not connected', async () => {
      const result = await service.authenticate('user1', 'pass1');
      expect(result).toBeNull();
    });

    it('should return null for empty username', async () => {
      const result = await service.authenticate('', 'pass1');
      expect(result).toBeNull();
    });

    it('should return null for empty password', async () => {
      const result = await service.authenticate('user1', '');
      expect(result).toBeNull();
    });
  });

  // ==================== getUserGroups ====================

  describe('getUserGroups', () => {
    it('should return empty array when not connected', async () => {
      const result = await service.getUserGroups('user1');
      expect(result).toEqual([]);
    });
  });

  // ==================== disconnect ====================

  describe('disconnect', () => {
    it('should handle disconnect when no client exists', async () => {
      await service.disconnect();
      expect(service.isConnected()).toBe(false);
    });
  });

  // ==================== testConnection ====================

  describe('testConnection', () => {
    it('should return failure when LDAP is disabled', async () => {
      const disabledService = new LdapService({ ...enabledConfig, enabled: false });
      const result = await disabledService.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('disabled');
    });

    it('should return failure when URL is missing', async () => {
      const noUrlService = new LdapService({ ...enabledConfig, url: '' });
      const result = await noUrlService.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('LDAP_URL');
    });

    it('should return failure when bindDn is missing', async () => {
      const noDnService = new LdapService({ ...enabledConfig, bindDn: '' });
      const result = await noDnService.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('LDAP_BIND_DN');
    });

    it('should return failure when bindPassword is missing', async () => {
      const noPwService = new LdapService({ ...enabledConfig, bindPassword: '' });
      const result = await noPwService.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('LDAP_BIND_PASSWORD');
    });

    it('should return failure when baseDn is missing', async () => {
      const noBaseService = new LdapService({ ...enabledConfig, baseDn: '' });
      const result = await noBaseService.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('LDAP_BASE_DN');
    });

    it('should return failure when connection fails', async () => {
      // ldap.createClient is undefined, so testConnection will fail
      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
    });
  });

  // ==================== export singleton ====================

  describe('singleton instance', () => {
    it('should export ldapService singleton', () => {
      const { ldapService } = require('../LdapService');
      expect(ldapService).toBeDefined();
      expect(ldapService.isConnected()).toBe(false);
    });
  });
});
