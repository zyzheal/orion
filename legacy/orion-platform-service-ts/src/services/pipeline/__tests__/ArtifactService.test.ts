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
    service = new ArtifactService({ baseDir: testBaseDir });
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
    it('should return empty when no repository configured', async () => {
      const results = await service.listByRun('run-1');
      expect(results).toEqual([]);
    });
  });

  describe('listByStage', () => {
    it('should return empty when no repository configured', async () => {
      const results = await service.listByStage('run-1', 'stage-1');
      expect(results).toEqual([]);
    });
  });

  describe('getMetadata', () => {
    it('should return null when no repository configured', async () => {
      const meta = await service.getMetadata('run-1', 'stage-1', 'test.txt');
      expect(meta).toBeNull();
    });
  });

  describe('passToStage', () => {
    it('should handle empty source stage', async () => {
      const result = await service.passToStage('run-1', 'empty-stage', 'target-stage');
      expect(result.passed).toBe(0);
      expect(result.errors).toEqual([]);
    });
  });

  describe('cleanupRun', () => {
    it('should remove run directory from filesystem', async () => {
      // Create some files first
      const stageDir = service.getStageDir('run-1', 'stage-1');
      fs.mkdirSync(stageDir, { recursive: true });
      fs.writeFileSync(path.join(stageDir, 'test.txt'), 'data');

      await service.cleanupRun('run-1');

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
    it('should return null when no repository configured', async () => {
      const filePath = await service.getArtifactPath('run-1', 'stage-1', 'missing');
      expect(filePath).toBeNull();
    });
  });
});
