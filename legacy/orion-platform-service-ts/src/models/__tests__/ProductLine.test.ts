/**
 * ProductLine 模型测试
 *
 * 此模块为纯类型定义文件，无工厂函数。
 * 测试验证类型可正确导入使用。
 */
import type {
  ProductLine,
  ProductLineCreateInput,
  ProductLineUpdateInput,
  BranchMode,
  EnvironmentName,
  DeploymentStrategy,
  ProductLinePhase,
  TeamRole,
  GitRepoConfig,
  BranchPolicies,
  EnvironmentMappings,
  EnvironmentConfig,
  TeamBinding,
  ReleaseTrain,
  HotfixChannel,
} from '../ProductLine';

describe('ProductLine', () => {
  describe('type compatibility', () => {
    it('should accept valid ProductLine object', () => {
      const pl: ProductLine = {
        id: '1',
        name: 'my-product',
        displayName: 'My Product',
        description: 'A product line',
        gitRepo: {
          url: 'https://github.com/org/repo',
          provider: 'github',
          defaultBranch: 'main',
        },
        branchPolicies: {
          mode: 'gitflow',
          protectedBranches: [{
            pattern: 'main',
            requirePullRequest: true,
            requiredReviewers: 2,
          }],
        },
        environmentMappings: {
          defaultEnvironment: 'dev',
          mappings: [{
            branch: 'main',
            patternType: 'exact',
            environment: 'prod',
          }],
        },
        status: {
          phase: 'Active',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(pl.name).toBe('my-product');
      expect(pl.gitRepo.provider).toBe('github');
      expect(pl.branchPolicies.mode).toBe('gitflow');
      expect(pl.status.phase).toBe('Active');
    });

    it('should accept ProductLineCreateInput', () => {
      const input: ProductLineCreateInput = {
        name: 'new-product',
        displayName: 'New Product',
        gitRepo: { url: 'https://github.com/org/new' },
        branchPolicies: { mode: 'github-flow' },
        environmentMappings: { mappings: [] },
      };

      expect(input.branchPolicies.mode).toBe('github-flow');
    });

    it('should accept EnvironmentConfig', () => {
      const env: EnvironmentConfig = {
        name: 'prod',
        displayName: 'Production',
        namespace: 'prod-ns',
        cluster: 'prod-cluster',
        deploymentStrategy: 'canary',
        replicas: { min: 2, max: 10, target: 3 },
        hpa: { enabled: true, minReplicas: 2, maxReplicas: 10 },
      };

      expect(env.deploymentStrategy).toBe('canary');
      expect(env.hpa?.enabled).toBe(true);
    });

    it('should accept TeamBinding', () => {
      const binding: TeamBinding = {
        teamRef: 'platform-team',
        role: 'admin',
        permissions: ['deploy', 'rollback'],
        environments: ['prod'],
      };

      expect(binding.role).toBe('admin');
    });

    it('should accept ReleaseTrain', () => {
      const train: ReleaseTrain = {
        id: '1',
        productLineId: 'pl-1',
        name: 'weekly-release',
        schedule: '0 0 * * 1',
        sourceBranch: 'develop',
        targetBranch: 'release',
        status: { state: 'Idle' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(train.schedule).toBe('0 0 * * 1');
    });

    it('should accept HotfixChannel', () => {
      const channel: HotfixChannel = {
        id: '1',
        productLineId: 'pl-1',
        name: 'emergency',
        enabled: true,
        approvalRequired: false,
        status: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(channel.name).toBe('emergency');
    });
  });
});
