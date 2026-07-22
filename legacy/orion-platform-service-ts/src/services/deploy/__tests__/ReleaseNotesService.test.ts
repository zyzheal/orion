/**
 * Tests for ReleaseNotesService
 */
import { ReleaseNotesService, ReleaseNotesServiceError } from '../ReleaseNotesService';

const mockCreate = jest.fn();
const mockFindByDeploymentId = jest.fn();
const mockFindByTenantId = jest.fn();
const mockUpsertByDeploymentId = jest.fn();
const mockDeleteByDeploymentId = jest.fn();

jest.mock('../../../repositories/ReleaseNotesRepository', () => ({
  ReleaseNotesRepository: jest.fn().mockImplementation(() => ({
    create: mockCreate,
    findByDeploymentId: mockFindByDeploymentId,
    findByTenantId: mockFindByTenantId,
    upsertByDeploymentId: mockUpsertByDeploymentId,
    deleteByDeploymentId: mockDeleteByDeploymentId,
  })),
}));

describe('ReleaseNotesService', () => {
  let service: ReleaseNotesService;
  const mockDb = { query: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReleaseNotesService(mockDb);
  });

  describe('generateReleaseNotes', () => {
    it('should generate release notes', async () => {
      mockCreate.mockResolvedValue({
        id: 'rn-1',
        deploymentId: 'deploy-1',
        tenantId: 'tenant-1',
        version: '1.0.0',
        environment: 'prod',
        generatedAt: new Date(),
        summary: 'This release includes 1 feature',
        changes: [{ type: 'feature', description: 'New feature' }],
        metrics: { totalCommits: 1, totalChanges: 1, breakingChanges: 0, features: 1, fixes: 0 },
        notes: null,
      });

      const result = await service.generateReleaseNotes('tenant-1', 'deploy-1', {
        version: '1.0.0',
        environment: 'prod',
        changes: [{ type: 'feature', description: 'New feature' }],
      });

      expect(result.deploymentId).toBe('deploy-1');
      expect(result.version).toBe('1.0.0');
    });

    it('should throw when tenantId is missing', async () => {
      await expect(
        service.generateReleaseNotes('', 'deploy-1'),
      ).rejects.toThrow('tenantId and deploymentId are required');
    });

    it('should throw when deploymentId is missing', async () => {
      await expect(
        service.generateReleaseNotes('tenant-1', ''),
      ).rejects.toThrow('tenantId and deploymentId are required');
    });

    it('should use default changes when none provided', async () => {
      mockCreate.mockResolvedValue({
        id: 'rn-1',
        deploymentId: 'deploy-1',
        tenantId: 'tenant-1',
        version: '1.0.0',
        environment: 'unknown',
        generatedAt: new Date(),
        summary: 'This release includes 1 feature',
        changes: [{ type: 'feature', description: 'Initial release' }],
        metrics: { totalCommits: 1, totalChanges: 1, breakingChanges: 0, features: 1, fixes: 0 },
      });

      const result = await service.generateReleaseNotes('tenant-1', 'deploy-1');

      expect(result.changes.length).toBe(1);
      expect(result.changes[0].type).toBe('feature');
    });
  });

  describe('getReleaseNotes', () => {
    it('should return release notes', async () => {
      mockFindByDeploymentId.mockResolvedValue({
        id: 'rn-1',
        deploymentId: 'deploy-1',
        tenantId: 'tenant-1',
        version: '1.0.0',
        environment: 'prod',
        generatedAt: new Date(),
        summary: 'Summary',
        changes: [],
      });

      const result = await service.getReleaseNotes('deploy-1');

      expect(result).not.toBeNull();
      expect(result!.deploymentId).toBe('deploy-1');
    });

    it('should return null when not found', async () => {
      mockFindByDeploymentId.mockResolvedValue(null);

      const result = await service.getReleaseNotes('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getReleaseNotesByTenant', () => {
    it('should return release notes for tenant', async () => {
      mockFindByTenantId.mockResolvedValue([
        {
          id: 'rn-1',
          deploymentId: 'deploy-1',
          tenantId: 'tenant-1',
          version: '1.0.0',
          environment: 'prod',
          generatedAt: new Date(),
          summary: 'Summary',
          changes: [],
        },
      ]);

      const result = await service.getReleaseNotesByTenant('tenant-1');

      expect(result.length).toBe(1);
    });
  });

  describe('saveReleaseNotes', () => {
    it('should save release notes', async () => {
      mockUpsertByDeploymentId.mockResolvedValue({
        id: 'rn-1',
        deploymentId: 'deploy-1',
        tenantId: 'tenant-1',
        version: '1.0.0',
        environment: 'prod',
        generatedAt: new Date(),
        summary: 'Updated summary',
        changes: [],
      });

      const result = await service.saveReleaseNotes('deploy-1', {
        id: 'rn-1',
        deploymentId: 'deploy-1',
        tenantId: 'tenant-1',
        version: '1.0.0',
        environment: 'prod',
        generatedAt: new Date(),
        summary: 'Updated summary',
        changes: [],
      });

      expect(result.summary).toBe('Updated summary');
    });
  });

  describe('deleteReleaseNotes', () => {
    it('should delete release notes', async () => {
      mockDeleteByDeploymentId.mockResolvedValue(undefined);

      await service.deleteReleaseNotes('deploy-1');

      expect(mockDeleteByDeploymentId).toHaveBeenCalledWith('deploy-1');
    });
  });
});
