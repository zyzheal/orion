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
          rows: [{ id: 't1', parameters: [{ name: 'nodeVersion' }] }],
        });

        const result = await repository.create({
          tenant_id: 'tenant1',
          name: 'template',
          yaml_definition: 'yaml',
          parameters: [{ name: 'nodeVersion', type: 'string', description: 'Node version', required: false }],
        });

        expect(result.parameters).toHaveLength(1);
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

      it('应该验证必需参数', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 't1',
            yaml_definition: 'yaml',
            parameters: [{ name: 'requiredParam', required: true }],
          }],
        });

        await expect(service.instantiateTemplate({
          template_id: 't1',
          name: 'pipeline',
          tenant_id: 'tenant1',
        })).rejects.toThrow();
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
        mockPool.query.mockResolvedValue({ rowCount: 1 });

        const result = await service.deleteTemplate('t1');

        expect(result).toBe(true);
      });
    });

    describe('getBuiltinTemplates', () => {
      it('应该返回内置模板列表', () => {
        const result = service.getBuiltinTemplates();

        expect(result.length).toBeGreaterThan(0);
        expect(result.some(t => t.name.includes('Node.js'))).toBe(true);
      });
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