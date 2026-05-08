/**
 * ArtifactService 单元测试
 */

import * as fs from 'fs';
import * as path from 'path';
import { ArtifactService } from '../ArtifactService';

describe('ArtifactService', () => {
  const testBaseDir = '/tmp/orion-test-artifacts';
  let service: ArtifactService;

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
    service = new ArtifactService(testBaseDir);
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  describe('upload', () => {
    it('should upload a buffer artifact', async () => {
      const result = await service.upload({
        runId: 'run-1',
        stageId: 'stage-1',
        name: 'build-output.tar',
        data: Buffer.from('test data'),
      });

      expect(result.name).toBe('build-output.tar');
      expect(result.runId).toBe('run-1');
      expect(result.stageId).toBe('stage-1');
      expect(result.size).toBe(9);
      expect(fs.existsSync(result.filePath)).toBe(true);
    });

    it('should upload a string artifact', async () => {
      const result = await service.upload({
        runId: 'run-1',
        stageId: 'stage-1',
        name: 'config.json',
        data: '{"key": "value"}',
        mimeType: 'application/json',
      });

      expect(result.name).toBe('config.json');
      expect(result.mimeType).toBe('application/json');
      expect(result.size).toBe(16);
    });

    it('should sanitize file names', async () => {
      const result = await service.upload({
        runId: 'run-1',
        stageId: 'stage-1',
        name: 'my artifact (special).txt',
        data: 'test',
      });

      expect(result.filePath).toContain('my_artifact__special_.txt');
    });
  });

  describe('download', () => {
    it('should download a buffer artifact', async () => {
      await service.upload({
        runId: 'run-1',
        stageId: 'stage-1',
        name: 'data.bin',
        data: Buffer.from([1, 2, 3, 4]),
      });

      const result = await service.download('run-1', 'stage-1', 'data.bin');
      expect(result).not.toBeNull();
      expect(result!).toEqual(Buffer.from([1, 2, 3, 4]));
    });

    it('should download as text', async () => {
      await service.upload({
        runId: 'run-1',
        stageId: 'stage-1',
        name: 'log.txt',
        data: 'Hello World',
      });

      const result = await service.downloadText('run-1', 'stage-1', 'log.txt');
      expect(result).toBe('Hello World');
    });

    it('should return null for non-existent artifact', async () => {
      const result = await service.download('run-1', 'stage-1', 'missing');
      expect(result).toBeNull();
    });
  });

  describe('listByRun', () => {
    it('should list all artifacts for a run', async () => {
      await service.upload({ runId: 'run-1', stageId: 'stage-1', name: 'a.txt', data: 'a' });
      await service.upload({ runId: 'run-1', stageId: 'stage-1', name: 'b.txt', data: 'b' });
      await service.upload({ runId: 'run-1', stageId: 'stage-2', name: 'c.txt', data: 'c' });
      await service.upload({ runId: 'run-2', stageId: 'stage-1', name: 'd.txt', data: 'd' });

      const results = service.listByRun('run-1');
      expect(results.length).toBe(3);
      expect(results.map(r => r.name)).toContain('a.txt');
      expect(results.map(r => r.name)).toContain('b.txt');
      expect(results.map(r => r.name)).toContain('c.txt');
    });

    it('should return empty for unknown run', () => {
      expect(service.listByRun('unknown')).toEqual([]);
    });
  });

  describe('listByStage', () => {
    it('should list artifacts for a specific stage', async () => {
      await service.upload({ runId: 'run-1', stageId: 'stage-1', name: 'a.txt', data: 'a' });
      await service.upload({ runId: 'run-1', stageId: 'stage-2', name: 'b.txt', data: 'b' });

      const results = service.listByStage('run-1', 'stage-1');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('a.txt');
    });
  });

  describe('getMetadata', () => {
    it('should return metadata without file path', async () => {
      await service.upload({
        runId: 'run-1',
        stageId: 'stage-1',
        name: 'test.txt',
        data: 'hello',
        description: 'test artifact',
      });

      const meta = service.getMetadata('run-1', 'stage-1', 'test.txt');
      expect(meta).not.toBeNull();
      expect(meta!.name).toBe('test.txt');
      expect(meta!.description).toBe('test artifact');
      expect(meta).not.toHaveProperty('filePath');
    });

    it('should return null for unknown artifact', () => {
      expect(service.getMetadata('run-1', 'stage-1', 'missing')).toBeNull();
    });
  });

  describe('passToStage', () => {
    it('should pass all artifacts from one stage to another', async () => {
      await service.upload({ runId: 'run-1', stageId: 'stage-a', name: 'build.tar', data: 'build-data' });
      await service.upload({ runId: 'run-1', stageId: 'stage-a', name: 'report.txt', data: 'report' });

      const result = await service.passToStage('run-1', 'stage-a', 'stage-b');
      expect(result.passed).toBe(2);
      expect(result.errors).toEqual([]);

      // Verify the passed artifacts are available in the target stage
      const targetArtifacts = service.listByStage('run-1', 'stage-b');
      expect(targetArtifacts.length).toBe(2);
    });

    it('should pass only specified artifacts', async () => {
      await service.upload({ runId: 'run-1', stageId: 'stage-a', name: 'build.tar', data: 'build' });
      await service.upload({ runId: 'run-1', stageId: 'stage-a', name: 'report.txt', data: 'report' });

      const result = await service.passToStage('run-1', 'stage-a', 'stage-b', ['build.tar']);
      expect(result.passed).toBe(1);

      const targetArtifacts = service.listByStage('run-1', 'stage-b');
      expect(targetArtifacts.length).toBe(1);
      expect(targetArtifacts[0].name).toBe('build.tar');
    });

    it('should handle empty source stage', async () => {
      const result = await service.passToStage('run-1', 'empty-stage', 'target-stage');
      expect(result.passed).toBe(0);
      expect(result.errors).toEqual([]);
    });
  });

  describe('cleanupRun', () => {
    it('should remove all artifacts for a run', async () => {
      await service.upload({ runId: 'run-1', stageId: 'stage-1', name: 'a.txt', data: 'a' });
      await service.upload({ runId: 'run-1', stageId: 'stage-2', name: 'b.txt', data: 'b' });

      service.cleanupRun('run-1');

      expect(service.listByRun('run-1')).toEqual([]);
      expect(fs.existsSync(path.join(testBaseDir, 'run-1'))).toBe(false);
    });
  });

  describe('getStageDir', () => {
    it('should return correct stage directory path', () => {
      const dir = service.getStageDir('run-1', 'stage-1');
      expect(dir).toBe(path.join(testBaseDir, 'run-1', 'stage-1'));
    });
  });

  describe('getArtifactPath', () => {
    it('should return the disk path for an artifact', async () => {
      await service.upload({ runId: 'run-1', stageId: 'stage-1', name: 'file.txt', data: 'data' });
      const filePath = service.getArtifactPath('run-1', 'stage-1', 'file.txt');
      expect(filePath).not.toBeNull();
      expect(fs.existsSync(filePath!)).toBe(true);
    });

    it('should return null for unknown artifact', () => {
      expect(service.getArtifactPath('run-1', 'stage-1', 'missing')).toBeNull();
    });
  });
});
