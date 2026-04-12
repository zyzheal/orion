/**
 * TestImpactAnalyzer 单元测试
 */

import { TestImpactAnalyzer } from '../TestImpactAnalyzer';
import { TestDependencyAnalyzer } from '../TestDependencyAnalyzer';
import { ChangedFile } from '../types';

// 模拟 TestDependencyAnalyzer
jest.mock('../TestDependencyAnalyzer');

describe('TestImpactAnalyzer', () => {
  let impactAnalyzer: TestImpactAnalyzer;
  let mockDependencyAnalyzer: jest.Mocked<TestDependencyAnalyzer>;

  beforeEach(() => {
    mockDependencyAnalyzer = new TestDependencyAnalyzer({
      sourceRoot: '/project/src',
      testRoot: '/project/src',
    }) as jest.Mocked<TestDependencyAnalyzer>;

    mockDependencyAnalyzer.getTestsForSourceFile = jest.fn();
    mockDependencyAnalyzer.getSuites = jest.fn().mockReturnValue([]);
    mockDependencyAnalyzer.getCases = jest.fn().mockReturnValue([]);
    mockDependencyAnalyzer.getTestCoverage = jest.fn().mockReturnValue(new Map());

    impactAnalyzer = new TestImpactAnalyzer(mockDependencyAnalyzer);
  });

  describe('analyzeImpact', () => {
    it('应该分析变更文件的影响', async () => {
      const changedFiles: ChangedFile[] = [
        {
          path: 'src/services/UserService.ts',
          changeType: 'modified',
          additions: 30,
          deletions: 10,
        },
      ];

      mockDependencyAnalyzer.getTestsForSourceFile
        .mockReturnValue(['suite-001', 'case-001']);

      const result = await impactAnalyzer.analyzeImpact(changedFiles);

      expect(result.impacts.length).toBeGreaterThan(0);
      expect(result.allAffectedTestIds.size).toBe(2);
      expect(result.totalEstimatedDuration).toBeGreaterThan(0);
    });

    it('应该处理没有受影响测试的情况', async () => {
      const changedFiles: ChangedFile[] = [
        {
          path: 'src/new-file.ts',
          changeType: 'added',
          additions: 10,
          deletions: 0,
        },
      ];

      mockDependencyAnalyzer.getTestsForSourceFile.mockReturnValue([]);

      const result = await impactAnalyzer.analyzeImpact(changedFiles);

      expect(result.impacts).toEqual([]);
      expect(result.allAffectedTestIds.size).toBe(0);
      expect(result.totalEstimatedDuration).toBe(0);
    });

    it('应该按影响评分降序排序', async () => {
      const changedFiles: ChangedFile[] = [
        {
          path: 'src/utils/helper.ts',
          changeType: 'modified',
          additions: 5,
          deletions: 2,
        },
        {
          path: 'src/core/engine.ts',
          changeType: 'deleted',
          additions: 0,
          deletions: 100,
        },
      ];

      mockDependencyAnalyzer.getTestsForSourceFile
        .mockReturnValueOnce(['test-low'])
        .mockReturnValueOnce(['test-high']);

      const result = await impactAnalyzer.analyzeImpact(changedFiles);

      // deleted 文件 + core 路径应该评分更高
      expect(result.impacts[0].changedFile).toBe('src/core/engine.ts');
    });

    it('应该处理多种变更类型', async () => {
      const changedFiles: ChangedFile[] = [
        { path: 'src/a.ts', changeType: 'added', additions: 20, deletions: 0 },
        { path: 'src/b.ts', changeType: 'modified', additions: 50, deletions: 30 },
        { path: 'src/c.ts', changeType: 'deleted', additions: 0, deletions: 100 },
        { path: 'src/d.ts', changeType: 'renamed', additions: 0, deletions: 0 },
      ];

      mockDependencyAnalyzer.getTestsForSourceFile.mockReturnValue(['test-001']);

      const result = await impactAnalyzer.analyzeImpact(changedFiles);

      expect(result.impacts).toHaveLength(4);
      expect(result.impacts.map(i => i.changedFile)).toEqual([
        'src/c.ts', // deleted + 大量删除行 -> 最高分
        'src/b.ts', // modified + 大量变更
        'src/a.ts', // added
        'src/d.ts', // renamed
      ]);
    });
  });

  describe('getAffectedTests', () => {
    it('应该返回受影响的测试', async () => {
      mockDependencyAnalyzer.getTestsForSourceFile.mockReturnValue(['suite-001']);
      mockDependencyAnalyzer.getSuites.mockReturnValue([{ id: 'suite-001', name: 'test' } as any]);

      const result = await impactAnalyzer.getAffectedTests('src/services/UserService.ts');

      expect(result.suites.length).toBe(1);
    });

    it('应该返回空结果对于没有测试的文件', async () => {
      mockDependencyAnalyzer.getTestsForSourceFile.mockReturnValue([]);

      const result = await impactAnalyzer.getAffectedTests('src/unknown.ts');

      expect(result.suites).toEqual([]);
      expect(result.cases).toEqual([]);
    });
  });

  describe('calculateImpactScore', () => {
    it('删除操作应该给高分', () => {
      const score = impactAnalyzer.calculateImpactScore({
        path: 'src/core/engine.ts',
        changeType: 'deleted',
        additions: 0,
        deletions: 100,
      }, ['test-001', 'test-002']);

      expect(score).toBeGreaterThan(50);
    });

    it('小修改应该给低分', () => {
      const score = impactAnalyzer.calculateImpactScore({
        path: 'src/utils/helper.ts',
        changeType: 'modified',
        additions: 2,
        deletions: 1,
      }, ['test-001']);

      expect(score).toBeLessThan(50);
    });

    it('核心文件变更应该比工具文件得分更高', () => {
      const coreScore = impactAnalyzer.calculateImpactScore({
        path: 'src/engine/PipelineEngine.ts',
        changeType: 'modified',
        additions: 10,
        deletions: 5,
      }, ['test-001']);

      const utilScore = impactAnalyzer.calculateImpactScore({
        path: 'src/utils/format.ts',
        changeType: 'modified',
        additions: 10,
        deletions: 5,
      }, ['test-001']);

      expect(coreScore).toBeGreaterThan(utilScore);
    });

    it('评分应该在 0-100 范围内', () => {
      const score = impactAnalyzer.calculateImpactScore({
        path: 'src/file.ts',
        changeType: 'modified',
        additions: 1000,
        deletions: 1000,
      }, Array(100).fill('test'));

      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getCoverageStats', () => {
    it('应该返回覆盖率统计', () => {
      const coverageMap = new Map();
      coverageMap.set('src/file.ts', { testCount: 3, testIds: ['t1', 't2', 't3'] });
      mockDependencyAnalyzer.getTestCoverage.mockReturnValue(coverageMap);

      const stats = impactAnalyzer.getCoverageStats();

      expect(stats.get('src/file.ts')).toEqual({ testCount: 3, testIds: ['t1', 't2', 't3'] });
    });
  });

  describe('findUncoveredFiles', () => {
    it('应该返回未被测试覆盖的文件', () => {
      const coverageMap = new Map();
      coverageMap.set('src/covered.ts', { testCount: 2, testIds: ['t1', 't2'] });
      mockDependencyAnalyzer.getTestCoverage.mockReturnValue(coverageMap);

      const uncovered = impactAnalyzer.findUncoveredFiles([
        'src/covered.ts',
        'src/uncovered.ts',
        'src/also-uncovered.ts',
      ]);

      expect(uncovered).toContain('src/uncovered.ts');
      expect(uncovered).toContain('src/also-uncovered.ts');
      expect(uncovered).not.toContain('src/covered.ts');
    });
  });
});
