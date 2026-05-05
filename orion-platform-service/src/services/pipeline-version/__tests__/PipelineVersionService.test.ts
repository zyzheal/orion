/**
 * PipelineVersionService 单元测试
 */

import { PipelineVersionService, PipelineVersionRepository, PipelineVersionServiceError } from '../PipelineVersionService';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('PipelineVersionService', () => {
  let service: PipelineVersionService;
  let repository: PipelineVersionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PipelineVersionRepository(mockPool as any);
    service = new PipelineVersionService(mockPool as any);
  });

  describe('PipelineVersionRepository', () => {
    describe('create', () => {
      it('应该创建新的管道版本', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ next_version: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 'v1', pipeline_id: 'p1', version: 1 }] });

        const input = {
          tenant_id: 'tenant1',
          pipeline_id: 'pipeline1',
          yaml_definition: 'yaml content',
        };

        const result = await repository.create(input);

        expect(result.pipeline_id).toBe('pipeline1');
        expect(result.version).toBe(1);
      });

      it('应该自动递增版本号', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ next_version: 5 }] })
          .mockResolvedValueOnce({ rows: [{ id: 'v5', version: 5 }] });

        const result = await repository.create({
          tenant_id: 'tenant1',
          pipeline_id: 'pipeline1',
          yaml_definition: 'yaml',
        });

        expect(result.version).toBe(5);
      });
    });

    describe('findById', () => {
      it('应该返回找到的版本', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'v1', pipeline_id: 'p1', version: 1 }],
        });

        const result = await repository.findById('v1');

        expect(result).not.toBeNull();
        expect(result!.id).toBe('v1');
      });

      it('应该返回 null 如果未找到', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const result = await repository.findById('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('findByPipelineAndVersion', () => {
      it('应该根据 pipeline_id 和 version 查找', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'v1', pipeline_id: 'p1', version: 1 }],
        });

        const result = await repository.findByPipelineAndVersion('p1', 1);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('pipeline_id = $1 AND version = $2'),
          ['p1', 1]
        );
      });
    });

    describe('list', () => {
      it('应该返回版本列表和总数', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ total: 10 }] })
          .mockResolvedValueOnce({ rows: [{ id: 'v1' }, { id: 'v2' }] });

        const result = await repository.list({ pipeline_id: 'p1' });

        expect(result.data.length).toBe(2);
        expect(result.total).toBe(10);
      });

      it('应该支持分页', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ total: 100 }] })
          .mockResolvedValueOnce({ rows: [] });

        await repository.list({ pipeline_id: 'p1', page: 2, limit: 10 });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('OFFSET'),
          expect.arrayContaining(['p1', 10, 10])
        );
      });

      it('应该支持按标签过滤', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ total: 5 }] })
          .mockResolvedValueOnce({ rows: [] });

        await repository.list({ pipeline_id: 'p1', tag: 'release' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ANY(tags)'),
          expect.arrayContaining(['p1', 'release'])
        );
      });
    });

    describe('addTag', () => {
      it('应该添加标签', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ tags: ['release', 'stable'] }],
        });

        const result = await repository.addTag('v1', 'stable');

        expect(result).toContain('stable');
      });

      it('不应该重复添加标签', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ tags: ['release'] }],
        });

        await repository.addTag('v1', 'release');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('NOT ($2 = ANY(tags))'),
          ['v1', 'release']
        );
      });
    });

    describe('removeTag', () => {
      it('应该移除标签', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ tags: ['stable'] }],
        });

        const result = await repository.removeTag('v1', 'release');

        expect(result).not.toContain('release');
      });
    });

    describe('setBaseline', () => {
      it('应该设置基准版本', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [] }) // Clear existing baseline
          .mockResolvedValueOnce({ rows: [{ id: 'v1' }] });

        const result = await repository.setBaseline('p1', 'v1', true);

        expect(result).toBe(true);
      });

      it('应该清除现有基准', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await repository.setBaseline('p1', 'v1', false);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('is_baseline = false'),
          ['p1']
        );
      });
    });
  });

  describe('PipelineVersionService', () => {
    describe('createVersion', () => {
      it('应该创建版本并返回结果', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ next_version: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 'v1', version: 1, tags: [] }] });

        const result = await service.createVersion({
          tenant_id: 'tenant1',
          pipeline_id: 'p1',
          yaml_definition: 'yaml',
        });

        expect(result.version).toBe(1);
      });
    });

    describe('getVersion', () => {
      it('应该返回指定版本', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'v1', version: 1 }],
        });

        const result = await service.getVersion('v1');

        expect(result).not.toBeNull();
        expect(result!.id).toBe('v1');
      });
    });

    describe('listVersions', () => {
      it('应该返回版本列表', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ total: 5 }] })
          .mockResolvedValueOnce({ rows: [{ id: 'v1' }] });

        const result = await service.listVersions('p1');

        expect(result.data).toHaveLength(1);
        expect(result.total).toBe(5);
      });
    });

    describe('compareVersions', () => {
      it('应该返回版本差异', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ yaml_definition: 'old yaml', spec: {} }] })
          .mockResolvedValueOnce({ rows: [{ yaml_definition: 'new yaml', spec: {} }] });

        const result = await service.compareVersions('v1', 'v2');

        expect(result).toHaveProperty('additions');
        expect(result).toHaveProperty('deletions');
        expect(result).toHaveProperty('modifications');
        expect(result).toHaveProperty('summary');
      });
    });

    describe('rollback', () => {
      it('应该回滚到指定版本', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'v1', yaml_definition: 'yaml' }],
        });

        const result = await service.rollback('v1');

        expect(result.id).toBe('v1');
      });
    });

    describe('tagVersion', () => {
      it('应该为版本添加标签', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ tags: ['release'] }],
        });

        const result = await service.tagVersion('v1', 'release');

        expect(result).toContain('release');
      });
    });

    describe('setBaseline', () => {
      it('应该设置基准版本', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ id: 'v1' }] });

        const result = await service.setBaseline('p1', 'v1');

        expect(result).toBe(true);
      });
    });
  });

  describe('PipelineVersionServiceError', () => {
    it('应该正确设置错误信息', () => {
      const error = new PipelineVersionServiceError('Version not found', 'VERSION_NOT_FOUND');

      expect(error.message).toBe('Version not found');
      expect(error.code).toBe('VERSION_NOT_FOUND');
      expect(error.name).toBe('PipelineVersionServiceError');
    });
  });
});