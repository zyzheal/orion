/**
 * Tests for DeployGitIntegrationService
 *
 * TASK-5.9: Deploy Release Notes Git Integration
 */
import { DeployGitIntegrationService, DeployGitIntegrationError } from '../DeployGitIntegrationService';
import { Deployment } from '../DeployRepository';

// Mock DeployRepository
const mockFindById = jest.fn();
const mockUpdate = jest.fn();

const mockDeployRepository = {
  findById: mockFindById,
  update: mockUpdate,
} as any;

// Mock ReleaseNotesRepository
const mockReleaseNotesCreate = jest.fn();
const mockReleaseNotesFindByDeploymentId = jest.fn();

jest.mock('../../../repositories/ReleaseNotesRepository', () => ({
  ReleaseNotesRepository: jest.fn().mockImplementation(() => ({
    create: mockReleaseNotesCreate,
    findByDeploymentId: mockReleaseNotesFindByDeploymentId,
  })),
}));

// Mock DeployGitCommitLinkRepository
const mockGitCommitLinkFindByDeploymentId = jest.fn();
const mockGitCommitLinkUpsertByDeploymentId = jest.fn();

jest.mock('../../../repositories/DeployGitCommitLinkRepository', () => ({
  DeployGitCommitLinkRepository: jest.fn().mockImplementation(() => ({
    findByDeploymentId: mockGitCommitLinkFindByDeploymentId,
    upsertByDeploymentId: mockGitCommitLinkUpsertByDeploymentId,
  })),
}));

// Mock simple-git
const mockGitLog = jest.fn();
const mockGitFetch = jest.fn();
const mockGitCheckIsRepo = jest.fn();

jest.mock('simple-git', () => {
  return jest.fn(() => ({
    log: mockGitLog,
    fetch: mockGitFetch,
    checkIsRepo: mockGitCheckIsRepo,
  }));
});

// Mock fs.promises.access
jest.mock('fs/promises', () => ({
  access: jest.fn().mockResolvedValue(undefined),
}));

