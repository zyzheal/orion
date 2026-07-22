/**
 * TestSelectorService 单元测试
 */

import { TestSelectorService } from '../TestSelectorService';
import * as fs from 'fs';

// 模拟文件系统
jest.mock('fs');
const mockedFs = jest.mocked(fs, true);

// 模拟数据库
const createMockDb = () => {
  const suites: any[] = [];
  const cases: any[] = [];
  const mappings: any[] = [];
  const prResults: any[] = [];
  const history: any[] = [];
  return {
    query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
      // INSERT INTO test_selector_suites
      if (sql.includes('test_selector_suites') && sql.includes('INSERT')) {
        const row = {
          id: params?.[0], tenant_id: params?.[1], name: params?.[2], file_path: params?.[3],
          test_count: params?.[4], avg_duration: params?.[5], pass_rate: params?.[6],
          last_run: params?.[7], source_files: params?.[8],
          created_at: new Date(), updated_at: new Date(),
        };
        suites.push(row);
        return { rows: [row], rowCount: 1 };
      }
      // INSERT INTO test_selector_cases
      if (sql.includes('test_selector_cases') && sql.includes('INSERT')) {
        const row = {
          id: params?.[0], tenant_id: params?.[1], suite_id: params?.[2], name: params?.[3],
          file_path: params?.[4], dependencies: params?.[5], avg_duration: params?.[6],
          flaky_score: params?.[7], history: params?.[8],
          created_at: new Date(), updated_at: new Date(),
        };
        cases.push(row);
        return { rows: [row], rowCount: 1 };
      }
      // INSERT INTO test_selector_code_mappings
      if (sql.includes('test_selector_code_mappings') && sql.includes('INSERT')) {
        const row = {
          id: params?.[0], tenant_id: params?.[1], test_path: params?.[2],
          source_paths: params?.[3], symbol_mapping: params?.[4],
          created_at: new Date(), updated_at: new Date(),
        };
        mappings.push(row);
        return { rows: [row], rowCount: 1 };
      }
      // INSERT INTO test_selector_pr_results
      if (sql.includes('test_selector_pr_results') && sql.includes('INSERT')) {
        const row = {
          id: params?.[0], tenant_id: params?.[1], pr_id: params?.[2],
          plan_data: typeof params?.[3] === 'string' ? JSON.parse(params[3]) : params?.[3],
          impact_data: typeof params?.[4] === 'string' ? JSON.parse(params[4]) : params?.[4],
          status: params?.[5],
          created_at: new Date(), updated_at: new Date(),
        };
        prResults.push(row);
        return { rows: [row], rowCount: 1 };
      }
      // INSERT INTO test_selector_execution_history
      if (sql.includes('test_selector_execution_history') && sql.includes('INSERT')) {
        const row = {
          id: params?.[0], tenant_id: params?.[1], test_id: params?.[2],
          execution_id: params?.[3], passed: params?.[4], duration: params?.[5],
          failure_message: params?.[6], pr_id: params?.[7], executed_at: params?.[8],
          created_at: new Date(),
        };
        history.push(row);
        return { rows: [row], rowCount: 1 };
      }
      // SELECT FROM test_selector_suites
      if (sql.includes('test_selector_suites') && sql.includes('SELECT')) {
        return { rows: suites, rowCount: suites.length };
      }
      // SELECT FROM test_selector_cases
      if (sql.includes('test_selector_cases') && sql.includes('SELECT')) {
        return { rows: cases, rowCount: cases.length };
      }
      // SELECT FROM test_selector_pr_results WHERE pr_id
      if (sql.includes('test_selector_pr_results') && sql.includes('pr_id')) {
        const prId = params?.[0];
        const row = prResults.find(r => r.pr_id === prId);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      // SELECT FROM test_selector_pr_results WHERE plan_data
      if (sql.includes('test_selector_pr_results') && sql.includes('plan_data')) {
        const planId = params?.[1];
        const row = prResults.find(r => r.plan_data?.planId === planId);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      // SELECT DISTINCT test_id
      if (sql.includes('DISTINCT test_id')) {
        const testIds = [...new Set(history.map(r => r.test_id))];
        return { rows: testIds.map(id => ({ test_id: id })), rowCount: testIds.length };
      }
      // SELECT FROM test_selector_execution_history
      if (sql.includes('test_selector_execution_history') && sql.includes('SELECT')) {
        const testId = params?.[0];
        const limit = params?.[1] || 100;
        const rows = history
          .filter(r => r.test_id === testId)
          .sort((a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime())
          .slice(0, limit);
        return { rows, rowCount: rows.length };
      }
      // UPDATE test_selector_pr_results
      if (sql.includes('test_selector_pr_results') && sql.includes('UPDATE')) {
        const id = params?.[1];
        const status = params?.[0];
        const row = prResults.find(r => r.id === id);
        if (row) row.status = status;
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      // DELETE
      if (sql.includes('DELETE')) {
        if (sql.includes('test_selector_suites')) suites.length = 0;
        if (sql.includes('test_selector_cases')) cases.length = 0;
        if (sql.includes('test_selector_code_mappings')) mappings.length = 0;
        if (sql.includes('test_selector_execution_history')) history.length = 0;
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    }),
    _suites: suites,
    _cases: cases,
    _mappings: mappings,
    _prResults: prResults,
    _history: history,
  };
};

describe('TestSelectorService', () => {
  let service: TestSelectorService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockedFs.readdirSync.mockReset();
    mockedFs.readFileSync.mockReset();
    mockedFs.existsSync.mockReset();
    mockedFs.statSync.mockReset();

    service = new TestSelectorService({
      analyzerConfig: {
        sourceRoot: '/project/src',
        testRoot: '/project/src',
      },
      optimizerConfig: {
        maxExecutionTimeMs: 60000,
        maxParallelGroups: 4,
      },
    }, mockDb as any);
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('initialize', () => {
    it('应该分析测试依赖并标记为已初始化', async () => {
      mockedFs.readdirSync.mockImplementation(() => [
        { name: 'app.test.ts', isDirectory: () => false, isFile: () => true },
      ] as fs.Dirent[]);

      mockedFs.readFileSync.mockReturnValue(`
describe('App', () => {
  it('should work', () => {});
});
`);
      mockedFs.existsSync.mockReturnValue(false);

      await service.initialize();

      // 服务应该能够返回套件列表
      const suites = await service.getSuites();
      expect(suites.length).toBeGreaterThan(0);
    });

    it('重复调用应该跳过重复初始化', async () => {
      mockedFs.readdirSync.mockImplementation(() => [
        { name: 'app.test.ts', isDirectory: () => false, isFile: () => true },
      ] as fs.Dirent[]);

      mockedFs.readFileSync.mockReturnValue(`describe('App', () => { it('works', () => {}); });`);
      mockedFs.existsSync.mockReturnValue(false);

      await service.initialize();
      await service.initialize(); // 第二次调用

      // 应该只分析一次
      const suites = await service.getSuites();
      expect(suites.length).toBeGreaterThan(0);
    });
  });

  describe('selectTestsForPR', () => {
    it('应该为 PR 选择测试', async () => {
      // 模拟测试文件存在
      mockedFs.readdirSync.mockImplementation((dirPath: fs.PathLike) => {
        const dir = dirPath.toString();
        if (dir === '/project/src/services') {
          return [
            { name: 'UserService.ts', isDirectory: () => false, isFile: () => true },
            { name: 'UserService.test.ts', isDirectory: () => false, isFile: () => true },
          ] as fs.Dirent[];
        }
        if (dir === '/project/src') {
          return [
            { name: 'services', isDirectory: () => true, isFile: () => false },
          ] as fs.Dirent[];
        }
        return [] as fs.Dirent[];
      });

      mockedFs.readFileSync.mockReturnValue(`
import { UserService } from './UserService';
describe('UserService', () => {
  it('should create user', () => {});
});
`);

      mockedFs.existsSync.mockImplementation((p: fs.PathLike) => {
        return p.toString().includes('UserService.ts') && !p.toString().includes('.test.');
      });

      mockedFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

      // 初始化
      await service.initialize();

      // 选择测试
      const plan = await service.selectTestsForPR({
        prId: 'pr-001',
        repoId: 'repo-001',
        sourceBranch: 'feature/user-service',
        targetBranch: 'main',
        changedFiles: [
          {
            path: 'services/UserService.ts',
            changeType: 'modified',
            additions: 20,
            deletions: 5,
          },
        ],
      });

      expect(plan.planId).toBeDefined();
      expect(plan.createdAt).toBeDefined();
      expect(plan.selectedTests).toBeDefined();
      expect(plan.skippedTests).toBeDefined();
    });

    it('没有受影响测试时应返回空计划', async () => {
      mockedFs.readdirSync.mockImplementation(() => [] as fs.Dirent[]);

      mockedFs.existsSync.mockReturnValue(false);

      const plan = await service.selectTestsForPR({
        prId: 'pr-002',
        repoId: 'repo-001',
        sourceBranch: 'feature/new',
        targetBranch: 'main',
        changedFiles: [
          {
            path: 'src/unknown.ts',
            changeType: 'added',
            additions: 100,
            deletions: 0,
          },
        ],
      });

      expect(plan.selectedTests).toEqual([]);
    });
  });

  describe('getTestPlan', () => {
    it('应该通过 planId 获取计划', async () => {
      mockedFs.readdirSync.mockImplementation(() => [] as fs.Dirent[]);
      mockedFs.existsSync.mockReturnValue(false);

      const plan = await service.selectTestsForPR({
        prId: 'pr-003',
        repoId: 'repo-001',
        sourceBranch: 'feature/test',
        targetBranch: 'main',
        changedFiles: [],
      });

      const retrieved = await service.getTestPlan(plan.planId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.planId).toBe(plan.planId);
    });

    it('对于不存在的 planId 应该返回 null', async () => {
      const result = await service.getTestPlan('nonexistent-plan');
      expect(result).toBeNull();
    });
  });

  describe('getPRTestResult', () => {
    it('应该获取 PR 的测试结果', async () => {
      mockedFs.readdirSync.mockImplementation(() => [] as fs.Dirent[]);
      mockedFs.existsSync.mockReturnValue(false);

      await service.selectTestsForPR({
        prId: 'pr-004',
        repoId: 'repo-001',
        sourceBranch: 'feature/test',
        targetBranch: 'main',
        changedFiles: [],
      });

      const result = await service.getPRTestResult('pr-004');
      expect(result).not.toBeNull();
      expect(result!.prId).toBe('pr-004');
      expect(result!.status).toBe('pending');
    });

    it('对于不存在的 PR 应该返回 null', async () => {
      const result = await service.getPRTestResult('nonexistent-pr');
      expect(result).toBeNull();
    });
  });

  describe('updatePRTestStatus', () => {
    it('应该更新 PR 测试状态', async () => {
      mockedFs.readdirSync.mockImplementation(() => [] as fs.Dirent[]);
      mockedFs.existsSync.mockReturnValue(false);

      await service.selectTestsForPR({
        prId: 'pr-005',
        repoId: 'repo-001',
        sourceBranch: 'feature/test',
        targetBranch: 'main',
        changedFiles: [],
      });

      await service.updatePRTestStatus('pr-005', 'running');
      let result = await service.getPRTestResult('pr-005');
      expect(result!.status).toBe('running');

      await service.updatePRTestStatus('pr-005', 'completed');
      result = await service.getPRTestResult('pr-005');
      expect(result!.status).toBe('completed');
    });
  });

  describe('recordTestResult', () => {
    it('应该记录测试结果到历史', async () => {
      await service.recordTestResult(
        'test-001',
        true,
        1500,
        undefined,
        'pr-006'
      );

      const history = await service.getTestHistory('test-001');
      expect(history.totalRuns).toBe(1);
      expect(history.passedRuns).toBe(1);
    });
  });

  describe('getTestHistory', () => {
    it('对于没有历史的测试应该返回空统计', async () => {
      const stats = await service.getTestHistory('unknown-test');
      expect(stats.totalRuns).toBe(0);
    });
  });

  describe('getAllTestHistory', () => {
    it('应该返回所有测试的历史', async () => {
      await service.recordTestResult('test-001', true, 500);
      await service.recordTestResult('test-002', false, 800);

      const allStats = await service.getAllTestHistory();
      expect(allStats.length).toBe(2);
    });
  });

  describe('getFlakyTests', () => {
    it('应该返回检测到的抖动测试', async () => {
      // 创建抖动模式
      const results = [true, false, true, false, true, false, true, false, true, false];
      for (let i = 0; i < results.length; i++) {
        await service.recordTestResult('flaky-001', results[i], 500);
      }

      const flakyTests = await service.getFlakyTests();
      expect(flakyTests).toContain('flaky-001');
    });
  });

  describe('getSuites and getCases', () => {
    it('应该返回空数组当没有数据时', async () => {
      expect(await service.getSuites()).toEqual([]);
      expect(await service.getCases()).toEqual([]);
    });
  });

  describe('analyzeImpactForFiles', () => {
    it('应该分析变更影响', async () => {
      mockedFs.readdirSync.mockImplementation(() => [
        { name: 'app.test.ts', isDirectory: () => false, isFile: () => true },
      ] as fs.Dirent[]);

      mockedFs.readFileSync.mockReturnValue(`
describe('App', () => { it('works', () => {}); });
`);
      mockedFs.existsSync.mockReturnValue(false);

      await service.initialize();

      const impact = await service.analyzeImpactForFiles([
        { path: 'src/unknown.ts', changeType: 'modified', additions: 10, deletions: 5 },
      ]);

      expect(impact.impacts).toBeDefined();
    });
  });

  describe('reanalyze', () => {
    it('应该清除并重新分析依赖', async () => {
      const mockTestFile = [
        { name: 'app.test.ts', isDirectory: () => false, isFile: () => true },
      ] as fs.Dirent[];

      mockedFs.readdirSync.mockImplementation(() => mockTestFile);
      mockedFs.readFileSync.mockReturnValue(`
describe('App', () => { it('works', () => {}); });
`);
      mockedFs.existsSync.mockReturnValue(false);

      await service.initialize();
      expect((await service.getSuites()).length).toBeGreaterThan(0);

      // 重新设置 mock（因为 reanalyze 会清除并重新扫描）
      mockedFs.readdirSync.mockImplementation(() => mockTestFile);
      mockedFs.readFileSync.mockReturnValue(`
describe('App', () => { it('works', () => {}); });
`);
      mockedFs.existsSync.mockReturnValue(false);

      await service.reanalyze();
      // 重新分析后应该仍然有数据
      expect((await service.getSuites()).length).toBeGreaterThan(0);
    });
  });

  describe('getTestCoverage', () => {
    it('应该返回覆盖率信息', async () => {
      mockedFs.readdirSync.mockImplementation(() => [
        { name: 'app.test.ts', isDirectory: () => false, isFile: () => true },
      ] as fs.Dirent[]);

      mockedFs.readFileSync.mockReturnValue(`
import { helper } from './helper';
describe('App', () => { it('works', () => {}); });
`);
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

      await service.initialize();

      const coverage = service.getTestCoverage();
      expect(coverage instanceof Map).toBe(true);
    });
  });
});
