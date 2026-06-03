/**
 * InternalLibrary 模型测试
 *
 * 此模块为纯类型定义文件，无工厂函数。
 * 测试验证类型可正确导入使用。
 */
import type {
  InternalLibrary,
  LibraryLanguage,
  LibraryStatus,
  VersionStatus,
  LibraryVersion,
  BreakingChange,
  LibraryDependent,
  LibraryQuality,
  CreateLibraryInput,
  PublishVersionInput,
  DeprecateLibraryInput,
  LibraryQueryOptions,
  DependencyCheckResult,
  AutoUpgradePR,
} from '../InternalLibrary';

describe('InternalLibrary', () => {
  describe('type compatibility', () => {
    it('should accept valid InternalLibrary object', () => {
      const lib: InternalLibrary = {
        id: '1',
        name: 'common-utils',
        displayName: 'Common Utilities',
        language: 'java',
        status: 'active',
        owner: 'platform-team',
        maintainers: ['user1'],
        repository: 'git@github.com:org/common-utils.git',
        currentVersion: '2.1.0',
        latestStableVersion: '2.0.0',
        versions: [],
        dependents: {
          totalRepos: 10,
          totalTeams: 3,
          reposUsingLatest: 7,
          reposNeedingUpgrade: 3,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(lib.language).toBe('java');
      expect(lib.status).toBe('active');
      expect(lib.dependents.totalRepos).toBe(10);
    });

    it('should accept CreateLibraryInput', () => {
      const input: CreateLibraryInput = {
        name: 'test-lib',
        language: 'node',
        owner: 'team-1',
        repository: 'https://github.com/org/lib',
      };

      expect(input.language).toBe('node');
    });

    it('should accept DependencyCheckResult', () => {
      const result: DependencyCheckResult = {
        libraryName: 'common-utils',
        currentVersion: '1.0.0',
        latestVersion: '2.0.0',
        status: 'upgrade_available',
        upgradeType: 'major',
      };

      expect(result.status).toBe('upgrade_available');
    });

    it('should accept AutoUpgradePR', () => {
      const pr: AutoUpgradePR = {
        id: '1',
        libraryId: 'lib-1',
        libraryName: 'utils',
        libraryVersion: '2.0.0',
        targetRepo: 'org/app',
        targetBranch: 'main',
        oldVersion: '1.0.0',
        newVersion: '2.0.0',
        upgradeType: 'major',
        prTitle: 'Upgrade utils to 2.0.0',
        prBody: 'Auto upgrade',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(pr.upgradeType).toBe('major');
    });
  });
});