describe('DeployGitIntegrationService', () => {
  let service: DeployGitIntegrationService;
  const mockDb = { query: jest.fn() };

  const mockDeployment: Deployment = {
    id: 'deploy-1',
    tenant_id: 'tenant-1',
    project_id: null,
    pipeline_run_id: null,
    build_id: null,
    environment: 'prod',
    status: 'success',
    strategy: 'rolling',
    config: {},
    deployed_by: 'user-1',
    started_at: new Date('2026-07-01T10:00:00Z'),
    completed_at: new Date('2026-07-01T10:05:00Z'),
    duration_ms: 300000,
    error_message: null,
    rollback_to: null,
    commit_sha: 'abc123def456',
    commit_committed_at: new Date('2026-07-01T09:55:00Z'),
    created_at: new Date('2026-07-01T10:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGitCheckIsRepo.mockResolvedValue(true);
    mockGitFetch.mockResolvedValue(undefined);

    service = new DeployGitIntegrationService(mockDeployRepository as any, mockDb as any);
  });

  describe('generateReleaseNotes', () => {
    it('should generate release notes from Git commits', async () => {
      mockFindById.mockResolvedValue(mockDeployment);
      mockReleaseNotesCreate.mockResolvedValue({
        id: 'rn-1',
        deploymentId: 'deploy-1',
        tenantId: 'tenant-1',
        version: '1.0.0',
        environment: 'prod',
        generatedAt: new Date(),
        summary: 'This release includes 2 features, 1 fix',
        changes: [
          { type: 'feature', description: 'feat: New feature', commit: 'abc123', author: 'dev1' },
          { type: 'fix', description: 'fix: Bug fix', commit: 'def456', author: 'dev2' },
        ],
        metrics: { totalCommits: 2, totalChanges: 2, breakingChanges: 0, features: 2, fixes: 1, improvements: 0 },
        generatedBy: 'git',
        status: 'published',
      });

      mockGitLog.mockResolvedValue({
        all: [
          { hash: 'abc123', message: 'feat: New feature', author_name: 'dev1', author_email: 'dev1@test.com', date: '2026-07-01T09:50:00Z' },
          { hash: 'def456', message: 'fix: Bug fix', author_name: 'dev2', author_email: 'dev2@test.com', date: '2026-07-01T09:52:00Z' },
        ],
      });

      const result = await service.generateReleaseNotes('deploy-1', 'tenant-1');

      expect(result.deploymentId).toBe('deploy-1');
      expect(result.tenantId).toBe('tenant-1');
      expect(result.changes.length).toBeGreaterThan(0);
      expect(mockReleaseNotesCreate).toHaveBeenCalled();
    });

    it('should throw when deploymentId is missing', async () => {
      await expect(
        service.generateReleaseNotes('', 'tenant-1'),
      ).rejects.toThrow('deploymentId and tenantId are required');
    });

    it('should throw when deployment not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        service.generateReleaseNotes('deploy-1', 'tenant-1'),
      ).rejects.toThrow('Deployment not found');
    });

    it('should throw when tenant does not match', async () => {
      mockFindById.mockResolvedValue({ ...mockDeployment, tenant_id: 'tenant-2' });

      await expect(
        service.generateReleaseNotes('deploy-1', 'tenant-1'),
      ).rejects.toThrow('Deployment does not belong to tenant');
    });

    it('should throw when deployment has no commit SHA', async () => {
      mockFindById.mockResolvedValue({ ...mockDeployment, commit_sha: null });

      await expect(
        service.generateReleaseNotes('deploy-1', 'tenant-1'),
      ).rejects.toThrow('No commit SHA available');
    });

    it('should accept custom fromCommit and toCommit', async () => {
      mockFindById.mockResolvedValue(mockDeployment);
      mockReleaseNotesCreate.mockResolvedValue({
        id: 'rn-1',
        deploymentId: 'deploy-1',
        tenantId: 'tenant-1',
        version: '1.0.0',
        environment: 'prod',
        generatedAt: new Date(),
        summary: 'Custom range',
        changes: [],
        metrics: { totalCommits: 0, totalChanges: 0, breakingChanges: 0, features: 0, fixes: 0, improvements: 0 },
        generatedBy: 'git',
        status: 'published',
      });

      mockGitLog.mockResolvedValue({ all: [] });

      await service.generateReleaseNotes('deploy-1', 'tenant-1', {
        fromCommit: 'oldsha',
        toCommit: 'abc123',
      });

      expect(mockGitLog).toHaveBeenCalledWith({
        from: 'abc123',
        to: 'oldsha',
        maxCount: 100,
        symmetric: false,
      });
    });
  });

  describe('linkGitCommit', () => {
    it('should link Git commit to deployment', async () => {
      mockFindById.mockResolvedValue(mockDeployment);
      mockGitCommitLinkUpsertByDeploymentId.mockResolvedValue({
        id: 'link-1',
        deploymentId: 'deploy-1',
        tenantId: 'tenant-1',
        commitSha: 'abc123def456',
        commitMessage: 'feat: New feature',
        commitAuthor: 'dev1',
        commitEmail: 'dev1@test.com',
        committedAt: new Date('2026-07-01T09:55:00Z'),
        branch: 'main',
        prNumber: '42',
        prUrl: 'https://github.com/orionhq/orion-platform/pull/42',
        linkedAt: new Date(),
        createdAt: new Date(),
      });
      mockUpdate.mockResolvedValue(mockDeployment);

      // Mock git log for enrichment
      mockGitLog.mockResolvedValue({
        latest: {
          message: 'feat: New feature',
          author_name: 'dev1',
          author_email: 'dev1@test.com',
          date: '2026-07-01T09:55:00Z',
        },
      });

      const result = await service.linkGitCommit('deploy-1', 'tenant-1', 'abc123def456', {
        branch: 'main',
        prNumber: '42',
      });

      expect(result.commitSha).toBe('abc123def456');
      expect(result.deploymentId).toBe('deploy-1');
      expect(mockGitCommitLinkUpsertByDeploymentId).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith('deploy-1', { commit_sha: 'abc123def456' });
    });

    it('should throw when deploymentId is missing', async () => {
      await expect(
        service.linkGitCommit('', 'tenant-1', 'abc123'),
      ).rejects.toThrow('deploymentId, tenantId, and commitSha are required');
    });

    it('should throw when commitSha is missing', async () => {
      await expect(
        service.linkGitCommit('deploy-1', 'tenant-1', ''),
      ).rejects.toThrow('deploymentId, tenantId, and commitSha are required');
    });

    it('should throw when commitSha format is invalid', async () => {
      await expect(
        service.linkGitCommit('deploy-1', 'tenant-1', 'not-a-sha!'),
      ).rejects.toThrow('Invalid commit SHA format');
    });

    it('should throw when deployment not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        service.linkGitCommit('deploy-1', 'tenant-1', 'abc12345'),
      ).rejects.toThrow('Deployment not found');
    });

    it('should not fail enrichment if git is unavailable', async () => {
      mockFindById.mockResolvedValue(mockDeployment);
      mockGitLog.mockRejectedValue(new Error('git not available'));
      mockGitCommitLinkUpsertByDeploymentId.mockResolvedValue({
        id: 'link-1',
        deploymentId: 'deploy-1',
        tenantId: 'tenant-1',
        commitSha: 'abc123def456',
        commitMessage: null,
        commitAuthor: null,
        commitEmail: null,
        committedAt: null,
        branch: null,
        prNumber: null,
        prUrl: null,
        linkedAt: new Date(),
        createdAt: new Date(),
      });
      mockUpdate.mockResolvedValue(mockDeployment);

      const result = await service.linkGitCommit('deploy-1', 'tenant-1', 'abc123def456');

      expect(result.commitSha).toBe('abc123def456');
    });
  });

  describe('getDeploymentChangelog', () => {
    it('should return changelog for deployment', async () => {
      mockFindById.mockResolvedValue(mockDeployment);
      mockGitCommitLinkFindByDeploymentId.mockResolvedValue(null);

      mockGitLog.mockResolvedValue({
        all: [
          { hash: 'abc123', message: 'feat: New feature', author_name: 'dev1', author_email: 'dev1@test.com', date: '2026-07-01T09:50:00Z' },
        ],
      });

      const result = await service.getDeploymentChangelog('deploy-1', 'tenant-1');

      expect(result.deploymentId).toBe('deploy-1');
      expect(result.commitSha).toBe('abc123def456');
      expect(result.totalCommits).toBe(1);
      expect(result.changes.length).toBeGreaterThan(0);
    });

    it('should throw when deployment not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        service.getDeploymentChangelog('deploy-1', 'tenant-1'),
      ).rejects.toThrow('Deployment not found');
    });

    it('should throw when tenant does not match', async () => {
      mockFindById.mockResolvedValue({ ...mockDeployment, tenant_id: 'tenant-2' });

      await expect(
        service.getDeploymentChangelog('deploy-1', 'tenant-1'),
      ).rejects.toThrow('Deployment does not belong to tenant');
    });

    it('should throw when deployment has no commit SHA', async () => {
      mockFindById.mockResolvedValue({ ...mockDeployment, commit_sha: null });

      await expect(
        service.getDeploymentChangelog('deploy-1', 'tenant-1'),
      ).rejects.toThrow('Deployment has no associated commit SHA');
    });

    it('should use custom repoPath', async () => {
      mockFindById.mockResolvedValue(mockDeployment);
      mockGitCommitLinkFindByDeploymentId.mockResolvedValue(null);
      mockGitLog.mockResolvedValue({ all: [] });

      await service.getDeploymentChangelog('deploy-1', 'tenant-1', '/custom/repo/path');

      // The git operations use the repoPath - we verify by checking mockGitLog was called
      expect(mockGitLog).toHaveBeenCalled();
    });
  });

  describe('getCommitLink', () => {
    it('should return commit link for deployment', async () => {
      mockGitCommitLinkFindByDeploymentId.mockResolvedValue({
        id: 'link-1',
        deploymentId: 'deploy-1',
        tenantId: 'tenant-1',
        commitSha: 'abc123',
        commitMessage: null,
        commitAuthor: null,
        commitEmail: null,
        committedAt: null,
        branch: null,
        prNumber: null,
        prUrl: null,
        linkedAt: new Date(),
        createdAt: new Date(),
      });

      const result = await service.getCommitLink('deploy-1', 'tenant-1');

      expect(result).not.toBeNull();
      expect(result?.commitSha).toBe('abc123');
    });

    it('should return null when link not found', async () => {
      mockGitCommitLinkFindByDeploymentId.mockResolvedValue(undefined);

      const result = await service.getCommitLink('deploy-1', 'tenant-1');

      expect(result).toBeNull();
    });

    it('should return null when tenant does not match', async () => {
      mockGitCommitLinkFindByDeploymentId.mockResolvedValue({
        id: 'link-1',
        deploymentId: 'deploy-1',
        tenantId: 'tenant-2',
        commitSha: 'abc123',
        commitMessage: null,
        commitAuthor: null,
        commitEmail: null,
        committedAt: null,
        branch: null,
        prNumber: null,
        prUrl: null,
        linkedAt: new Date(),
        createdAt: new Date(),
      });

      const result = await service.getCommitLink('deploy-1', 'tenant-1');

      expect(result).toBeNull();
    });
  });
});
