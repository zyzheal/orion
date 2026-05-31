/**
 * TestDependencyAnalyzer 单元测试
 */

import { TestDependencyAnalyzer } from '../TestDependencyAnalyzer';
import * as fs from 'fs';
import * as path from 'path';

// 模拟文件系统
jest.mock('fs');
const mockedFs = jest.mocked(fs, true);

// 模拟数据库
const createMockDb = () => {
  const suites: any[] = [];
  const cases: any[] = [];
  const mappings: any[] = [];
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
      // SELECT FROM test_selector_suites WHERE tenant_id
      if (sql.includes('test_selector_suites') && sql.includes('SELECT') && sql.includes('tenant_id')) {
        return { rows: suites.filter(s => s.tenant_id === (params?.[0] || 'default')), rowCount: suites.length };
      }
      // SELECT FROM test_selector_cases WHERE tenant_id
      if (sql.includes('test_selector_cases') && sql.includes('SELECT') && sql.includes('tenant_id')) {
        return { rows: cases.filter(c => c.tenant_id === (params?.[0] || 'default')), rowCount: cases.length };
      }
      // SELECT FROM test_selector_code_mappings WHERE tenant_id
      if (sql.includes('test_selector_code_mappings') && sql.includes('SELECT') && sql.includes('tenant_id')) {
        return { rows: mappings.filter(m => m.tenant_id === (params?.[0] || 'default')), rowCount: mappings.length };
      }
      // DELETE
      if (sql.includes('DELETE')) {
        if (sql.includes('test_selector_suites')) suites.length = 0;
        if (sql.includes('test_selector_cases')) cases.length = 0;
        if (sql.includes('test_selector_code_mappings')) mappings.length = 0;
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    }),
    _suites: suites,
    _cases: cases,
    _mappings: mappings,
  };
};

