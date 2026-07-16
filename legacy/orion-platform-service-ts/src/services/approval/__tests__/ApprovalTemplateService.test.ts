/**
 * Tests for ApprovalTemplateService
 */
import { ApprovalTemplateService } from '../ApprovalTemplateService';

describe('ApprovalTemplateService', () => {
  let service: ApprovalTemplateService;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    // Constructor calls ensureTable which calls pool.query
    service = new ApprovalTemplateService({ query: mockQuery } as any);
    // Reset mock after constructor to clear the ensureTable call
    mockQuery.mockClear();
  });

  describe('createTemplate', () => {
    it('should create a template', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // unset defaults
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // insert

      const result = await service.createTemplate('tenant-1', {
        name: 'Deploy Approval',
        description: 'Standard deploy approval',
        resourceType: 'deployment',
        levels: [
          { levelIndex: 0, approverIds: ['user1'], requiredApprovals: 1 },
        ],
        mode: 'serial',
      });

      expect(result.name).toBe('Deploy Approval');
      expect(result.resourceType).toBe('deployment');
      expect(result.mode).toBe('serial');
      expect(result.isDefault).toBe(false);
      expect(result.tenantId).toBe('tenant-1');
    });

    it('should unset other defaults when creating default template', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // unset defaults
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // insert

      await service.createTemplate('tenant-1', {
        name: 'Default Deploy',
        resourceType: 'deployment',
        levels: [],
        isDefault: true,
      });

      // Should have called to unset other defaults
      const unsetCall = mockQuery.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('SET is_default = false'),
      );
      expect(unsetCall).toBeDefined();
    });

    it('should default mode to serial', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // insert

      const result = await service.createTemplate('tenant-1', {
        name: 'Test',
        resourceType: 'generic',
        levels: [],
      });

      expect(result.mode).toBe('serial');
    });
  });

  describe('getTemplates', () => {
    it('should return templates for tenant', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'tmpl-1',
            tenant_id: 'tenant-1',
            name: 'Deploy Approval',
            description: 'Standard',
            resource_type: 'deployment',
            levels: JSON.stringify([{ levelIndex: 0, approverIds: ['user1'], requiredApprovals: 1 }]),
            mode: 'serial',
            is_default: true,
            created_at: '2024-01-01',
            updated_at: '2024-01-01',
          },
        ],
      });

      const result = await service.getTemplates('tenant-1');
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Deploy Approval');
      expect(result[0].isDefault).toBe(true);
    });

    it('should return empty array when no templates', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.getTemplates('tenant-1');
      expect(result).toEqual([]);
    });
  });

  describe('getTemplate', () => {
    it('should return template by id', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'tmpl-1',
            tenant_id: 'tenant-1',
            name: 'Deploy Approval',
            description: null,
            resource_type: 'deployment',
            levels: [{ levelIndex: 0, approverIds: ['user1'], requiredApprovals: 1 }],
            mode: 'parallel',
            is_default: false,
            created_at: '2024-01-01',
            updated_at: '2024-01-01',
          },
        ],
      });

      const result = await service.getTemplate('tmpl-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('tmpl-1');
      expect(result!.mode).toBe('parallel');
    });

    it('should return null when template not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.getTemplate('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getDefaultTemplate', () => {
    it('should return default template for resource type', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'tmpl-1',
            tenant_id: 'tenant-1',
            name: 'Default Deploy',
            description: null,
            resource_type: 'deployment',
            levels: JSON.stringify([]),
            mode: 'serial',
            is_default: true,
            created_at: '2024-01-01',
            updated_at: '2024-01-01',
          },
        ],
      });

      const result = await service.getDefaultTemplate('tenant-1', 'deployment');
      expect(result).not.toBeNull();
      expect(result!.isDefault).toBe(true);
    });

    it('should return null when no default template', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDefaultTemplate('tenant-1', 'nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template successfully', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await service.deleteTemplate('tmpl-1', 'tenant-1');
      expect(result).toBe(true);
    });

    it('should return false when template not found', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const result = await service.deleteTemplate('nonexistent', 'tenant-1');
      expect(result).toBe(false);
    });
  });
});
