/**
 * ArtifactVersion 模型测试
 */
import { createArtifactVersion } from '../ArtifactVersion';

describe('ArtifactVersion', () => {
  describe('createArtifactVersion', () => {
    it('should create version with required fields', () => {
      const version = createArtifactVersion({
        tenantId: 't1',
        pipelineId: 'p1',
        runId: 'r1',
        stageName: 'build',
        artifactName: 'app.jar',
        version: '1.2.3',
        storagePath: '/artifacts/app.jar',
      });

      expect(version.id).toBeDefined();
      expect(version.tenantId).toBe('t1');
      expect(version.pipelineId).toBe('p1');
      expect(version.runId).toBe('r1');
      expect(version.stageName).toBe('build');
      expect(version.artifactName).toBe('app.jar');
      expect(version.version).toBe('1.2.3');
      expect(version.storagePath).toBe('/artifacts/app.jar');
      expect(version.metadata).toEqual({});
      expect(version.tags).toEqual([]);
      expect(version.createdAt).toBeInstanceOf(Date);
    });

    it('should accept optional fields', () => {
      const version = createArtifactVersion({
        tenantId: 't1',
        pipelineId: 'p1',
        runId: 'r1',
        stageName: 'build',
        artifactName: 'app.jar',
        version: '1.0.0',
        storagePath: '/artifacts/app.jar',
        commitSha: 'abc123',
        branch: 'main',
        metadata: { image: 'nginx:latest' },
        tags: ['latest', 'stable'],
      });

      expect(version.commitSha).toBe('abc123');
      expect(version.branch).toBe('main');
      expect(version.metadata).toEqual({ image: 'nginx:latest' });
      expect(version.tags).toEqual(['latest', 'stable']);
    });
  });
});
