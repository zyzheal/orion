/**
 * Build 模型测试
 */
import { createBuild, BuildStatus } from '../Build';

describe('Build', () => {
  describe('BuildStatus enum', () => {
    it('should have all expected values', () => {
      expect(BuildStatus.PENDING).toBe('pending');
      expect(BuildStatus.RUNNING).toBe('running');
      expect(BuildStatus.SUCCESS).toBe('success');
      expect(BuildStatus.FAILED).toBe('failed');
      expect(BuildStatus.CANCELLED).toBe('cancelled');
    });
  });

  describe('createBuild', () => {
    it('should create build with required fields', () => {
      const build = createBuild({ tenantId: 't1' });

      expect(build.id).toBeDefined();
      expect(build.tenantId).toBe('t1');
      expect(build.projectId).toBeNull();
      expect(build.pipelineRunId).toBeNull();
      expect(build.image).toBeNull();
      expect(build.tag).toBeNull();
      expect(build.status).toBe(BuildStatus.PENDING);
      expect(build.sourceRef).toBeNull();
      expect(build.buildArgs).toEqual({});
      expect(build.startedAt).toBeNull();
      expect(build.completedAt).toBeNull();
      expect(build.durationMs).toBeNull();
      expect(build.errorMessage).toBeNull();
      expect(build.createdAt).toBeInstanceOf(Date);
    });

    it('should accept all optional fields', () => {
      const build = createBuild({
        tenantId: 't1',
        projectId: 'proj-1',
        pipelineRunId: 'run-1',
        image: 'nginx',
        tag: 'latest',
        sourceRef: 'refs/heads/main',
        buildArgs: { NODE_ENV: 'production' },
      });

      expect(build.projectId).toBe('proj-1');
      expect(build.pipelineRunId).toBe('run-1');
      expect(build.image).toBe('nginx');
      expect(build.tag).toBe('latest');
      expect(build.sourceRef).toBe('refs/heads/main');
      expect(build.buildArgs).toEqual({ NODE_ENV: 'production' });
    });
  });
});
