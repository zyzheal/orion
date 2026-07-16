/**
 * ConfigGitOpsService 测试
 *
 * 测试 GitOps 配置同步服务：初始化、同步、推送、状态查询、历史、回滚。
 * Mock simple-git 和 fs/promises 模拟 Git 和文件系统操作。
 */

// ==================== Mocks ====================

const mockGitInstance = {
  checkIsRepo: jest.fn().mockResolvedValue(true),
  clone: jest.fn().mockResolvedValue(undefined),
  checkout: jest.fn().mockResolvedValue(undefined),
  checkoutLocalBranch: jest.fn().mockResolvedValue(undefined),
  pull: jest.fn().mockResolvedValue(undefined),
  push: jest.fn().mockResolvedValue(undefined),
  add: jest.fn().mockResolvedValue(undefined),
  commit: jest.fn().mockResolvedValue(undefined),
  log: jest.fn().mockResolvedValue({
    latest: { hash: 'abc123' },
    all: [{ hash: 'abc123', date: '2026-01-01', message: 'test', author_name: 'Test' }],
  }),
  status: jest.fn().mockResolvedValue({
    current: 'main',
    files: [],
  }),
  fetch: jest.fn().mockResolvedValue(undefined),
  env: jest.fn().mockReturnThis(),
};

jest.mock('simple-git', () => {
  return jest.fn(() => mockGitInstance);
});

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
  readdir: jest.fn().mockResolvedValue([
    { name: 'config.yaml', isFile: () => true },
    { name: 'deploy.json', isFile: () => true },
    { name: 'subdir', isFile: () => false },
  ]),
  readFile: jest.fn().mockImplementation(async (path: string) => {
    if (path.endsWith('.yaml')) {
      return 'pipeline:\n  timeout: 300\n  retries: 3';
    }
    if (path.endsWith('.json')) {
      return '{"strategy":"rolling"}';
    }
    return '';
  }),
  writeFile: jest.fn().mockResolvedValue(undefined),
  rm: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('js-yaml', () => ({
  load: jest.fn().mockReturnValue({ pipeline: { timeout: 300, retries: 3 } }),
  dump: jest.fn().mockReturnValue('pipeline:\n  timeout: 300\n'),
}));

jest.mock('pino', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }));
});

// Set env vars for tests
process.env.GITOPS_ENABLED = 'true';
process.env.GITOPS_REPO_URL = 'https://github.com/test/config.git';
process.env.GITOPS_BRANCH = 'main';
process.env.GITOPS_CONFIG_PATH = 'configs';
process.env.GITOPS_AUTH_TYPE = 'https';
process.env.GITOPS_TOKEN = 'test-token';
process.env.GITOPS_SYNC_INTERVAL = '60000';

import { ConfigGitOpsService } from '../ConfigGitOpsService';

// ==================== Tests ====================