describe('TestDependencyAnalyzer', () => {
  let analyzer: TestDependencyAnalyzer;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    analyzer = new TestDependencyAnalyzer({
      sourceRoot: '/project/src',
      testRoot: '/project/src',
    }, mockDb as any);
    mockedFs.readdirSync.mockReset();
    mockedFs.readFileSync.mockReset();
    mockedFs.existsSync.mockReset();
    mockedFs.statSync.mockReset();
  });

  describe('analyzeTestDependencies', () => {
    it('应该扫描并分析测试文件', async () => {
      // 模拟目录结构
      mockedFs.readdirSync.mockImplementation((dirPath: fs.PathLike) => {
        const dir = dirPath.toString();
        if (dir === '/project/src') {
          return [
            { name: 'services', isDirectory: () => true, isFile: () => false },
            { name: 'utils', isDirectory: () => true, isFile: () => false },
          ] as fs.Dirent[];
        }
        if (dir === '/project/src/services') {
          return [
            { name: 'UserService.ts', isDirectory: () => false, isFile: () => true },
            { name: 'UserService.test.ts', isDirectory: () => false, isFile: () => true },
          ] as fs.Dirent[];
        }
        if (dir === '/project/src/utils') {
          return [] as fs.Dirent[];
        }
        return [] as fs.Dirent[];
      });

      // 模拟测试文件内容
      mockedFs.readFileSync.mockReturnValue(`
import { UserService } from './UserService';

describe('UserService', () => {
  it('should create a user', () => {
    expect(true).toBe(true);
  });

  it('should find a user by id', () => {
    expect(true).toBe(true);
  });
});
`);

      // 模拟源文件存在
      mockedFs.existsSync.mockImplementation((p: fs.PathLike) => {
        return p.toString().includes('UserService.ts');
      });

      const result = await analyzer.analyzeTestDependencies();

      expect(result.suites.length).toBeGreaterThan(0);
      expect(result.cases.length).toBeGreaterThan(0);
      expect(result.mapping.length).toBeGreaterThan(0);

      const suite = result.suites[0];
      expect(suite.name).toContain('UserService.test');
      expect(suite.testCount).toBeGreaterThanOrEqual(2);
    });

    it('应该提取 import 依赖', async () => {
      mockedFs.readdirSync.mockImplementation((dirPath: fs.PathLike) => {
        const dir = dirPath.toString();
        if (dir === '/project/src') {
          return [
            { name: 'api', isDirectory: () => true, isFile: () => false },
          ] as fs.Dirent[];
        }
        if (dir === '/project/src/api') {
          return [
            { name: 'routes.test.ts', isDirectory: () => false, isFile: () => true },
          ] as fs.Dirent[];
        }
        return [] as fs.Dirent[];
      });

      mockedFs.readFileSync.mockReturnValue(`
import { createRouter } from './routes';
import { validateRequest } from '../utils/validator';

describe('Router', () => {
  it('should create routes', () => {});
});
`);

      mockedFs.existsSync.mockReturnValue(false);

      const result = await analyzer.analyzeTestDependencies();
      expect(result.suites.length).toBeGreaterThan(0);
    });

    it('应该处理没有测试文件的情况', async () => {
      mockedFs.readdirSync.mockImplementation(() => [] as fs.Dirent[]);

      const result = await analyzer.analyzeTestDependencies();

      expect(result.suites).toEqual([]);
      expect(result.cases).toEqual([]);
      expect(result.mapping).toEqual([]);
    });

    it('应该跳过 node_modules 和 dist 目录', async () => {
      mockedFs.readdirSync.mockImplementation((dirPath: fs.PathLike) => {
        const dir = dirPath.toString();
        if (dir === '/project/src') {
          return [
            { name: 'node_modules', isDirectory: () => true, isFile: () => false },
            { name: 'dist', isDirectory: () => true, isFile: () => false },
            { name: 'app.test.ts', isDirectory: () => false, isFile: () => true },
          ] as fs.Dirent[];
        }
        return [] as fs.Dirent[];
      });

      mockedFs.readFileSync.mockReturnValue(`
describe('App', () => {
  it('should work', () => {});
});
`);

      const result = await analyzer.analyzeTestDependencies();
      expect(result.suites.length).toBe(1);
    });
  });

  describe('mapTestsToSourceFiles', () => {
    it('应该根据命名约定推断源文件', async () => {
      await analyzer.clearCache();
      const mockDb2 = createMockDb();
      const analyzer2 = new TestDependencyAnalyzer({
        sourceRoot: '/project/src',
        testRoot: '/project/src',
      }, mockDb2 as any);

      mockedFs.readdirSync.mockImplementation((dirPath: fs.PathLike) => {
        const dir = dirPath.toString();
        if (dir === '/project/src') {
          return [
            { name: 'UserService.ts', isDirectory: () => false, isFile: () => true },
            { name: 'UserService.test.ts', isDirectory: () => false, isFile: () => true },
          ] as fs.Dirent[];
        }
        return [] as fs.Dirent[];
      });

      mockedFs.readFileSync.mockReturnValue(`
describe('UserService', () => {
  it('should work', () => {});
});
`);

      mockedFs.existsSync.mockImplementation((p: fs.PathLike) => {
        return p.toString().includes('UserService.ts') && !p.toString().includes('.test.');
      });

      mockedFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

      await analyzer2.analyzeTestDependencies();
      const mapping = await analyzer2.mapTestsToSourceFiles();

      expect(mapping.size).toBeGreaterThan(0);
    });
  });

  describe('getTestCoverage', () => {
    it('应该返回覆盖率统计', async () => {
      await analyzer.clearCache();

      mockedFs.readdirSync.mockImplementation((dirPath: fs.PathLike) => {
        const dir = dirPath.toString();
        if (dir === '/project/src') {
          return [
            { name: 'app.test.ts', isDirectory: () => false, isFile: () => true },
          ] as fs.Dirent[];
        }
        return [] as fs.Dirent[];
      });

      mockedFs.readFileSync.mockReturnValue(`
import { helper } from './helper';

describe('App', () => {
  it('should work', () => {});
});
`);

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

      await analyzer.analyzeTestDependencies();
      const coverage = analyzer.getTestCoverage();

      expect(coverage instanceof Map).toBe(true);
    });
  });

  describe('getSuites and getCases', () => {
    it('应该返回空数组当没有分析数据', async () => {
      expect(await analyzer.getSuites()).toEqual([]);
      expect(await analyzer.getCases()).toEqual([]);
    });
  });

  describe('clearCache', () => {
    it('应该清除所有缓存数据', async () => {
      mockedFs.readdirSync.mockImplementation((dirPath: fs.PathLike) => {
        return [
          { name: 'app.test.ts', isDirectory: () => false, isFile: () => true },
        ] as fs.Dirent[];
      });

      mockedFs.readFileSync.mockReturnValue(`
describe('App', () => {
  it('should work', () => {});
});
`);

      mockedFs.existsSync.mockReturnValue(false);

      await analyzer.analyzeTestDependencies();
      expect((await analyzer.getSuites()).length).toBeGreaterThan(0);

      await analyzer.clearCache();

      expect(await analyzer.getSuites()).toEqual([]);
      expect(await analyzer.getCases()).toEqual([]);
    });
  });

  describe('getTestsForSourceFile', () => {
    it('应该返回空数组对于未知源文件', () => {
      const result = analyzer.getTestsForSourceFile('/unknown/file.ts');
      expect(result).toEqual([]);
    });
  });

  describe('getDependenciesForTest', () => {
    it('应该返回空数组对于未知测试', async () => {
      const result = await analyzer.getDependenciesForTest('unknown-test');
      expect(result).toEqual([]);
    });
  });
});
