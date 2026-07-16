/**
 * Pipeline 模型测试
 */
import { createPipeline, PipelineStatus } from '../Pipeline';

describe('Pipeline', () => {
  describe('PipelineStatus enum', () => {
    it('should have correct values', () => {
      expect(PipelineStatus.ACTIVE).toBe('active');
      expect(PipelineStatus.INACTIVE).toBe('inactive');
      expect(PipelineStatus.DELETED).toBe('deleted');
    });
  });

  describe('createPipeline', () => {
    it('should create pipeline with required fields', () => {
      const pipeline = createPipeline({
        name: 'ci-pipeline',
        version: '1.0.0',
        yamlDefinition: 'apiVersion: v1\nkind: Pipeline',
      });

      expect(pipeline.id).toBeDefined();
      expect(pipeline.name).toBe('ci-pipeline');
      expect(pipeline.version).toBe('1.0.0');
      expect(pipeline.yamlDefinition).toContain('Pipeline');
      expect(pipeline.status).toBe(PipelineStatus.ACTIVE);
      expect(pipeline.createdAt).toBeInstanceOf(Date);
      expect(pipeline.updatedAt).toBeInstanceOf(Date);
    });

    it('should accept optional fields', () => {
      const pipeline = createPipeline({
        name: 'p1',
        version: '1.0',
        yamlDefinition: 'yaml',
        description: 'A test pipeline',
        createdBy: 'admin',
      });

      expect(pipeline.description).toBe('A test pipeline');
      expect(pipeline.createdBy).toBe('admin');
    });
  });
});
