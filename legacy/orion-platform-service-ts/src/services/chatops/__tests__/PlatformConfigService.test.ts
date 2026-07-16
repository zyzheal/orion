/**
 * PlatformConfigService 单元测试
 *
 * 测试 IM 平台 Webhook 配置管理：获取、更新、批量更新、加密。
 */

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });
});

// Mock ChatOpsPlatformConfigRepository
const mockRepoInstance = {
  findByUserId: jest.fn().mockResolvedValue([]),
  upsert: jest.fn().mockResolvedValue({}),
};

jest.mock('../../../repositories/ChatOpsRepository', () => ({
  ChatOpsPlatformConfigRepository: jest.fn().mockImplementation(() => mockRepoInstance),
}));

import { PlatformConfigService } from '../PlatformConfigService';

describe('PlatformConfigService', () => {
  let service: PlatformConfigService;
  let mockPool: any;

  const sampleEntity = {
    platform: 'dingtalk',
    enabled: true,
    webhook: 'ENC:aHR0cHM6Ly9vYXBpLmRpbmd0YWxrLmNvbS9ob29r',  // base64 of https://oapi.dingtalk.com/hook
    token: 'ENC:dGVzdC10b2tlbg==',  // base64 of test-token
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepoInstance.findByUserId.mockResolvedValue([]);
    mockRepoInstance.upsert.mockResolvedValue({});

    mockPool = {
      query: jest.fn(),
      transaction: jest.fn(),
    };
    service = new PlatformConfigService(mockPool);
  });

  describe('constructor', () => {
    it('should create service with pool', () => {
      expect(service).toBeDefined();
    });
  });

  describe('getByUserId', () => {
    it('should return decrypted configs', async () => {
      mockRepoInstance.findByUserId.mockResolvedValue([sampleEntity]);

      const result = await service.getByUserId('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].platform).toBe('dingtalk');
      expect(result[0].enabled).toBe(true);
      expect(result[0].webhook).toBe('https://oapi.dingtalk.com/hook');
      expect(result[0].token).toBe('test-token');
    });

    it('should return empty array when no configs', async () => {
      mockRepoInstance.findByUserId.mockResolvedValue([]);

      const result = await service.getByUserId('user-1');

      expect(result).toHaveLength(0);
    });

    it('should handle non-encrypted values', async () => {
      mockRepoInstance.findByUserId.mockResolvedValue([{
        platform: 'slack',
        enabled: false,
        webhook: 'https://hooks.slack.com/plain',
        token: 'plain-token',
      }]);

      const result = await service.getByUserId('user-1');

      expect(result[0].webhook).toBe('https://hooks.slack.com/plain');
      expect(result[0].token).toBe('plain-token');
    });
  });

  describe('update', () => {
    it('should encrypt sensitive fields before storing', async () => {
      mockRepoInstance.upsert.mockResolvedValue({
        platform: 'dingtalk',
        enabled: true,
        webhook: 'ENC:aHR0cHM6Ly9vYXBpLmRpbmd0YWxrLmNvbS9ob29r',
        token: 'ENC:dGVzdC10b2tlbg==',
      });

      await service.update('user-1', {
        platform: 'dingtalk',
        enabled: true,
        webhook: 'https://oapi.dingtalk.com/hook',
        token: 'test-token',
      });

      expect(mockRepoInstance.upsert).toHaveBeenCalledWith({
        userId: 'user-1',
        platform: 'dingtalk',
        enabled: true,
        webhook: 'ENC:aHR0cHM6Ly9vYXBpLmRpbmd0YWxrLmNvbS9ob29r',
        token: 'ENC:dGVzdC10b2tlbg==',
      });
    });

    it('should not double-encrypt already encrypted values from DB', async () => {
      // Encrypted values from DB should be returned as-is (decrypted) via getByUserId
      mockRepoInstance.findByUserId.mockResolvedValue([sampleEntity]);

      const result = await service.getByUserId('user-1');

      // Values should be decrypted, not double-encrypted
      expect(result[0].webhook).toBe('https://oapi.dingtalk.com/hook');
      expect(result[0].token).toBe('test-token');
    });

    it('should throw on invalid webhook URL', async () => {
      await expect(service.update('user-1', {
        platform: 'dingtalk',
        enabled: true,
        webhook: 'not-a-valid-url',
        token: 'token',
      })).rejects.toThrow('Invalid webhook URL');
    });

    it('should accept empty webhook', async () => {
      mockRepoInstance.upsert.mockResolvedValue({
        platform: 'dingtalk',
        enabled: true,
        webhook: '',
        token: '',
      });

      await service.update('user-1', {
        platform: 'dingtalk',
        enabled: true,
        webhook: '',
        token: '',
      });

      expect(mockRepoInstance.upsert).toHaveBeenCalled();
    });

    it('should accept platform-specific domains', async () => {
      mockRepoInstance.upsert.mockResolvedValue(sampleEntity);

      await service.update('user-1', {
        platform: 'dingtalk',
        enabled: true,
        webhook: 'https://oapi.dingtalk.com/robot/send',
        token: 'token',
      });

      expect(mockRepoInstance.upsert).toHaveBeenCalled();
    });
  });

  describe('batchUpdate', () => {
    it('should update multiple configs in transaction', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({
          rows: [{
            platform: 'dingtalk',
            enabled: true,
            webhook: 'ENC:aHR0cHM6Ly9vYXBpLmRpbmd0YWxrLmNvbS9ob29r',
            token: 'ENC:dGVzdA==',
          }],
        }),
      };
      mockPool.transaction.mockImplementation(async (fn: Function) => fn(mockClient));

      const result = await service.batchUpdate('user-1', [
        {
          platform: 'dingtalk',
          enabled: true,
          webhook: 'https://oapi.dingtalk.com/hook',
          token: 'test',
        },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].platform).toBe('dingtalk');
      expect(result[0].webhook).toBe('https://oapi.dingtalk.com/hook');
      expect(result[0].token).toBe('test');
    });

    it('should throw on invalid webhook in batch', async () => {
      const mockClient = { query: jest.fn() };
      mockPool.transaction.mockImplementation(async (fn: Function) => fn(mockClient));

      await expect(service.batchUpdate('user-1', [
        {
          platform: 'dingtalk',
          enabled: true,
          webhook: 'invalid-url',
          token: 'token',
        },
      ])).rejects.toThrow('Invalid webhook URL');
    });

    it('should handle empty batch', async () => {
      mockPool.transaction.mockImplementation(async (fn: Function) => fn({ query: jest.fn() }));

      const result = await service.batchUpdate('user-1', []);

      expect(result).toHaveLength(0);
    });
  });
});
