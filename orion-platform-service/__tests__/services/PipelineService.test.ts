/**
 * PipelineService 单元测试
 */

import { PipelineService } from '@/services/pipeline/PipelineService';
import { PipelineStatus } from '@/models/Pipeline';

describe('PipelineService', () => {
  let service: PipelineService;

  const validPipelineYaml = `
apiVersion: orion.io/v1
kind: Pipeline
metadata:
  name: test-pipeline
  version: "1.0.0"
  description: Test Pipeline
spec:
  triggers:
    - type: api
  stages:
    - name: build
      runsOn: linux
      steps:
        - name: checkout
          uses: git/checkout@v1
        - name: compile
          uses: npm/run@v1
          with:
            command: build
    - name: test
      runsOn: linux
      dependsOn: [build]
      steps:
        - name: unit-test
          uses: npm/test@v1
  `;

  const invalidPipelineYaml = `
apiVersion: orion.io/v1
kind: Pipeline
metadata:
  name: invalid-pipeline
  version: "1.0.0"
spec:
  # Missing stages
  `;

  beforeEach(() => {
    service = new PipelineService();
  });

  describe('create', () => {
    it('should create a valid pipeline', async () => {
      const pipeline = await service.create({
        name: 'test-pipeline',
        version: '1.0.0',
        description: 'Test Pipeline',
        yamlDefinition: validPipelineYaml,
        createdBy: 'test-user',
      });

      expect(pipeline.id).toBeDefined();
      expect(pipeline.name).toBe('test-pipeline');
      expect(pipeline.version).toBe('1.0.0');
      expect(pipeline.status).toBe(PipelineStatus.ACTIVE);
    });

    it('should reject pipeline with missing stages', async () => {
      await expect(
        service.create({
          name: 'invalid-pipeline',
          version: '1.0.0',
          yamlDefinition: invalidPipelineYaml,
        })
      ).rejects.toThrow('Pipeline validation failed');
    });

    it('should reject duplicate pipeline', async () => {
      await service.create({
        name: 'duplicate-pipeline',
        version: '1.0.0',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'duplicate-pipeline'),
      });

      await expect(
        service.create({
          name: 'duplicate-pipeline',
          version: '1.0.0',
          yamlDefinition: validPipelineYaml.replace('test-pipeline', 'duplicate-pipeline'),
        })
      ).rejects.toThrow('already exists');
    });

    it('should allow same name with different version', async () => {
      const pipeline1 = await service.create({
        name: 'multi-version-pipeline',
        version: '1.0.0',
        yamlDefinition: validPipelineYaml
          .replace('test-pipeline', 'multi-version-pipeline')
          .replace('version: "1.0.0"', 'version: "1.0.0"'),
      });

      const pipeline2 = await service.create({
        name: 'multi-version-pipeline',
        version: '2.0.0',
        yamlDefinition: validPipelineYaml
          .replace('test-pipeline', 'multi-version-pipeline')
          .replace('version: "1.0.0"', 'version: "2.0.0"'),
      });

      expect(pipeline1.id).not.toBe(pipeline2.id);
      expect(pipeline1.version).toBe('1.0.0');
      expect(pipeline2.version).toBe('2.0.0');
    });
  });

  describe('getById', () => {
    it('should get pipeline by id', async () => {
      const created = await service.create({
        name: 'get-test-pipeline',
        version: '1.0.0',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'get-test-pipeline'),
      });

      const found = await service.getById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.spec).toBeDefined();
    });

    it('should return null for deleted pipeline', async () => {
      const created = await service.create({
        name: 'delete-test-pipeline',
        version: '1.0.0',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'delete-test-pipeline'),
      });

      await service.delete(created.id);

      const found = await service.getById(created.id);
      expect(found).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all pipelines', async () => {
      await service.create({
        name: 'list-test-1',
        version: '1.0.0',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'list-test-1'),
      });

      await service.create({
        name: 'list-test-2',
        version: '1.0.0',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'list-test-2'),
      });

      const pipelines = await service.list();

      expect(pipelines.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by name', async () => {
      await service.create({
        name: 'filter-test',
        version: '1.0.0',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'filter-test'),
      });

      const pipelines = await service.list({ name: 'filter-test' });

      expect(pipelines.every( (p: any) => p.name === 'filter-test')).toBe(true);
    });
  });

  describe('update', () => {
    it('should update pipeline description', async () => {
      const pipeline = await service.create({
        name: 'update-test',
        version: '1.0.0',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'update-test'),
      });

      const updated = await service.update(pipeline.id, {
        description: 'Updated description',
      });

      expect(updated?.description).toBe('Updated description');
    });

    it('should not allow changing name or version', async () => {
      const pipeline = await service.create({
        name: 'no-change-test',
        version: '1.0.0',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'no-change-test'),
      });

      const newYaml = validPipelineYaml
        .replace('test-pipeline', 'different-name')
        .replace('version: "1.0.0"', 'version: "2.0.0"');

      await expect(
        service.update(pipeline.id, { yamlDefinition: newYaml })
      ).rejects.toThrow('Cannot change pipeline name or version');
    });
  });

  describe('delete', () => {
    it('should delete pipeline', async () => {
      const pipeline = await service.create({
        name: 'delete-final-test',
        version: '1.0.0',
        yamlDefinition: validPipelineYaml.replace('test-pipeline', 'delete-final-test'),
      });

      const deleted = await service.delete(pipeline.id);
      expect(deleted).toBe(true);

      const found = await service.getById(pipeline.id);
      expect(found).toBeNull();
    });
  });

  describe('validate', () => {
    it('should validate correct pipeline YAML', async () => {
      const result = await service.validate(validPipelineYaml);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing stages', async () => {
      const result = await service.validate(invalidPipelineYaml);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid stage dependencies', async () => {
      const yamlWithBadDeps = `
apiVersion: orion.io/v1
kind: Pipeline
metadata:
  name: bad-deps
  version: "1.0.0"
spec:
  stages:
    - name: build
      runsOn: linux
      steps:
        - name: checkout
          uses: git/checkout@v1
    - name: test
      runsOn: linux
      dependsOn: [nonexistent]
      steps:
        - name: unit-test
          uses: npm/test@v1
      `;

      const result = await service.validate(yamlWithBadDeps);

      expect(result.valid).toBe(false);
      expect(result.errors.some( (e: any) => e.includes('unknown stage'))).toBe(true);
    });
  });
});
