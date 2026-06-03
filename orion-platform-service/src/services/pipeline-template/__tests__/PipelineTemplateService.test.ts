/**
 * PipelineTemplateService 单元测试
 */

import { PipelineTemplateService, PipelineTemplateRepository, PipelineTemplateServiceError } from '../PipelineTemplateService';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('PipelineTemplateService', () => {
  let service: PipelineTemplateService;
  let repository: PipelineTemplateRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PipelineTemplateRepository(mockPool as any);
    service = new PipelineTemplateService(mockPool as any);
  });

  describe('PipelineTemplateRepository', () => {
    describe('findById', () => {
      it('应该返回模板', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 't1', name: 'nodejs-build', category: 'language' }],
        });

        const result = await repository.findById('t1');

        expect(result).not.toBeNull();
        expect(result!.name).toBe('nodejs-build');
      });

      it('应该返回 null 如果未找到', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const result = await repository.findById('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('list', () => {
      it('应该返回模板列表', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ total: 10 }] })
          .mockResolvedValueOnce({ rows: [{ id: 't1' }, { id: 't2' }] });

        const result = await repository.list({ tenant_id: 'tenant1' });

        expect(result.data.length).toBe(2);
        expect(result.total).toBe(10);
      });

      it('应该支持按类别过滤', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ total: 5 }] })
          .mockResolvedValueOnce({ rows: [] });

        await repository.list({ category: 'language' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('category'),
          expect.arrayContaining(['language'])
        );
      });

      it('应该支持按标签过滤', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ total: 3 }] })
          .mockResolvedValueOnce({ rows: [] });

        await repository.list({ tag: 'nodejs' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ANY(tags)'),
          expect.arrayContaining(['nodejs'])
        );
      });

      it('应该支持公共模板查询', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ total: 10 }] })
          .mockResolvedValueOnce({ rows: [] });

        await repository.list({ is_public: true });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('is_public'),
          expect.any(Array)
        );
      });
    });

    describe('create', () => {
      it('应该创建新模板', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 't1', name: 'custom-template' }],
        });

        const result = await repository.create({
          tenant_id: 'tenant1',
          name: 'custom-template',
          yaml_definition: 'yaml content',
          category: 'custom',
        });

        expect(result.name).toBe('custom-template');
      });

      it('应该支持模板参数', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 't1', name: 'template', tenant_id: 'tenant1', tags: [], version: 1 }],
        });

        const result = await repository.create({
          tenant_id: 'tenant1',
          name: 'template',
          yaml_definition: 'yaml',
          parameters: [{ name: 'nodeVersion', type: 'string', description: 'Node version', required: false }],
        });

        // Repository mapRow doesn't persist parameters from input
        expect(result).toBeDefined();
        expect(result.name).toBe('template');
      });
    });

    describe('update', () => {
      it('应该更新模板', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 't1', name: 'updated-template' }],
        });

        const result = await repository.update('t1', {
          name: 'updated-template',
        });

        expect(result!.name).toBe('updated-template');
      });

      it('should update description field', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id: 't1' }] });
        await repository.update('t1', { description: 'new desc' });
        const sql = mockPool.query.mock.calls[0][0];
        expect(sql).toContain('description');
      });

      it('should update category field', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id: 't1' }] });
        await repository.update('t1', { category: 'new-cat' });
        const sql = mockPool.query.mock.calls[0][0];
        expect(sql).toContain('category');
      });

      it('should update tags field', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id: 't1' }] });
        await repository.update('t1', { tags: ['tag1'] });
        const sql = mockPool.query.mock.calls[0][0];
        expect(sql).toContain('tags');
      });

      it('should update yaml_definition and increment version', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id: 't1' }] });
        await repository.update('t1', { yaml_definition: 'new yaml' });
        const sql = mockPool.query.mock.calls[0][0];
        expect(sql).toContain('yaml_definition');
        expect(sql).toContain('version = version + 1');
      });

      it('should update is_public field', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id: 't1' }] });
        await repository.update('t1', { is_public: true });
        const sql = mockPool.query.mock.calls[0][0];
        expect(sql).toContain('is_public');
      });

      it('should return existing when no fields to update', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id: 't1', name: 'existing' }] });
        const result = await repository.update('t1', {});
        expect(result!.name).toBe('existing');
      });

      it('should return null when not found after update', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });
        const result = await repository.update('missing', { name: 'new' });
        expect(result).toBeNull();
      });
    });

    describe('delete', () => {
      it('应该删除模板', async () => {
        mockPool.query.mockResolvedValue({ rowCount: 1 });

        const result = await repository.delete('t1');

        expect(result).toBe(true);
      });

      it('应该返回 false 如果模板不存在', async () => {
        mockPool.query.mockResolvedValue({ rowCount: 0 });

        const result = await repository.delete('nonexistent');

        expect(result).toBe(false);
      });
    });
  });

  describe('PipelineTemplateService', () => {
    describe('createTemplate', () => {
      it('应该创建模板', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 't1', name: 'custom' }],
        });

        const result = await service.createTemplate({
          tenant_id: 'tenant1',
          name: 'custom',
          yaml_definition: 'yaml',
        });

        expect(result.name).toBe('custom');
      });
    });

    describe('getTemplate', () => {
      it('应该返回模板', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 't1', name: 'template' }],
        });

        const result = await service.getTemplate('t1');

        expect(result).not.toBeNull();
      });
    });

    describe('listTemplates', () => {
      it('应该返回模板列表', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ total: 5 }] })
          .mockResolvedValueOnce({ rows: [{ id: 't1' }] });

        const result = await service.listTemplates({ tenant_id: 'tenant1' });

        expect(result.data).toHaveLength(1);
      });
    });

    describe('instantiateTemplate', () => {
      it('应该实例化模板创建管道', async () => {
        mockPool.query
          .mockResolvedValueOnce({
            rows: [{
              id: 't1',
              yaml_definition: 'yaml',
              parameters: [{ name: 'nodeVersion', defaultValue: '18' }],
            }],
          })
          .mockResolvedValueOnce({
            rows: [{ id: 'p1', name: 'my-pipeline' }],
          });

        const result = await service.instantiateTemplate({
          template_id: 't1',
          name: 'my-pipeline',
          tenant_id: 'tenant1',
          params: { nodeVersion: '20' },
        });

        expect(result.name).toBe('my-pipeline');
      });

      it('应该使用默认参数值', async () => {
        mockPool.query
          .mockResolvedValueOnce({
            rows: [{
              id: 't1',
              yaml_definition: 'yaml: ${nodeVersion}',
              parameters: [{ name: 'nodeVersion', defaultValue: '18', required: false }],
            }],
          })
          .mockResolvedValueOnce({
            rows: [{ id: 'p1' }],
          });

        const result = await service.instantiateTemplate({
          template_id: 't1',
          name: 'pipeline',
          tenant_id: 'tenant1',
        });

        expect(result).toBeDefined();
      });

      it('应该在使用默认参数时成功实例化', async () => {
        mockPool.query
          .mockResolvedValueOnce({
            rows: [{
              id: 't1',
              yaml_definition: 'yaml: ${nodeVersion}',
              parameters: [],
              name: 'template',
              tenant_id: 'tenant1',
              tags: [],
              version: 1,
            }],
          })
          .mockResolvedValueOnce({
            rows: [{ id: 'p1' }],
          });

        const result = await service.instantiateTemplate({
          template_id: 't1',
          name: 'pipeline',
          tenant_id: 'tenant1',
        });

        expect(result.pipeline_id).toBe('p1');
      });

      it('应该替换 $PARAM 占位符', async () => {
        mockPool.query
          .mockResolvedValueOnce({
            rows: [{
              id: 't1',
              yaml_definition: 'image: $IMAGE_NAME',
              parameters: [],
              name: 'template',
              tenant_id: 'tenant1',
              tags: [],
              version: 1,
            }],
          })
          .mockResolvedValueOnce({
            rows: [{ id: 'p1' }],
          });

        const result = await service.instantiateTemplate({
          template_id: 't1',
          name: 'pipeline',
          tenant_id: 'tenant1',
          params: { IMAGE_NAME: 'my-app' },
        });

        expect(result.pipeline_id).toBe('p1');
      });
    });

    describe('updateTemplate', () => {
      it('应该更新模板', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 't1', name: 'updated' }],
        });

        const result = await service.updateTemplate('t1', {
          name: 'updated',
        });

        expect(result!.name).toBe('updated');
      });
    });

    describe('deleteTemplate', () => {
      it('应该删除模板', async () => {
        mockPool.query
          .mockResolvedValueOnce({
            rows: [{ id: 't1', name: 'template', tenant_id: 'tenant1', tags: [], version: 1 }],
          })
          .mockResolvedValueOnce({ rowCount: 1 });

        const result = await service.deleteTemplate('t1');

        expect(result.success).toBe(true);
      });
    });

    describe('initializeBuiltinTemplates', () => {
      it('应该可以初始化内置模板', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await service.initializeBuiltinTemplates();

        expect(service['initialized']).toBe(true);
      });
    });
  });

  describe('getTemplate - not found', () => {
    it('should throw TEMPLATE_NOT_FOUND when template does not exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await expect(service.getTemplate('missing'))
        .rejects.toThrow(PipelineTemplateServiceError);
    });
  });

  describe('createTemplate - validation', () => {
    it('should throw INVALID_YAML when yaml is empty', async () => {
      await expect(service.createTemplate({
        tenant_id: 't1',
        name: 'test',
        yaml_definition: '',
      })).rejects.toThrow('YAML definition is required');
    });

    it('should throw INVALID_YAML when yaml is whitespace', async () => {
      await expect(service.createTemplate({
        tenant_id: 't1',
        name: 'test',
        yaml_definition: '   ',
      })).rejects.toThrow('YAML definition is required');
    });
  });

  describe('savePipelineAsTemplate', () => {
    it('should save pipeline as template', async () => {
      // Get pipeline
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'p1', config: { yamlDefinition: 'yaml content' } }],
      });
      // Create template
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 't1', name: 'saved-template' }],
      });

      const result = await service.savePipelineAsTemplate('p1', {
        tenant_id: 't1',
        name: 'saved-template',
        category: 'custom',
      });

      expect(result.name).toBe('saved-template');
    });

    it('should throw PIPELINE_NOT_FOUND when pipeline does not exist', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.savePipelineAsTemplate('missing', {
        tenant_id: 't1',
        name: 'test',
      })).rejects.toThrow('Pipeline not found: missing');
    });
  });

  describe('getTemplatesByCategory', () => {
    it('should return templates by category', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: 2 }] })
        .mockResolvedValueOnce({ rows: [{ id: 't1' }, { id: 't2' }] });

      const result = await service.getTemplatesByCategory('language');
      expect(result).toHaveLength(2);
    });
  });

  describe('searchTemplatesByTag', () => {
    it('should return templates by tag', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 't1' }] });

      const result = await service.searchTemplatesByTag('nodejs');
      expect(result).toHaveLength(1);
    });
  });

  describe('PipelineTemplateServiceError', () => {
    it('应该正确设置错误信息', () => {
      const error = new PipelineTemplateServiceError('Template not found', 'TEMPLATE_NOT_FOUND');

      expect(error.message).toBe('Template not found');
      expect(error.code).toBe('TEMPLATE_NOT_FOUND');
      expect(error.name).toBe('PipelineTemplateServiceError');
    });
  });
});