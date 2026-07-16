/**
 * ExtendedArtifact 模型测试
 *
 * 此模块为纯类型定义文件，无工厂函数。
 * 测试验证类型可正确导入使用。
 */
import type {
  ExtendedArtifact,
  ExtendedArtifactType,
  ArtifactStage,
  BuildMetadata,
  SecurityMetadata,
  TestMetadata,
  DeploymentMetadata,
  ArtifactDependencies,
  ArtifactPromotionRequest,
  PromotionRule,
  CleanupPolicy,
  CreateExtendedArtifactInput,
} from '../ExtendedArtifact';

describe('ExtendedArtifact', () => {
  describe('type compatibility', () => {
    it('should accept valid ExtendedArtifact object', () => {
      const artifact: ExtendedArtifact = {
        id: '1',
        name: 'my-app',
        namespace: 'default',
        version: '1.0.0',
        type: 'container_image',
        stage: 'stable',
        sizeBytes: 1024,
        storagePath: '/artifacts/my-app',
        status: 'available',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(artifact.type).toBe('container_image');
      expect(artifact.stage).toBe('stable');
      expect(artifact.status).toBe('available');
    });

    it('should accept artifact with all optional fields', () => {
      const artifact: ExtendedArtifact = {
        id: '1',
        name: 'my-app',
        namespace: 'ns',
        version: '1.0.0',
        type: 'jar_artifact',
        stage: 'production',
        displayName: 'My App',
        description: 'desc',
        labels: { team: 'backend' },
        sizeBytes: 2048,
        digest: 'sha256:abc',
        storagePath: '/path',
        storageBackend: 's3',
        build: {
          pipelineRunId: 'r1',
          gitCommit: 'abc',
          gitBranch: 'main',
          buildTime: new Date(),
        },
        security: {
          signed: true,
          signer: 'cosign',
        },
        tests: {
          unitTests: { passed: 10, failed: 0, coverage: 85 },
        },
        deployments: [{
          environment: 'prod',
          deployedAt: new Date(),
          deployedBy: 'admin',
          status: 'success',
        }],
        dependencies: {
          baseImage: 'node:20',
          libraries: [{ name: 'lodash', version: '4.17', type: 'external' }],
        },
        status: 'available',
        retentionDays: 90,
        createdAt: new Date(),
        updatedAt: new Date(),
        tenantId: 't1',
        productLineId: 'pl1',
      };

      expect(artifact.build?.gitBranch).toBe('main');
      expect(artifact.security?.signed).toBe(true);
      expect(artifact.deployments).toHaveLength(1);
    });

    it('should accept CreateExtendedArtifactInput', () => {
      const input: CreateExtendedArtifactInput = {
        name: 'test',
        namespace: 'ns',
        version: '1.0.0',
        type: 'helm_chart',
        sizeBytes: 512,
        storagePath: '/path',
      };

      expect(input.type).toBe('helm_chart');
    });

    it('should accept ArtifactPromotionRequest', () => {
      const req: ArtifactPromotionRequest = {
        artifactId: '1',
        fromStage: 'snapshot',
        toStage: 'stable',
        requestedBy: 'user',
        checks: {
          ciPassed: true,
          securityScanPassed: true,
        },
      };

      expect(req.fromStage).toBe('snapshot');
      expect(req.toStage).toBe('stable');
    });

    it('should accept CleanupPolicy', () => {
      const policy: CleanupPolicy = {
        name: 'old-artifacts',
        conditions: {
          ageDays: 90,
          notDeployed: true,
        },
        action: 'delete',
        enabled: true,
      };

      expect(policy.action).toBe('delete');
    });
  });
});