describe('ConfigGitOpsService', () => {
  let service: ConfigGitOpsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConfigGitOpsService('/tmp/test-gitops');
  });

  // ---- initialize ----

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await service.initialize();

      expect(mockGitInstance.checkIsRepo).toHaveBeenCalled();
    });

    it('should skip initialization when disabled', async () => {
      const origEnabled = process.env.GITOPS_ENABLED;
      process.env.GITOPS_ENABLED = 'false';

      const disabledService = new ConfigGitOpsService('/tmp/test-gitops');
      await disabledService.initialize();

      expect(mockGitInstance.checkIsRepo).not.toHaveBeenCalled();

      process.env.GITOPS_ENABLED = origEnabled;
    });

    it('should handle clone when not a repo', async () => {
      mockGitInstance.checkIsRepo.mockResolvedValueOnce(false);

      await service.initialize();

      expect(mockGitInstance.clone).toHaveBeenCalled();
    });

    it('should create local branch when checkout fails', async () => {
      mockGitInstance.checkout.mockRejectedValueOnce(new Error('branch not found'));

      await service.initialize();

      expect(mockGitInstance.checkoutLocalBranch).toHaveBeenCalled();
    });

    it('should throw on initialization failure (mkdir error)', async () => {
      const fs = require('fs/promises');
      fs.mkdir.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(service.initialize()).rejects.toThrow('Permission denied');
    });
  });

  // ---- setDbApplyFn ----

  describe('setDbApplyFn', () => {
    it('should set database apply function', () => {
      const fn = jest.fn();
      expect(() => service.setDbApplyFn(fn)).not.toThrow();
    });
  });

  // ---- sync ----

  describe('sync', () => {
    it('should throw when not initialized', async () => {
      const uninitializedService = new ConfigGitOpsService('/tmp/test');
      await expect(uninitializedService.sync()).rejects.toThrow('GitOps not initialized');
    });

    it('should sync configs successfully', async () => {
      await service.initialize();
      const result = await service.sync();

      expect(result).toHaveProperty('updated');
      expect(result).toHaveProperty('added');
      expect(result).toHaveProperty('deleted');
      expect(result).toHaveProperty('errors');
    });

    it('should call dbApplyFn when set', async () => {
      const applyFn = jest.fn().mockResolvedValue(undefined);
      service.setDbApplyFn(applyFn);

      await service.initialize();
      await service.sync();

      expect(applyFn).toHaveBeenCalled();
    });

    it('should handle sync errors', async () => {
      await service.initialize();

      // Mock pull to fail AFTER initialization
      mockGitInstance.pull.mockRejectedValueOnce(new Error('Pull failed'));

      const result = await service.sync();

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle missing config directory', async () => {
      await service.initialize();

      // Mock access to fail AFTER initialization
      const fs = require('fs/promises');
      fs.access.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await service.sync();

      expect(result.updated).toBe(0);
    });
  });

  // ---- push ----

  describe('push', () => {
    it('should throw when not initialized', async () => {
      const uninitializedService = new ConfigGitOpsService('/tmp/test');
      const result = await uninitializedService.push({ key: 'value' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('GitOps not initialized');
    });

    it('should push configs successfully', async () => {
      await service.initialize();
      const result = await service.push({ 'app-config': { timeout: 300 } }, 'Update config');

      expect(result.success).toBe(true);
      expect(result.commitSha).toBeDefined();
    });

    it('should push with custom author', async () => {
      await service.initialize();
      const result = await service.push(
        { key: 'value' },
        'Custom author commit',
        { name: 'Dev', email: 'dev@test.com' }
      );

      expect(result.success).toBe(true);
    });

    it('should handle push failure', async () => {
      mockGitInstance.push.mockRejectedValueOnce(new Error('Push denied'));

      await service.initialize();
      const result = await service.push({ key: 'value' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Push denied');
    });

    it('should handle string content', async () => {
      await service.initialize();
      const result = await service.push({ 'raw-config': 'key=value' });

      expect(result.success).toBe(true);
    });
  });

  // ---- getStatus ----

  describe('getStatus', () => {
    it('should return status when not initialized', async () => {
      const uninitializedService = new ConfigGitOpsService('/tmp/test');
      const status = await uninitializedService.getStatus();

      expect(status.branch).toBeDefined();
      expect(status.commitsBehind).toBe(0);
      expect(status.hasChanges).toBe(false);
      expect(status.lastSync).toBeNull();
    });

    it('should return status when initialized', async () => {
      await service.initialize();
      const status = await service.getStatus();

      expect(status.branch).toBe('main');
      expect(typeof status.commitsBehind).toBe('number');
      expect(typeof status.hasChanges).toBe('boolean');
    });

    it('should handle status errors gracefully', async () => {
      mockGitInstance.status.mockRejectedValueOnce(new Error('Status error'));

      await service.initialize();
      const status = await service.getStatus();

      expect(status.branch).toBeDefined();
      expect(status.commitsBehind).toBe(0);
    });
  });

  // ---- getHistory ----

  describe('getHistory', () => {
    it('should return empty array when not initialized', async () => {
      const uninitializedService = new ConfigGitOpsService('/tmp/test');
      const history = await uninitializedService.getHistory();

      expect(history).toEqual([]);
    });

    it('should return commit history', async () => {
      await service.initialize();
      const history = await service.getHistory(5);

      expect(Array.isArray(history)).toBe(true);
    });

    it('should handle history errors gracefully', async () => {
      mockGitInstance.log.mockRejectedValueOnce(new Error('Log error'));

      await service.initialize();
      const history = await service.getHistory();

      expect(history).toEqual([]);
    });
  });

  // ---- rollback ----

  describe('rollback', () => {
    it('should throw when not initialized', async () => {
      const uninitializedService = new ConfigGitOpsService('/tmp/test');
      const result = await uninitializedService.rollback('abc123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('GitOps not initialized');
    });

    it('should rollback to commit', async () => {
      await service.initialize();
      const result = await service.rollback('abc123');

      expect(result.success).toBe(true);
      expect(mockGitInstance.checkout).toHaveBeenCalled();
    });

    it('should handle rollback failure', async () => {
      await service.initialize();

      // Mock checkout to fail AFTER initialization
      mockGitInstance.checkout.mockRejectedValueOnce(new Error('Checkout failed'));

      const result = await service.rollback('abc123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Checkout failed');
    });
  });

  // ---- stopPeriodicSync ----

  describe('stopPeriodicSync', () => {
    it('should stop periodic sync', () => {
      expect(() => service.stopPeriodicSync()).not.toThrow();
    });
  });

  // ---- close ----

  describe('close', () => {
    it('should close service and cleanup', async () => {
      await service.initialize();
      await expect(service.close()).resolves.toBeUndefined();
    });

    it('should handle cleanup errors gracefully', async () => {
      const fs = require('fs/promises');
      fs.rm.mockRejectedValueOnce(new Error('Permission denied'));

      await service.initialize();
      await expect(service.close()).resolves.toBeUndefined();
    });
  });
});
