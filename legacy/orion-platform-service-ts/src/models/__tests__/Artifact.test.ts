/**
 * Artifact (Artifact Registry) 模型测试
 */
import {
  ArtifactType,
  ArtifactStatus,
  CreateArtifactInput,
} from '../Artifact';

describe('Artifact (Registry)', () => {
  describe('ArtifactType enum', () => {
    it('should have all expected values', () => {
      expect(ArtifactType.DOCKER_IMAGE).toBe('DOCKER_IMAGE');
      expect(ArtifactType.HELM_CHART).toBe('HELM_CHART');
      expect(ArtifactType.FUNCTION_PACKAGE).toBe('FUNCTION_PACKAGE');
      expect(ArtifactType.MODEL_FILE).toBe('MODEL_FILE');
      expect(ArtifactType.PLUGIN_PACKAGE).toBe('PLUGIN_PACKAGE');
      expect(ArtifactType.CONFIG_FILE).toBe('CONFIG_FILE');
      expect(ArtifactType.BUILD_OUTPUT).toBe('BUILD_OUTPUT');
      expect(ArtifactType.TEST_REPORT).toBe('TEST_REPORT');
    });
  });

  describe('ArtifactStatus enum', () => {
    it('should have all expected values', () => {
      expect(ArtifactStatus.UPLOADING).toBe('UPLOADING');
      expect(ArtifactStatus.AVAILABLE).toBe('AVAILABLE');
      expect(ArtifactStatus.DEPRECATED).toBe('DEPRECATED');
      expect(ArtifactStatus.DELETED).toBe('DELETED');
      expect(ArtifactStatus.QUARANTINED).toBe('QUARANTINED');
    });
  });

  describe('type compatibility', () => {
    it('should accept valid CreateArtifactInput', () => {
      const input: CreateArtifactInput = {
        name: 'my-image',
        namespace: 'default',
        version: '1.0.0',
        type: ArtifactType.DOCKER_IMAGE,
        sizeBytes: 1024,
        storagePath: '/storage/my-image',
        createdBy: 'user1',
      };

      expect(input.type).toBe(ArtifactType.DOCKER_IMAGE);
      expect(input.name).toBe('my-image');
    });

    it('should accept optional fields', () => {
      const input: CreateArtifactInput = {
        name: 'artifact',
        namespace: 'ns',
        version: '1.0',
        type: ArtifactType.HELM_CHART,
        sizeBytes: 2048,
        storagePath: '/path',
        createdBy: 'admin',
        checksumSha256: 'sha256:abc',
        checksumSha512: 'sha512:def',
        metadata: { key: 'value' },
      };

      expect(input.checksumSha256).toBe('sha256:abc');
      expect(input.metadata).toEqual({ key: 'value' });
    });
  });
});
