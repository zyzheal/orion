/**
 * test-selector types 单元测试
 *
 * 验证：
 * - 类型结构完整性
 * - 字段类型正确性
 * - 联合类型值有效性
 */

import type {
  TestSuite,
  TestCase,
  TestDependency,
  TestImpact,
  ImpactPriority,
  TestExecutionPlan,
  SelectedTest,
  SkippedTest,
  TestGroup,
  TestExecutionRecord,
  TestFailurePrediction,
  TestSelectorConfig,
  PRChange,
  ChangedFile,
  TestCodeMapping,
  ApiResponse,
} from '../types';

describe('test-selector types', () => {
  // ==================== ImpactPriority ====================

  describe('ImpactPriority', () => {
    it('应该支持所有优先级值', () => {
      const validPriorities: ImpactPriority[] = ['critical', 'high', 'medium', 'low'];

      validPriorities.forEach(priority => {
        expect(['critical', 'high', 'medium', 'low']).toContain(priority);
      });
    });
  });

  // ==================== TestSuite ====================

  describe('TestSuite', () => {
    it('应该包含所有必要字段', () => {
      const suite: TestSuite = {
        id: 'suite-1',
        name: 'UserService.test.ts',
        filePath: '/src/services/__tests__/UserService.test.ts',
        testCount: 10,
        avgDuration: 1500,
        passRate: 0.95,
        lastRun: '2024-01-15T10:00:00Z',
        sourceFiles: ['/src/services/UserService.ts'],
      };

      expect(suite.id).toBe('suite-1');
      expect(suite.name).toBe('UserService.test.ts');
      expect(suite.testCount).toBe(10);
      expect(suite.avgDuration).toBe(1500);
      expect(suite.passRate).toBe(0.95);
      expect(Array.isArray(suite.sourceFiles)).toBe(true);
    });
  });

  // ==================== TestCase ====================

  describe('TestCase', () => {
    it('应该包含所有必要字段', () => {
      const testCase: TestCase = {
        id: 'case-1',
        suiteId: 'suite-1',
        name: 'should create user',
        filePath: '/src/services/__tests__/UserService.test.ts',
        dependencies: [
          { filePath: '/src/services/UserService.ts', type: 'import' },
        ],
        avgDuration: 500,
        flakyScore: 10,
        history: [
          {
            executionId: 'exec-1',
            passed: true,
            duration: 450,
            timestamp: '2024-01-15T10:00:00Z',
          },
        ],
      };

      expect(testCase.id).toBe('case-1');
      expect(testCase.suiteId).toBe('suite-1');
      expect(Array.isArray(testCase.dependencies)).toBe(true);
      expect(Array.isArray(testCase.history)).toBe(true);
      expect(testCase.flakyScore).toBeGreaterThanOrEqual(0);
      expect(testCase.flakyScore).toBeLessThanOrEqual(100);
    });
  });

  // ==================== TestDependency ====================

  describe('TestDependency', () => {
    it('应该支持所有依赖类型', () => {
      const validTypes: TestDependency['type'][] = ['import', 'require', 'dynamic'];

      validTypes.forEach(type => {
        const dep: TestDependency = {
          filePath: '/src/services/UserService.ts',
          type,
        };
        expect(dep.type).toBe(type);
      });
    });

    it('symbol 字段应为可选', () => {
      const depWithSymbol: TestDependency = {
        filePath: '/src/services/UserService.ts',
        symbol: 'UserService',
        type: 'import',
      };

      const depWithoutSymbol: TestDependency = {
        filePath: '/src/services/UserService.ts',
        type: 'import',
      };

      expect(depWithSymbol.symbol).toBe('UserService');
      expect(depWithoutSymbol.symbol).toBeUndefined();
    });
  });

  // ==================== TestImpact ====================

  describe('TestImpact', () => {
    it('应该包含所有必要字段', () => {
      const impact: TestImpact = {
        changedFile: '/src/services/UserService.ts',
        changeType: 'modified',
        affectedTests: ['case-1', 'case-2'],
        priority: 'high',
        estimatedDuration: 2000,
        impactScore: 75,
      };

      expect(impact.changedFile).toBe('/src/services/UserService.ts');
      expect(impact.changeType).toBe('modified');
      expect(Array.isArray(impact.affectedTests)).toBe(true);
      expect(impact.estimatedDuration).toBeGreaterThan(0);
      expect(impact.impactScore).toBeGreaterThanOrEqual(0);
      expect(impact.impactScore).toBeLessThanOrEqual(100);
    });

    it('应该支持所有变更类型', () => {
      const validChangeTypes: TestImpact['changeType'][] = ['added', 'modified', 'deleted', 'renamed'];

      validChangeTypes.forEach(changeType => {
        const impact: TestImpact = {
          changedFile: '/test.ts',
          changeType,
          affectedTests: [],
          priority: 'low',
          estimatedDuration: 0,
          impactScore: 0,
        };
        expect(impact.changeType).toBe(changeType);
      });
    });
  });

  // ==================== TestExecutionPlan ====================

  describe('TestExecutionPlan', () => {
    it('应该包含所有必要字段', () => {
      const plan: TestExecutionPlan = {
        selectedTests: [
          { id: 'case-1', type: 'case', priority: 'high', estimatedDuration: 500, reason: 'file changed' },
        ],
        skippedTests: [
          { id: 'case-2', reason: 'unrelated' },
        ],
        estimatedDuration: 500,
        grouping: [
          { groupId: 'g1', testIds: ['case-1'], estimatedDuration: 500, parallelIndex: 0 },
        ],
        ordering: 'fail-fast',
        planId: 'plan-1',
        createdAt: '2024-01-15T10:00:00Z',
      };

      expect(plan.planId).toBe('plan-1');
      expect(Array.isArray(plan.selectedTests)).toBe(true);
      expect(Array.isArray(plan.skippedTests)).toBe(true);
      expect(Array.isArray(plan.grouping)).toBe(true);
      expect(['fail-fast', 'balanced', 'coverage-first']).toContain(plan.ordering);
    });
  });

  // ==================== SelectedTest ====================

  describe('SelectedTest', () => {
    it('应该支持 suite 和 case 类型', () => {
      const suiteTest: SelectedTest = {
        id: 'suite-1',
        type: 'suite',
        priority: 'high',
        estimatedDuration: 1000,
        reason: 'dependency changed',
      };

      const caseTest: SelectedTest = {
        id: 'case-1',
        type: 'case',
        priority: 'medium',
        estimatedDuration: 500,
        reason: 'direct change',
      };

      expect(suiteTest.type).toBe('suite');
      expect(caseTest.type).toBe('case');
    });
  });

  // ==================== TestGroup ====================

  describe('TestGroup', () => {
    it('应该包含分组信息', () => {
      const group: TestGroup = {
        groupId: 'group-1',
        testIds: ['case-1', 'case-2', 'case-3'],
        estimatedDuration: 1500,
        parallelIndex: 0,
      };

      expect(group.groupId).toBe('group-1');
      expect(group.testIds).toHaveLength(3);
      expect(group.parallelIndex).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== TestExecutionRecord ====================

  describe('TestExecutionRecord', () => {
    it('应该包含执行记录', () => {
      const record: TestExecutionRecord = {
        executionId: 'exec-1',
        passed: true,
        duration: 450,
        timestamp: '2024-01-15T10:00:00Z',
        failureMessage: undefined,
        prId: 'PR-123',
      };

      expect(record.executionId).toBe('exec-1');
      expect(record.passed).toBe(true);
      expect(record.duration).toBe(450);
    });

    it('failureMessage 和 prId 应为可选', () => {
      const record: TestExecutionRecord = {
        executionId: 'exec-2',
        passed: false,
        duration: 100,
        timestamp: '2024-01-15T10:00:00Z',
        failureMessage: 'Assertion failed',
      };

      expect(record.failureMessage).toBe('Assertion failed');
      expect(record.prId).toBeUndefined();
    });
  });

  // ==================== TestFailurePrediction ====================

  describe('TestFailurePrediction', () => {
    it('应该包含预测信息', () => {
      const prediction: TestFailurePrediction = {
        testId: 'case-1',
        failureProbability: 0.75,
        reasons: ['high flaky score', 'recent failures'],
        isFlaky: true,
      };

      expect(prediction.testId).toBe('case-1');
      expect(prediction.failureProbability).toBeGreaterThanOrEqual(0);
      expect(prediction.failureProbability).toBeLessThanOrEqual(1);
      expect(Array.isArray(prediction.reasons)).toBe(true);
      expect(typeof prediction.isFlaky).toBe('boolean');
    });
  });

  // ==================== TestSelectorConfig ====================

  describe('TestSelectorConfig', () => {
    it('所有字段都应为可选', () => {
      const emptyConfig: TestSelectorConfig = {};
      expect(emptyConfig).toBeDefined();
    });

    it('应该支持完整配置', () => {
      const fullConfig: TestSelectorConfig = {
        maxExecutionTimeMs: 300000,
        ordering: 'fail-fast',
        maxParallelGroups: 4,
        maxTestsPerGroup: 10,
        skipFlakyTests: true,
        flakyThreshold: 50,
        minImpactScore: 20,
        historyRetentionDays: 30,
      };

      expect(fullConfig.maxExecutionTimeMs).toBe(300000);
      expect(fullConfig.ordering).toBe('fail-fast');
      expect(fullConfig.maxParallelGroups).toBe(4);
      expect(fullConfig.skipFlakyTests).toBe(true);
    });
  });

  // ==================== PRChange ====================

  describe('PRChange', () => {
    it('应该包含 PR 变更信息', () => {
      const prChange: PRChange = {
        prId: 'PR-123',
        repoId: 'repo-1',
        sourceBranch: 'feature/user-auth',
        targetBranch: 'main',
        changedFiles: [
          {
            path: '/src/services/UserService.ts',
            changeType: 'modified',
            additions: 10,
            deletions: 5,
          },
        ],
      };

      expect(prChange.prId).toBe('PR-123');
      expect(prChange.sourceBranch).toBe('feature/user-auth');
      expect(prChange.targetBranch).toBe('main');
      expect(Array.isArray(prChange.changedFiles)).toBe(true);
    });
  });

  // ==================== ChangedFile ====================

  describe('ChangedFile', () => {
    it('应该包含文件变更详情', () => {
      const file: ChangedFile = {
        path: '/src/services/UserService.ts',
        changeType: 'modified',
        additions: 10,
        deletions: 5,
      };

      expect(file.path).toBe('/src/services/UserService.ts');
      expect(file.changeType).toBe('modified');
      expect(file.additions).toBe(10);
      expect(file.deletions).toBe(5);
    });

    it('previousPath 应为可选（重命名时）', () => {
      const renamedFile: ChangedFile = {
        path: '/src/services/NewName.ts',
        changeType: 'renamed',
        additions: 0,
        deletions: 0,
        previousPath: '/src/services/OldName.ts',
      };

      expect(renamedFile.previousPath).toBe('/src/services/OldName.ts');
    });
  });

  // ==================== TestCodeMapping ====================

  describe('TestCodeMapping', () => {
    it('应该包含映射信息', () => {
      const mapping: TestCodeMapping = {
        testPath: '/src/__tests__/UserService.test.ts',
        sourcePaths: ['/src/services/UserService.ts', '/src/models/User.ts'],
        symbolMapping: new Map([
          ['UserService', ['UserService.ts']],
          ['UserModel', ['User.ts']],
        ]),
      };

      expect(mapping.testPath).toBe('/src/__tests__/UserService.test.ts');
      expect(Array.isArray(mapping.sourcePaths)).toBe(true);
      expect(mapping.symbolMapping).toBeInstanceOf(Map);
    });
  });

  // ==================== ApiResponse ====================

  describe('ApiResponse', () => {
    it('成功响应应包含 data', () => {
      const response: ApiResponse<string> = {
        success: true,
        data: 'test data',
        timestamp: '2024-01-15T10:00:00Z',
      };

      expect(response.success).toBe(true);
      expect(response.data).toBe('test data');
      expect(response.error).toBeUndefined();
    });

    it('失败响应应包含 error', () => {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Something went wrong',
        timestamp: '2024-01-15T10:00:00Z',
      };

      expect(response.success).toBe(false);
      expect(response.data).toBeUndefined();
      expect(response.error).toBe('Something went wrong');
    });
  });
});
