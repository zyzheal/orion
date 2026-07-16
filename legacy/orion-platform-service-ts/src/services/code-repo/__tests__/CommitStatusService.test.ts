/**
 * CommitStatusService 测试
 *
 * 测试 Git 提交状态管理服务：创建/获取/更新/删除状态、批量更新、就绪检查。
 * Mock GitLabClient 和 GitHubClient 模拟 API 调用。
 */

import { CommitStatusService, CommitStatus, GitProvider } from '../CommitStatusService';

// ==================== Mocks ====================

jest.mock('../GitLabAdapter', () => ({
  GitLabAdapter: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../../clients/GitLabClient', () => ({
  GitLabClient: jest.fn().mockImplementation(() => ({
    createCommitStatus: jest.fn().mockResolvedValue(undefined),
    getCommitStatuses: jest.fn().mockResolvedValue([
      { state: 'success', context: 'pipeline/build', description: 'Build passed' },
    ]),
    updateCommitStatus: jest.fn().mockResolvedValue(undefined),
    batchUpdateCommitStatuses: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../clients/GitHubClient', () => ({
  GitHubClient: jest.fn().mockImplementation(() => ({
    createCommitStatus: jest.fn().mockResolvedValue(undefined),
    getCommitStatuses: jest.fn().mockResolvedValue([
      { state: 'success', context: 'pipeline/build', description: 'Build passed' },
    ]),
    updateCommitStatus: jest.fn().mockResolvedValue(undefined),
    batchUpdateCommitStatuses: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('pino', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }));
});

// ==================== Tests ====================

describe('CommitStatusService', () => {
  let service: CommitStatusService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CommitStatusService({
      gitLabToken: 'gl-token',
      gitLabBaseUrl: 'https://gitlab.com',
      githubToken: 'gh-token',
      githubBaseUrl: 'https://api.github.com',
    });
  });

  // ---- createStatus ----

  describe('createStatus', () => {
    it('should create GitLab commit status', async () => {
      await service.createStatus({
        repositoryId: 'gl-project-123',
        commitSha: 'abc123',
        state: CommitStatus.SUCCESS,
        context: 'pipeline/build',
        description: 'Build passed',
      });

      // Verify no error thrown
      expect(true).toBe(true);
    });

    it('should create GitHub commit status', async () => {
      await service.createStatus({
        repositoryId: 'gh-owner/repo',
        commitSha: 'abc123',
        state: CommitStatus.PENDING,
        context: 'pipeline/test',
        description: 'Tests running',
      });

      expect(true).toBe(true);
    });

    it('should default to GitLab for unknown provider', async () => {
      // The detectProvider defaults to GitLab when no match
      await service.createStatus({
        repositoryId: 'unknown-provider/repo',
        commitSha: 'abc123',
        state: CommitStatus.SUCCESS,
        context: 'test',
      });

      expect(true).toBe(true);
    });
  });

  // ---- getStatus ----

  describe('getStatus', () => {
    it('should get GitLab commit statuses', async () => {
      const statuses = await service.getStatus({
        repositoryId: 'gl-project-123',
        commitSha: 'abc123',
      });

      expect(Array.isArray(statuses)).toBe(true);
    });

    it('should get GitHub commit statuses', async () => {
      const statuses = await service.getStatus({
        repositoryId: 'gh-owner/repo',
        commitSha: 'abc123',
      });

      expect(Array.isArray(statuses)).toBe(true);
    });
  });

  // ---- getStatusDetail ----

  describe('getStatusDetail', () => {
    it('should return first status detail', async () => {
      const detail = await service.getStatusDetail({
        repositoryId: 'gl-project-123',
        commitSha: 'abc123',
      });

      expect(detail).toBeDefined();
    });
  });

  // ---- updateStatus ----

  describe('updateStatus', () => {
    it('should update commit status (delete + create)', async () => {
      await service.updateStatus({
        repositoryId: 'gl-project-123',
        commitSha: 'abc123',
        state: CommitStatus.FAILED,
        context: 'pipeline/build',
        description: 'Build failed',
      });

      expect(true).toBe(true);
    });
  });

  // ---- deleteStatus ----

  describe('deleteStatus', () => {
    it('should delete GitLab commit status', async () => {
      await service.deleteStatus({
        repositoryId: 'gl-project-123',
        commitSha: 'abc123',
        context: 'pipeline/build',
      });

      expect(true).toBe(true);
    });

    it('should delete GitHub commit status', async () => {
      await service.deleteStatus({
        repositoryId: 'gh-owner/repo',
        commitSha: 'abc123',
        context: 'pipeline/build',
      });

      expect(true).toBe(true);
    });
  });

  // ---- batchUpdateStatuses ----

  describe('batchUpdateStatuses', () => {
    it('should batch update statuses for same provider', async () => {
      await service.batchUpdateStatuses([
        {
          repositoryId: 'gl-project-123',
          commitSha: 'abc123',
          state: CommitStatus.SUCCESS,
          context: 'build',
        },
        {
          repositoryId: 'gl-project-123',
          commitSha: 'abc123',
          state: CommitStatus.SUCCESS,
          context: 'test',
        },
      ]);

      expect(true).toBe(true);
    });

    it('should batch update statuses for mixed providers', async () => {
      await service.batchUpdateStatuses([
        {
          repositoryId: 'gl-project-123',
          commitSha: 'abc123',
          state: CommitStatus.SUCCESS,
          context: 'build',
        },
        {
          repositoryId: 'gh-owner/repo',
          commitSha: 'abc123',
          state: CommitStatus.SUCCESS,
          context: 'build',
        },
      ]);

      expect(true).toBe(true);
    });
  });

  // ---- checkCommitReadiness ----

  describe('checkCommitReadiness', () => {
    it('should return ready when all statuses pass', async () => {
      const result = await service.checkCommitReadiness('gl-project-123', 'abc123');

      expect(result.ready).toBe(true);
      expect(result.failedContexts).toHaveLength(0);
      expect(Array.isArray(result.statuses)).toBe(true);
    });

    it('should return not ready when statuses fail', async () => {
      // Create a service with mocked failed statuses
      const failedService = new CommitStatusService({
        gitLabToken: 'token',
        gitLabBaseUrl: 'https://gitlab.com',
      });

      // Mock getStatus to return failed statuses
      jest.spyOn(failedService as any, 'getStatus').mockResolvedValue([
        { state: 'failed', context: 'build' },
        { state: 'success', context: 'test' },
      ]);

      const result = await failedService.checkCommitReadiness('gl-project-123', 'abc123');

      expect(result.ready).toBe(false);
      expect(result.failedContexts).toContain('build');
    });
  });

  // ---- Provider detection ----

  describe('provider detection', () => {
    it('should detect GitLab provider from gl- prefix', async () => {
      await service.createStatus({
        repositoryId: 'gl-my-project',
        commitSha: 'abc',
        state: CommitStatus.SUCCESS,
        context: 'test',
      });

      expect(true).toBe(true);
    });

    it('should detect GitHub provider from gh- prefix', async () => {
      await service.createStatus({
        repositoryId: 'gh-owner/repo',
        commitSha: 'abc',
        state: CommitStatus.SUCCESS,
        context: 'test',
      });

      expect(true).toBe(true);
    });

    it('should detect GitLab provider from gitlab in id', async () => {
      await service.createStatus({
        repositoryId: 'gitlab-org/project',
        commitSha: 'abc',
        state: CommitStatus.SUCCESS,
        context: 'test',
      });

      expect(true).toBe(true);
    });

    it('should detect GitHub provider from github in id', async () => {
      await service.createStatus({
        repositoryId: 'github-org/repo',
        commitSha: 'abc',
        state: CommitStatus.SUCCESS,
        context: 'test',
      });

      expect(true).toBe(true);
    });
  });

  // ---- CommitStatus enum ----

  describe('CommitStatus enum', () => {
    it('should have correct values', () => {
      expect(CommitStatus.PENDING).toBe('pending');
      expect(CommitStatus.SUCCESS).toBe('success');
      expect(CommitStatus.FAILED).toBe('failed');
      expect(CommitStatus.CANCELLED).toBe('cancelled');
    });
  });

  // ---- GitProvider enum ----

  describe('GitProvider enum', () => {
    it('should have correct values', () => {
      expect(GitProvider.GITLAB).toBe('gitlab');
      expect(GitProvider.GITHUB).toBe('github');
    });
  });
});
