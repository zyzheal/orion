/**
 * WechatWorkService - Unit Tests
 *
 * Tests for WeChat Work SSO: authorization URL generation, token management,
 * user info retrieval, callback handling, config exposure, and connection testing.
 */

import { WechatWorkService, WechatWorkConfig } from '../WechatWorkService';
import { safeFetch } from '../../../utils/safeFetch';
import { OrionError } from '../../../errors';

jest.mock('../../../utils/safeFetch', () => ({
  safeFetch: jest.fn(),
}));

const mockSafeFetch = safeFetch as jest.MockedFunction<typeof safeFetch>;

// Mock global fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('WechatWorkService', () => {
  let service: WechatWorkService;
  const enabledConfig: WechatWorkConfig = {
    corpId: 'test-corp-id',
    agentId: 'test-agent-id',
    corpSecret: 'test-corp-secret',
    enabled: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    service = new WechatWorkService({ ...enabledConfig });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ==================== isEnabled ====================

  describe('isEnabled', () => {
    it('should return true when properly configured', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('should return false when disabled', () => {
      const disabled = new WechatWorkService({ ...enabledConfig, enabled: false });
      expect(disabled.isEnabled()).toBe(false);
    });

    it('should return false when corpId is empty', () => {
      const noCorp = new WechatWorkService({ ...enabledConfig, corpId: '' });
      expect(noCorp.isEnabled()).toBe(false);
    });

    it('should return false when corpSecret is empty', () => {
      const noSecret = new WechatWorkService({ ...enabledConfig, corpSecret: '' });
      expect(noSecret.isEnabled()).toBe(false);
    });
  });

  // ==================== getAuthorizationUrl ====================

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL with correct params', () => {
      const url = service.getAuthorizationUrl('https://app.example.com/callback', 'state123');

      expect(url).toContain('https://open.work.weixin.qq.com/wwopen/sso/qrConnect');
      expect(url).toContain('appid=test-corp-id');
      expect(url).toContain('agentid=test-agent-id');
      expect(url).toContain('state=state123');
      expect(url).toContain('redirect_uri=');
    });

    it('should throw when SSO is disabled', () => {
      const disabled = new WechatWorkService({ ...enabledConfig, enabled: false });

      expect(() => {
        disabled.getAuthorizationUrl('https://callback.example.com', 'state');
      }).toThrow(OrionError);
    });
  });

  // ==================== generateState ====================

  describe('generateState', () => {
    it('should generate a hex string', () => {
      const state = service.generateState();

      expect(typeof state).toBe('string');
      expect(state).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate 32-character hex string (16 bytes)', () => {
      const state = service.generateState();

      expect(state).toHaveLength(32);
    });

    it('should generate unique values', () => {
      const state1 = service.generateState();
      const state2 = service.generateState();

      expect(state1).not.toBe(state2);
    });
  });

  // ==================== getAccessToken (via getUserInfo) ====================

  describe('getAccessToken', () => {
    it('should fetch and cache access token', async () => {
      mockSafeFetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            access_token: 'test-token',
            expires_in: 7200,
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            UserId: 'user1',
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            userid: 'user1',
            name: 'Test User',
          }),
        });

      await service.getUserInfo('auth-code');

      // First call should fetch token
      expect(mockSafeFetch).toHaveBeenCalledWith(
        expect.stringContaining('gettoken')
      );
    });

    it('should reuse cached token', async () => {
      mockSafeFetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            access_token: 'cached-token',
            expires_in: 7200,
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            UserId: 'user1',
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            userid: 'user1',
            name: 'Test User',
          }),
        });

      // First call
      await service.getUserInfo('code1');

      // Reset to verify no new token fetch
      mockSafeFetch.mockClear();
      mockSafeFetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            UserId: 'user2',
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            userid: 'user2',
            name: 'User 2',
          }),
        });

      // Second call should reuse token
      await service.getUserInfo('code2');

      // Should NOT call gettoken again
      const tokenCalls = mockSafeFetch.mock.calls.filter(
        (call: any[]) => call[0].includes('gettoken')
      );
      expect(tokenCalls).toHaveLength(0);
    });

    it('should throw on token fetch error', async () => {
      mockSafeFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          errcode: 40013,
          errmsg: 'invalid corpid',
        }),
      });

      await expect(service.getUserInfo('code')).rejects.toThrow();
    });

    it('should throw when disabled', async () => {
      const disabled = new WechatWorkService({ ...enabledConfig, enabled: false });

      await expect(disabled.getUserInfo('code')).rejects.toThrow(OrionError);
    });
  });

  // ==================== getUserInfo ====================

  describe('getUserInfo', () => {
    it('should return user profile on success', async () => {
      mockSafeFetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            access_token: 'token',
            expires_in: 7200,
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            UserId: 'zhangsan',
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            userid: 'zhangsan',
            name: 'Zhang San',
            email: 'zhang@example.com',
            mobile: '13800138000',
            departments: [{ id: 1, name: 'Engineering' }],
            position: 'Engineer',
            avatar: 'https://example.com/avatar.jpg',
          }),
        });

      const profile = await service.getUserInfo('auth-code');

      expect(profile.userid).toBe('zhangsan');
      expect(profile.name).toBe('Zhang San');
      expect(profile.email).toBe('zhang@example.com');
      expect(profile.mobile).toBe('13800138000');
      expect(profile.department).toEqual([1]);
      expect(profile.position).toBe('Engineer');
      expect(profile.avatar).toBe('https://example.com/avatar.jpg');
    });

    it('should throw when user ID not found in response', async () => {
      mockSafeFetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            access_token: 'token',
            expires_in: 7200,
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            // No UserId or OpenId
          }),
        });

      await expect(service.getUserInfo('code')).rejects.toThrow('WECHAT_NO_USERID');
    });

    it('should throw on user info API error', async () => {
      mockSafeFetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            access_token: 'token',
            expires_in: 7200,
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 40003,
            errmsg: 'invalid code',
          }),
        });

      await expect(service.getUserInfo('bad-code')).rejects.toThrow();
    });

    it('should throw when user detail fetch fails', async () => {
      mockSafeFetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            access_token: 'token',
            expires_in: 7200,
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            UserId: 'user1',
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 60011,
            errmsg: 'user not found',
          }),
        });

      await expect(service.getUserInfo('code')).rejects.toThrow('WECHAT_USERDETAIL_ERROR');
    });

    it('should use OpenId when UserId is not present', async () => {
      mockSafeFetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            access_token: 'token',
            expires_in: 7200,
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            OpenId: 'open-id-123',
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            userid: 'open-id-123',
            name: 'Open User',
          }),
        });

      const profile = await service.getUserInfo('code');
      expect(profile.userid).toBe('open-id-123');
    });
  });

  // ==================== handleCallback ====================

  describe('handleCallback', () => {
    it('should return local user mapping', async () => {
      mockSafeFetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            access_token: 'token',
            expires_in: 7200,
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            UserId: 'zhangsan',
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            userid: 'zhangsan',
            name: 'Zhang San',
            email: 'zhang@example.com',
          }),
        });

      const result = await service.handleCallback('auth-code');

      expect(result.userId).toBe('wechat_zhangsan');
      expect(result.username).toBe('zhangsan');
      expect(result.email).toBe('zhang@example.com');
      expect(result.name).toBe('Zhang San');
      expect(result.roles).toEqual(['user']);
    });

    it('should use fallback email when not provided', async () => {
      mockSafeFetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            access_token: 'token',
            expires_in: 7200,
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            UserId: 'user1',
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            userid: 'user1',
            name: 'User One',
          }),
        });

      const result = await service.handleCallback('code');

      expect(result.email).toBe('user1@wechat.work');
    });
  });

  // ==================== getSafeConfig ====================

  describe('getSafeConfig', () => {
    it('should return config without secret', () => {
      const config = service.getSafeConfig();

      expect(config).toBeDefined();
      expect(config!.corpId).toBe('test-corp-id');
      expect(config!.agentId).toBe('test-agent-id');
      expect(config!.enabled).toBe(true);
      // Ensure no secret is exposed
      expect((config as any).corpSecret).toBeUndefined();
    });

    it('should return null when not enabled', () => {
      const disabled = new WechatWorkService({ ...enabledConfig, enabled: false });
      expect(disabled.getSafeConfig()).toBeNull();
    });
  });

  // ==================== testConnection ====================

  describe('testConnection', () => {
    it('should return failure when disabled', async () => {
      const disabled = new WechatWorkService({ ...enabledConfig, enabled: false });
      const result = await disabled.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('未启用');
    });

    it('should return success when token fetch succeeds', async () => {
      mockSafeFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          errcode: 0,
          errmsg: 'ok',
          access_token: 'token',
          expires_in: 7200,
        }),
      });

      const result = await service.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain('成功');
    });

    it('should return failure when token fetch fails', async () => {
      mockSafeFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          errcode: 40013,
          errmsg: 'invalid corpid',
        }),
      });

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
    });
  });

  // ==================== token caching ====================

  describe('token caching', () => {
    it('should refresh token when cache expires', async () => {
      // First token fetch
      mockSafeFetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            access_token: 'token-1',
            expires_in: 7200,
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            UserId: 'u1',
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            userid: 'u1',
            name: 'User 1',
          }),
        });

      await service.getUserInfo('code1');

      // Advance time past the cache expiry (expires_in - 5min buffer)
      jest.advanceTimersByTime(7200 * 1000);

      mockSafeFetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            access_token: 'token-2',
            expires_in: 7200,
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            UserId: 'u2',
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            errcode: 0,
            errmsg: 'ok',
            userid: 'u2',
            name: 'User 2',
          }),
        });

      await service.getUserInfo('code2');

      // Should have fetched token twice
      const tokenCalls = mockSafeFetch.mock.calls.filter(
        (call: any[]) => call[0].includes('gettoken')
      );
      expect(tokenCalls).toHaveLength(2);
    });
  });
});
