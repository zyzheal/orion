/**
 * PipelineTemplateService - Pipeline Template Management Unit Tests
 *
 * Coverage: listTemplates, getTemplateById, createTemplate, updateTemplate,
 *           deleteTemplate, createTemplateVersion, listTemplateVersions,
 *           instantiateTemplate, mapTemplate
 */

import { PipelineTemplateService } from '../PipelineTemplateService';

describe('PipelineTemplateService', () => {
  let service: PipelineTemplateService;
  let mockPool: { query: jest.Mock };

  const sampleTemplateRow = {
    id: 'tmpl-1',
    tenant_id: 't-1',
    name: 'Node.js CI',
    description: 'Node.js CI pipeline',
    category: 'language',
    tags: ['node', 'ci'],
    yaml_definition: 'steps:\n  - build:\n      nodeVersion: ${params.nodeVersion}\n  - test',
    parameters: JSON.stringify([{ name: 'nodeVersion', type: 'string', description: 'Node version', required: true, defaultValue: '18' }]),
    version: 1,
    created_by: 'user-1',
    created_at: new Date(),
    updated_at: new Date(),
    usage_count: 5,
    rating: 4.5,
  };

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    service = new PipelineTemplateService(mockPool as any);
  });

  // ==================== listTemplates ====================

  describe('listTemplates', () => {
    it('should list templates', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [sampleTemplateRow] });

      const result = await service.listTemplates({ tenantId: 't-1' });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0].name).toBe('Node.js CI');
    });

    it('should filter by category', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.listTemplates({ tenantId: 't-1', category: 'platform' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('category = $2'),
        expect.arrayContaining(['t-1', 'platform'])
      );
    });

    it('should filter by tag', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.listTemplates({ tenantId: 't-1', tag: 'node' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tags @>'),
        expect.arrayContaining(['t-1', 'node'])
      );
    });

    it('should apply pagination', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.listTemplates({ tenantId: 't-1', page: 2, limit: 10 });

      const [, params] = mockPool.query.mock.calls[1];
      expect(params).toContain(10); // limit
      expect(params).toContain(10); // offset = (2-1)*10
    });
  });

  // ==================== getTemplateById ====================

  describe('getTemplateById', () => {
    it('should return template by id', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleTemplateRow] });

      const result = await service.getTemplateById('t-1', 'tmpl-1');

      expect(result).toBeDefined();
      expect(result!.name).toBe('Node.js CI');
      expect(result!.parameters).toHaveLength(1);
      expect(result!.parameters[0].name).toBe('nodeVersion');
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getTemplateById('t-1', 'non-existent');

      expect(result).toBeNull();
    });
  });

  // ==================== createTemplate ====================

  describe('createTemplate', () => {
    it('should create template', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleTemplateRow] });

      const result = await service.createTemplate({
        tenantId: 't-1',
        name: 'Node.js CI',
        yamlDefinition: 'steps:\n  - build',
        parameters: [{ name: 'nodeVersion', type: 'string', description: 'Node version', required: true }],
      });

      expect(result.name).toBe('Node.js CI');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pipeline_templates'),
        expect.arrayContaining(['t-1', 'Node.js CI'])
      );
    });

    it('should use defaults for optional fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleTemplateRow] });

      await service.createTemplate({
        tenantId: 't-1',
        name: 'Template',
        yamlDefinition: 'steps: []',
      });

      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain('custom'); // default category
    });
  });

  // ==================== updateTemplate ====================

  describe('updateTemplate', () => {
    it('should update template name', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleTemplateRow] }) // getTemplateById
        .mockResolvedValueOnce({ rows: [{ ...sampleTemplateRow, name: 'Updated' }] }); // UPDATE

      const result = await service.updateTemplate('t-1', 'tmpl-1', { name: 'Updated' });

      expect(result!.name).toBe('Updated');
    });

    it('should return null when template not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.updateTemplate('t-1', 'non-existent', { name: 'New' });

      expect(result).toBeNull();
    });

    it('should return existing when no updates', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleTemplateRow] });

      const result = await service.updateTemplate('t-1', 'tmpl-1', {});

      expect(result).toBeDefined();
      expect(result!.name).toBe('Node.js CI');
    });

    it('should update yamlDefinition and create version', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleTemplateRow] }) // getTemplateById
        .mockResolvedValueOnce({ rows: [{ id: 'v-1' }] }) // createTemplateVersion
        .mockResolvedValueOnce({ rows: [{ ...sampleTemplateRow, yaml_definition: 'new yaml' }] }); // UPDATE

      const result = await service.updateTemplate('t-1', 'tmpl-1', {
        yamlDefinition: 'new yaml',
      });

      expect(result).toBeDefined();
    });
  });

  // ==================== deleteTemplate ====================

  describe('deleteTemplate', () => {
    it('should delete template', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await service.deleteTemplate('t-1', 'tmpl-1');

      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await service.deleteTemplate('t-1', 'non-existent');

      expect(result).toBe(false);
    });
  });

  // ==================== createTemplateVersion ====================

  describe('createTemplateVersion', () => {
    it('should create template version', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'v-1',
          template_id: 'tmpl-1',
          version: 2,
          yaml_definition: 'new yaml',
          parameters: '[]',
          change_summary: 'Updated',
          created_by: 'user-1',
          created_at: new Date(),
        }],
      });

      const result = await service.createTemplateVersion(
        'tmpl-1', 2, 'new yaml', [], 'Updated', 'user-1'
      );

      expect(result.templateId).toBe('tmpl-1');
      expect(result.version).toBe(2);
    });
  });

  // ==================== listTemplateVersions ====================

  describe('listTemplateVersions', () => {
    it('should list template versions', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 'v-2', template_id: 'tmpl-1', version: 2, yaml_definition: 'v2', parameters: '[]', change_summary: null, created_by: null, created_at: new Date() },
            { id: 'v-1', template_id: 'tmpl-1', version: 1, yaml_definition: 'v1', parameters: '[]', change_summary: null, created_by: null, created_at: new Date() },
          ],
        });

      const result = await service.listTemplateVersions('tmpl-1');

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  // ==================== instantiateTemplate ====================

  describe('instantiateTemplate', () => {
    it('should instantiate template with parameter substitution', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleTemplateRow] }) // getTemplateById
        .mockResolvedValueOnce({ rows: [] }); // UPDATE usage_count

      const result = await service.instantiateTemplate('t-1', 'tmpl-1', {
        name: 'my-pipeline',
        tenantId: 't-1',
        params: { nodeVersion: '20' },
      });

      expect(result).toBeDefined();
      expect(result!.name).toBe('my-pipeline');
      expect(result!.yamlDefinition).toContain('20'); // nodeVersion substituted
    });

    it('should use default parameter values', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleTemplateRow] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.instantiateTemplate('t-1', 'tmpl-1', {
        name: 'my-pipeline',
        tenantId: 't-1',
      });

      expect(result!.yamlDefinition).toContain('18'); // default nodeVersion
    });

    it('should return null when template not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.instantiateTemplate('t-1', 'non-existent', {
        name: 'test',
        tenantId: 't-1',
      });

      expect(result).toBeNull();
    });
  });

  // ==================== mapTemplate ====================

  describe('mapTemplate', () => {
    it('should handle invalid JSON parameters', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ ...sampleTemplateRow, parameters: 'invalid-json' }],
      });

      const result = await service.getTemplateById('t-1', 'tmpl-1');

      expect(result!.parameters).toEqual([]);
    });

    it('should handle array parameters', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ ...sampleTemplateRow, parameters: [{ name: 'p1', type: 'string', description: 'test', required: true }] }],
      });

      const result = await service.getTemplateById('t-1', 'tmpl-1');

      expect(result!.parameters).toHaveLength(1);
    });

    it('should handle null rating', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ ...sampleTemplateRow, rating: null }],
      });

      const result = await service.getTemplateById('t-1', 'tmpl-1');

      expect(result!.rating).toBeUndefined();
    });
  });
});
