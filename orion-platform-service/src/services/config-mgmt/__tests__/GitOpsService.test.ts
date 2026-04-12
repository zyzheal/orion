/**
 * GitOpsService Unit Tests
 *
 * Tests for Git sync, drift detection, auto-sync, and sync status tracking.
 */

import { GitOpsService, MockGitClient } from '../GitOpsService';
import { ConfigService } from '../ConfigService';
import { IEventPublisher, CreateGitOpsInput } from '../../types';

describe('GitOpsService', () => {
  let configService: ConfigService;
  let gitOpsService: GitOpsService;
  let mockGitClient: MockGitClient;
  let mockEventPublisher: jest.Mocked<IEventPublisher>;

  beforeEach(() => {
    configService = new ConfigService();
    mockGitClient = new MockGitClient();
    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue('event-id'),
    };
    gitOpsService = new GitOpsService({
      configService,
      eventPublisher: mockEventPublisher,
      gitClient: mockGitClient,
    });
  });

  afterEach(() => {
    // Clear any sync timers
  });

  describe('enableGitOps', () => {
    it('should create a new GitOps configuration', async () => {
      const input: CreateGitOpsInput = {
        repoUrl: 'https://github.com/org/orion-configs',
        branch: 'main',
        createdBy: 'admin',
      };

      const result = await gitOpsService.enableGitOps(input);

      expect(result.id).toBeDefined();
      expect(result.repoUrl).toBe('https://github.com/org/orion-configs');
      expect(result.branch).toBe('main');
      expect(result.status).toBe('enabled');
      expect(result.syncInterval).toBe(300); // Default 5 minutes
      expect(result.autoApply).toBe(true);
    });

    it('should use custom sync interval', async () => {
      const input: CreateGitOpsInput = {
        repoUrl: 'https://github.com/org/configs',
        branch: 'main',
        syncInterval: 60,
        createdBy: 'admin',
      };

      const result = await gitOpsService.enableGitOps(input);
      expect(result.syncInterval).toBe(60);
    });

    it('should allow custom config path', async () => {
      const input: CreateGitOpsInput = {
        repoUrl: 'https://github.com/org/configs',
        branch: 'main',
        configPath: 'environments/',
        createdBy: 'admin',
      };

      const result = await gitOpsService.enableGitOps(input);
      expect(result.configPath).toBe('environments/');
    });

    it('should allow disabling auto-apply', async () => {
      const input: CreateGitOpsInput = {
        repoUrl: 'https://github.com/org/configs',
        branch: 'main',
        autoApply: false,
        createdBy: 'admin',
      };

      const result = await gitOpsService.enableGitOps(input);
      expect(result.autoApply).toBe(false);
    });
  });

  describe('disableGitOps', () => {
    it('should disable GitOps configuration', async () => {
      const gitOpsConfig = await gitOpsService.enableGitOps({
        repoUrl: 'https://github.com/org/configs',
        branch: 'main',
        createdBy: 'admin',
      });

      const result = await gitOpsService.disableGitOps(gitOpsConfig.id);

      expect(result.status).toBe('disabled');
    });

    it('should throw error for non-existent config', async () => {
      await expect(
        gitOpsService.disableGitOps('non-existent-id')
      ).rejects.toThrow("GitOps config 'non-existent-id' not found");
    });
  });

  describe('getGitOpsConfig', () => {
    it('should return config by ID', async () => {
      const gitOpsConfig = await gitOpsService.enableGitOps({
        repoUrl: 'https://github.com/org/configs',
        branch: 'main',
        createdBy: 'admin',
      });

      const result = await gitOpsService.getGitOpsConfig(gitOpsConfig.id);
      expect(result?.id).toBe(gitOpsConfig.id);
      expect(result?.repoUrl).toBe('https://github.com/org/configs');
    });

    it('should return null for non-existent config', async () => {
      const result = await gitOpsService.getGitOpsConfig('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('listGitOpsConfigs', () => {
    it('should return all GitOps configurations', async () => {
      await gitOpsService.enableGitOps({
        repoUrl: 'https://github.com/org/configs1',
        branch: 'main',
        createdBy: 'admin',
      });
      await gitOpsService.enableGitOps({
        repoUrl: 'https://github.com/org/configs2',
        branch: 'develop',
        createdBy: 'admin',
      });

      const results = await gitOpsService.listGitOpsConfigs();
      expect(results.length).toBe(2);
    });
  });

  describe('syncFromGit', () => {
    it('should sync configs from Git (YAML format)', async () => {
      await gitOpsService.enableGitOps({
        repoUrl: 'https://github.com/org/configs',
        branch: 'main',
        createdBy: 'admin',
      });

      const yamlContent = `
dev:
  database.url: postgres://dev:5432/orion
  cache.enabled: "true"
prod:
  database.url: postgres://prod:5432/orion
  cache.enabled: "false"
`;

      mockGitClient.setFileContent('/tmp/orion-config-repo/configs/configs.yaml', yamlContent);

      const result = await gitOpsService.syncFromGit();

      expect(result.status).toBe('success');
      expect(result.itemsSynced).toBe(4);
      // No drift on first sync - configs only in Git are not considered drift
      expect(result.driftDetected).toBe(false);
    });

    it('should sync configs from Git (JSON format)', async () => {
      await gitOpsService.enableGitOps({
        repoUrl: 'https://github.com/org/configs',
        branch: 'main',
        createdBy: 'admin',
      });

      const jsonContent = JSON.stringify({
        dev: {
          'database.url': 'postgres://dev:5432/orion',
          'cache.enabled': 'true',
        },
        prod: {
          'database.url': 'postgres://prod:5432/orion',
        },
      });

      mockGitClient.setFileContent('/tmp/orion-config-repo/configs/configs.json', jsonContent);

      const result = await gitOpsService.syncFromGit();

      expect(result.status).toBe('success');
      expect(result.itemsSynced).toBe(3);
    });

    it('should detect drift during sync', async () => {
      // Create existing config that differs from Git
      await configService.createConfig({
        key: 'database.url',
        value: 'postgres://platform:5432/db',
        environment: 'dev',
        createdBy: 'admin',
      });

      await gitOpsService.enableGitOps({
        repoUrl: 'https://github.com/org/configs',
        branch: 'main',
        createdBy: 'admin',
      });

      const yamlContent = `
dev:
  database.url: postgres://git:5432/db
  new.key: new-value
`;

      mockGitClient.setFileContent('/tmp/orion-config-repo/configs/configs.yaml', yamlContent);

      const result = await gitOpsService.syncFromGit();

      expect(result.driftDetected).toBe(true);
      expect(result.driftItems).toBeDefined();
      expect(result.driftItems!.length).toBeGreaterThan(0);
    });

    it('should handle Git access failure gracefully', async () => {
      await gitOpsService.enableGitOps({
        repoUrl: 'https://github.com/org/configs',
        branch: 'main',
        createdBy: 'admin',
      });

      // Don't set any file content - Git read will fail
      const result = await gitOpsService.syncFromGit();

      expect(result.status).toBe('success'); // Sync completes but no items
      expect(result.itemsSynced).toBe(0);
    });

    it('should publish config.synced event', async () => {
      await gitOpsService.enableGitOps({
        repoUrl: 'https://github.com/org/configs',
        branch: 'main',
        createdBy: 'admin',
      });

      const jsonContent = JSON.stringify({
        dev: { 'test.key': 'value' },
      });

      mockGitClient.setFileContent('/tmp/orion-config-repo/configs/configs.json', jsonContent);

      await gitOpsService.syncFromGit();

      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'config.synced',
        expect.objectContaining({
          status: 'success',
        }),
        expect.any(Object)
      );
    });
  });

  describe('detectDrift', () => {
    it('should detect modified configs', async () => {
      await configService.createConfig({
        key: 'database.url',
        value: 'platform-value',
        environment: 'dev',
        createdBy: 'admin',
      });

      await gitOpsService.enableGitOps({
        repoUrl: 'https://github.com/org/configs',
        branch: 'main',
        createdBy: 'admin',
      });

      const yamlContent = `
dev:
  database.url: git-value
`;

      mockGitClient.setFileContent('/tmp/orion-config-repo/configs/configs.yaml', yamlContent);

      const drift = await gitOpsService.detectDrift();

      expect(drift.length).toBe(1);
      expect(drift[0].key).toBe('database.url');
      expect(drift[0].changeType).toBe('modified');
      expect(drift[0].oldValue).toBe('platform-value');
      expect(drift[0].newValue).toBe('git-value');
    });

    it('should detect configs in platform but not in Git', async () => {
      await configService.createConfig({
        key: 'platform.only.key',
        value: 'platform-value',
        environment: 'dev',
        createdBy: 'admin',
      });

      await gitOpsService.enableGitOps({
        repoUrl: 'https://github.com/org/configs',
        branch: 'main',
        createdBy: 'admin',
      });

      // Git has no configs
      mockGitClient.setFileContent('/tmp/orion-config-repo/configs/configs.yaml', '');

      const drift = await gitOpsService.detectDrift();

      expect(drift.length).toBe(1);
      expect(drift[0].changeType).toBe('removed');
      expect(drift[0].key).toBe('platform.only.key');
    });

    it('should detect removed configs (in platform, not in Git)', async () => {
      await configService.createConfig({
        key: 'old.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      await gitOpsService.enableGitOps({
        repoUrl: 'https://github.com/org/configs',
        branch: 'main',
        createdBy: 'admin',
      });

      // Git has no configs
      mockGitClient.setFileContent('/tmp/orion-config-repo/configs/configs.yaml', '');

      const drift = await gitOpsService.detectDrift();

      expect(drift.length).toBe(1);
      expect(drift[0].changeType).toBe('removed');
      expect(drift[0].key).toBe('old.key');
    });
  });

  describe('getSyncStatus', () => {
    it('should return sync history', async () => {
      await gitOpsService.enableGitOps({
        repoUrl: 'https://github.com/org/configs',
        branch: 'main',
        createdBy: 'admin',
      });

      await gitOpsService.syncFromGit();
      await gitOpsService.syncFromGit();

      const statuses = await gitOpsService.getSyncStatus();
      expect(statuses.length).toBe(2);
    });

    it('should respect limit parameter', async () => {
      await gitOpsService.enableGitOps({
        repoUrl: 'https://github.com/org/configs',
        branch: 'main',
        createdBy: 'admin',
      });

      for (let i = 0; i < 5; i++) {
        await gitOpsService.syncFromGit();
      }

      const statuses = await gitOpsService.getSyncStatus({ limit: 2 });
      expect(statuses.length).toBeLessThanOrEqual(2);
    });

    it('should filter by gitOpsConfigId', async () => {
      const config1 = await gitOpsService.enableGitOps({
        repoUrl: 'https://github.com/org/configs1',
        branch: 'main',
        createdBy: 'admin',
      });

      const config2 = await gitOpsService.enableGitOps({
        repoUrl: 'https://github.com/org/configs2',
        branch: 'main',
        createdBy: 'admin',
      });

      await gitOpsService.syncFromGit(config1.id);
      await gitOpsService.syncFromGit(config2.id);

      const statuses1 = await gitOpsService.getSyncStatus({
        gitOpsConfigId: config1.id,
      });
      expect(statuses1.length).toBe(1);
    });
  });

  describe('getLatestSyncStatus', () => {
    it('should return the most recent sync status', async () => {
      await gitOpsService.enableGitOps({
        repoUrl: 'https://github.com/org/configs',
        branch: 'main',
        createdBy: 'admin',
      });

      await gitOpsService.syncFromGit();

      const latest = await gitOpsService.getLatestSyncStatus();
      expect(latest).not.toBeNull();
      expect(latest?.status).toBe('success');
    });

    it('should return null if no sync has occurred', async () => {
      const latest = await gitOpsService.getLatestSyncStatus();
      expect(latest).toBeNull();
    });
  });

  describe('setGitClient', () => {
    it('should allow replacing the Git client', async () => {
      const newMockClient = new MockGitClient();
      gitOpsService.setGitClient(newMockClient);

      // Should use the new client
      await gitOpsService.enableGitOps({
        repoUrl: 'https://github.com/org/configs',
        branch: 'main',
        createdBy: 'admin',
      });

      const result = await gitOpsService.syncFromGit();
      expect(result).toBeDefined();
    });
  });
});
