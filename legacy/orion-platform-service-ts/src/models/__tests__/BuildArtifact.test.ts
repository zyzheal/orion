/**
 * BuildArtifact (Build Artifact) 模型测试
 */
import {
  createArtifact,
  recordArtifactDownload,
  ArtifactType,
  ArtifactStorageType,
} from '../BuildArtifact';

describe('BuildArtifact', () => {
  describe('ArtifactType enum', () => {
    it('should have all expected values', () => {
      expect(ArtifactType.BUILD_OUTPUT).toBe('build-output');
      expect(ArtifactType.TEST_RESULT).toBe('test-result');
      expect(ArtifactType.COVERAGE_REPORT).toBe('coverage-report');
      expect(ArtifactType.LOG_FILE).toBe('log-file');
      expect(ArtifactType.OTHER).toBe('other');
    });
  });

  describe('ArtifactStorageType enum', () => {
    it('should have all expected values', () => {
      expect(ArtifactStorageType.LOCAL).toBe('local');
      expect(ArtifactStorageType.S3).toBe('s3');
    });
  });

  describe('createArtifact', () => {
    it('should create artifact with required fields', () => {
      const artifact = createArtifact({
        name: 'build-output.jar',
        storagePath: '/artifacts/build-output.jar',
        size: 1024,
        runId: 'run-1',
      });

      expect(artifact.id).toBeDefined();
      expect(artifact.name).toBe('build-output.jar');
      expect(artifact.type).toBe(ArtifactType.OTHER);
      expect(artifact.storageType).toBe(ArtifactStorageType.LOCAL);
      expect(artifact.downloadedCount).toBe(0);
      expect(artifact.createdAt).toBeInstanceOf(Date);
      expect(artifact.updatedAt).toBeInstanceOf(Date);
    });

    it('should accept custom type and storageType', () => {
      const artifact = createArtifact({
        name: 'report.html',
        type: ArtifactType.TEST_RESULT,
        storageType: ArtifactStorageType.S3,
        storagePath: 's3://bucket/report.html',
        size: 2048,
        runId: 'run-1',
      });

      expect(artifact.type).toBe(ArtifactType.TEST_RESULT);
      expect(artifact.storageType).toBe(ArtifactStorageType.S3);
    });

    it('should accept optional fields', () => {
      const artifact = createArtifact({
        name: 'file',
        storagePath: '/path',
        size: 100,
        runId: 'run-1',
        stageId: 'stage-1',
        checksum: 'abc123',
        expiresAt: new Date('2030-01-01'),
        metadata: { key: 'value' },
      });

      expect(artifact.stageId).toBe('stage-1');
      expect(artifact.checksum).toBe('abc123');
      expect(artifact.expiresAt).toBeDefined();
      expect(artifact.metadata).toEqual({ key: 'value' });
    });
  });

  describe('recordArtifactDownload', () => {
    it('should increment downloadedCount', () => {
      const artifact = createArtifact({
        name: 'file',
        storagePath: '/path',
        size: 100,
        runId: 'run-1',
      });

      const updated = recordArtifactDownload(artifact);
      expect(updated.downloadedCount).toBe(1);
      expect(updated.id).toBe(artifact.id);
    });

    it('should increment multiple times', () => {
      let artifact = createArtifact({
        name: 'file',
        storagePath: '/path',
        size: 100,
        runId: 'run-1',
      });

      artifact = recordArtifactDownload(artifact);
      artifact = recordArtifactDownload(artifact);
      artifact = recordArtifactDownload(artifact);

      expect(artifact.downloadedCount).toBe(3);
    });
  });
});
