/**
 * TestDependencyAnalyzer - 测试依赖分析器
 *
 * 负责分析测试文件与源代码文件之间的依赖关系，
 * 构建测试到代码的映射图。
 * PostgreSQL Repository 模式：数据存储在 test_selector_suites/cases/code_mappings 表中。
 */

import { TestSuite, TestCase, TestDependency, TestCodeMapping } from './types';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import pino from 'pino';
import {
  TestSuiteDependencyRepository,
  TestCaseDependencyRepository,
  TestCodeMappingDependencyRepository,
} from '../../repositories/TestDependencyRepository';

const logger = pino({ name: 'test-dependency-analyzer' });
import * as path from 'path';

export interface DependencyAnalyzerConfig {
  /** 源代码根目录 */
  sourceRoot: string;
  /** 测试代码根目录 */
  testRoot: string;
  /** 测试文件匹配模式 */
  testPattern?: RegExp;
}

/**
 * 测试依赖分析器
 *
 * 通过分析测试文件的导入语句，构建测试用例到源代码的依赖映射。
 * 支持静态分析 import/require 语句，建立 test-to-code 关系图。
 */
export class TestDependencyAnalyzer {
  private sourceRoot: string;
  private testRoot: string;
  private testPattern: RegExp;
  // 反向索引：源文件 -> 测试 ID 列表（从 DB 加载后缓存）
  private sourceToTestsIndex: Map<string, Set<string>> = new Map();
  /** PostgreSQL 持久化 */
  private suiteRepo: TestSuiteDependencyRepository;
  private caseRepo: TestCaseDependencyRepository;
  private mappingRepo: TestCodeMappingDependencyRepository;
  private tenantId: string;

  constructor(
    config: DependencyAnalyzerConfig,
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    tenantId: string = 'default',
  ) {
    this.sourceRoot = config.sourceRoot;
    this.testRoot = config.testRoot;
    this.testPattern = config.testPattern || /\.test\.(ts|tsx|js|jsx)$/;
    this.tenantId = tenantId;
    this.suiteRepo = new TestSuiteDependencyRepository(db);
    this.caseRepo = new TestCaseDependencyRepository(db);
    this.mappingRepo = new TestCodeMappingDependencyRepository(db);
  }

  /**
   * 分析测试依赖
   *
   * 扫描测试目录，解析每个测试文件的导入依赖，构建完整的依赖映射。
   */
  async analyzeTestDependencies(): Promise<{
    suites: TestSuite[];
    cases: TestCase[];
    mapping: TestCodeMapping[];
  }> {
    const testFiles = await this.findTestFiles();
    const suites: TestSuite[] = [];
    const cases: TestCase[] = [];
    const mapping: TestCodeMapping[] = [];

    for (const testFile of testFiles) {
      const result = await this.analyzeSingleTestFile(testFile);
      if (result) {
        suites.push(result.suite);
        cases.push(...result.cases);
        mapping.push(result.mapping);

        // PostgreSQL 持久化（upsert 模式，支持重复分析）
        await this.suiteRepo.create({
          id: result.suite.id,
          tenantId: this.tenantId,
          name: result.suite.name,
          filePath: result.suite.filePath,
          testCount: result.suite.testCount,
          avgDuration: result.suite.avgDuration,
          passRate: result.suite.passRate,
          lastRun: result.suite.lastRun ? new Date(result.suite.lastRun) : null,
          sourceFiles: result.suite.sourceFiles,
        });

        for (const tc of result.cases) {
          await this.caseRepo.create({
            id: tc.id,
            tenantId: this.tenantId,
            suiteId: tc.suiteId,
            name: tc.name,
            filePath: tc.filePath,
            dependencies: tc.dependencies,
            avgDuration: tc.avgDuration,
            flakyScore: tc.flakyScore,
            history: tc.history,
          });
        }

        const symbolMappingObj: Record<string, string[]> = {};
        result.mapping.symbolMapping.forEach((symbols, source) => {
          symbolMappingObj[source] = symbols;
        });
        await this.mappingRepo.create({
          id: uuidv4(),
          tenantId: this.tenantId,
          testPath: result.mapping.testPath,
          sourcePaths: result.mapping.sourcePaths,
          symbolMapping: symbolMappingObj,
        });

        // 更新反向索引
        this.updateSourceIndex(result.suite.id, result.mapping.sourcePaths);
      }
    }

    return { suites, cases, mapping };
  }

  /**
   * 将测试映射到源文件
   *
   * 根据命名约定和导入语句，将测试文件映射到其测试的源文件。
   * 例如: src/services/foo.test.ts -> src/services/foo.ts
   */
  async mapTestsToSourceFiles(): Promise<Map<string, string[]>> {
    const mapping = new Map<string, string[]>();
    const suites = await this.suiteRepo.findByTenant(this.tenantId);

    for (const suite of suites) {
      const sourceFiles = this.inferSourceFiles(suite.filePath);
      mapping.set(suite.id, sourceFiles);
    }

    return mapping;
  }

  /**
   * 获取测试覆盖率信息
   *
   * 返回每个源文件被多少测试覆盖。
   */
  getTestCoverage(): Map<string, { testCount: number; testIds: string[] }> {
    const coverage = new Map<string, { testCount: number; testIds: string[] }>();

    for (const [sourceFile, testIds] of this.sourceToTestsIndex) {
      coverage.set(sourceFile, {
        testCount: testIds.size,
        testIds: Array.from(testIds),
      });
    }

    return coverage;
  }

  /**
   * 获取指定源文件影响的测试
   */
  getTestsForSourceFile(sourceFilePath: string): string[] {
    const testIds = this.sourceToTestsIndex.get(sourceFilePath);
    return testIds ? Array.from(testIds) : [];
  }

  /**
   * 获取指定测试的依赖源文件
   */
  async getDependenciesForTest(testId: string): Promise<TestDependency[]> {
    // 先查 case
    const cases = await this.caseRepo.findByTenant(this.tenantId);
    const testCase = cases.find(c => c.id === testId);
    if (testCase) {
      return testCase.dependencies as TestDependency[];
    }
    // 再查 suite
    const suites = await this.suiteRepo.findByTenant(this.tenantId);
    const testSuite = suites.find(s => s.id === testId);
    if (testSuite) {
      return testSuite.sourceFiles.map(f => ({
        filePath: f,
        type: 'import' as const,
      }));
    }
    return [];
  }

  /**
   * 获取所有测试套件
   */
  async getSuites(): Promise<TestSuite[]> {
    const entities = await this.suiteRepo.findByTenant(this.tenantId);
    return entities.map(e => ({
      id: e.id,
      name: e.name,
      filePath: e.filePath,
      testCount: e.testCount,
      avgDuration: e.avgDuration,
      passRate: e.passRate,
      lastRun: e.lastRun ? e.lastRun.toISOString() : new Date().toISOString(),
      sourceFiles: e.sourceFiles,
    }));
  }

  /**
   * 获取所有测试用例
   */
  async getCases(): Promise<TestCase[]> {
    const entities = await this.caseRepo.findByTenant(this.tenantId);
    return entities.map(e => ({
      id: e.id,
      suiteId: e.suiteId,
      name: e.name,
      filePath: e.filePath,
      dependencies: e.dependencies as TestDependency[],
      avgDuration: e.avgDuration,
      flakyScore: e.flakyScore,
      history: e.history as any[],
    }));
  }

  /**
   * 清空缓存
   */
  async clearCache(): Promise<void> {
    await this.suiteRepo.deleteByTenant(this.tenantId);
    await this.caseRepo.deleteByTenant(this.tenantId);
    await this.mappingRepo.deleteByTenant(this.tenantId);
    this.sourceToTestsIndex.clear();
  }

  // ==================== 私有方法 ====================

  /**
   * 查找所有测试文件
   */
  private async findTestFiles(): Promise<string[]> {
    const testFiles: string[] = [];

    try {
      await this.walkDirectory(this.testRoot, testFiles);
    } catch (error) {
      logger.warn({ err: error, testRoot: this.testRoot }, 'Failed to scan test directory');
    }

    return testFiles.filter(f => this.testPattern.test(f));
  }

  /**
   * 递归遍历目录
   */
  private async walkDirectory(dir: string, result: string[]): Promise<void> {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // 跳过 node_modules 和 dist 目录
          if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
            continue;
          }
          await this.walkDirectory(fullPath, result);
        } else if (entry.isFile()) {
          result.push(fullPath);
        }
      }
    } catch {
      // 忽略不可访问的目录
    }
  }

  /**
   * 分析单个测试文件
   */
  private async analyzeSingleTestFile(testPath: string): Promise<{
    suite: TestSuite;
    cases: TestCase[];
    mapping: TestCodeMapping;
  } | null> {
    try {
      const content = fs.readFileSync(testPath, 'utf-8');
      const imports = this.extractImports(content);
      const sourceFiles = this.resolveImportPaths(imports, testPath);

      const relativeTestPath = path.relative(this.testRoot, testPath);
      const suiteId = `suite-${uuidv4().substring(0, 8)}`;

      const suite: TestSuite = {
        id: suiteId,
        name: path.basename(testPath, path.extname(testPath)),
        filePath: relativeTestPath,
        testCount: this.countTests(content),
        avgDuration: 0, // 需要历史数据填充
        passRate: 1.0,  // 默认值，后续更新
        lastRun: new Date().toISOString(),
        sourceFiles: sourceFiles.map(f => path.relative(this.sourceRoot, f)),
      };

      // 创建默认测试用例（基于 describe/it 块分析）
      const cases = this.extractTestCases(content, suiteId, relativeTestPath, sourceFiles);

      const symbolMapping = new Map<string, string[]>();
      imports.forEach(imp => {
        symbolMapping.set(imp.source, imp.symbols);
      });

      const mapping: TestCodeMapping = {
        testPath: relativeTestPath,
        sourcePaths: sourceFiles.map(f => path.relative(this.sourceRoot, f)),
        symbolMapping,
      };

      return { suite, cases, mapping };
    } catch (error) {
      logger.warn({ err: error, testPath }, 'Failed to analyze test file');
      return null;
    }
  }

  /**
   * 从代码内容中提取 import 语句
   */
  private extractImports(content: string): Array<{ source: string; symbols: string[] }> {
    const imports: Array<{ source: string; symbols: string[] }> = [];

    // 匹配 ES6 import 语句
    const importRegex = /import\s+(?:.*\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const source = match[1];
      // 跳过外部包（不包含 ./ 或 ../ 的导入）
      if (!source.startsWith('.') && !source.startsWith('/')) {
        continue;
      }

      // 提取导入的符号
      const symbols = this.extractImportSymbols(content, match[0], source);
      imports.push({ source, symbols });
    }

    // 匹配 require 语句
    const requireRegex = /(?:const|let|var)\s+\{([^}]+)\}\s*=\s*require\(['"]([^'"]+)['"]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const symbols = match[1].split(',').map(s => s.trim());
      imports.push({ source: match[2], symbols });
    }

    return imports;
  }

  /**
   * 提取导入的符号列表
   */
  private extractImportSymbols(content: string, importStatement: string, source: string): string[] {
    const symbols: string[] = [];

    // 命名导入: import { foo, bar } from './module'
    const namedMatch = importStatement.match(/\{([^}]+)\}/);
    if (namedMatch) {
      symbols.push(...namedMatch[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]));
    }

    // 默认导入: import Foo from './module'
    const defaultMatch = importStatement.match(/import\s+(\w+)\s+from/);
    if (defaultMatch && !importStatement.includes('{')) {
      symbols.push(defaultMatch[1]);
    }

    // 全部导入: import * as foo from './module'
    const namespaceMatch = importStatement.match(/import\s+\*\s+as\s+(\w+)\s+from/);
    if (namespaceMatch) {
      symbols.push(namespaceMatch[1]);
    }

    return symbols;
  }

  /**
   * 解析导入路径为实际文件路径
   */
  private resolveImportPaths(
    imports: Array<{ source: string; symbols: string[] }>,
    testFilePath: string
  ): string[] {
    const resolvedPaths: string[] = [];
    const testDir = path.dirname(testFilePath);
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.index.ts', '.index.tsx'];

    for (const imp of imports) {
      const sourcePath = imp.source;

      // 解析相对路径
      if (sourcePath.startsWith('.')) {
        const absolutePath = path.resolve(testDir, sourcePath);

        // 尝试不同的扩展名
        for (const ext of extensions) {
          const candidate = absolutePath + (sourcePath.endsWith(path.extname(sourcePath)) ? '' : ext);
          if (fs.existsSync(candidate)) {
            resolvedPaths.push(candidate);
            break;
          }
        }

        // 如果是目录导入，尝试 index 文件
        if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) {
          for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
            const indexPath = path.join(absolutePath, `index${ext}`);
            if (fs.existsSync(indexPath)) {
              resolvedPaths.push(indexPath);
              break;
            }
          }
        }
      }
    }

    return resolvedPaths;
  }

  /**
   * 推断测试文件对应的源文件
   *
   * 使用命名约定：foo.test.ts -> foo.ts
   */
  private inferSourceFiles(testPath: string): string[] {
    const sourceFiles: string[] = [];
    const testDir = path.dirname(testPath);
    const testBasename = path.basename(testPath);

    // 移除 .test.ts 或 .spec.ts 后缀
    const sourceBasename = testBasename
      .replace(/\.test\.(ts|tsx|js|jsx)$/, '.$1')
      .replace(/\.spec\.(ts|tsx|js|jsx)$/, '.$1');

    // 在对应源码目录中查找
    const sourceDir = testDir.replace(this.testRoot, this.sourceRoot);
    const candidatePath = path.join(sourceDir, sourceBasename);

    if (fs.existsSync(candidatePath)) {
      sourceFiles.push(candidatePath);
    }

    // 也尝试在 src 根目录查找
    const rootCandidate = path.join(this.sourceRoot, sourceBasename);
    if (fs.existsSync(rootCandidate)) {
      sourceFiles.push(rootCandidate);
    }

    return sourceFiles;
  }

  /**
   * 统计测试文件中的测试用例数量
   */
  private countTests(content: string): number {
    // 匹配 it()、test()、it.skip()、test.skip() 等
    const itRegex = /\b(?:it|test)\s*[.(]/g;
    let count = 0;
    let match;
    while ((match = itRegex.exec(content)) !== null) {
      count++;
    }
    return count || 1; // 至少为 1
  }

  /**
   * 提取测试用例信息
   */
  private extractTestCases(
    content: string,
    suiteId: string,
    testFilePath: string,
    sourceFiles: string[]
  ): TestCase[] {
    const cases: TestCase[] = [];
    const testRegex = /\b(?:it|test)\s*\((?:\s*['"`]([^'"`]+)['"`])/g;
    let match;

    while ((match = testRegex.exec(content)) !== null) {
      const testName = match[1];
      cases.push({
        id: `case-${uuidv4().substring(0, 8)}`,
        suiteId,
        name: testName,
        filePath: testFilePath,
        dependencies: sourceFiles.map(f => ({
          filePath: path.relative(this.sourceRoot, f),
          type: 'import',
        })),
        avgDuration: 0,
        flakyScore: 0,
        history: [],
      });
    }

    // 如果没有找到具体用例，创建一个默认代表
    if (cases.length === 0) {
      cases.push({
        id: `case-${uuidv4().substring(0, 8)}`,
        suiteId,
        name: 'default',
        filePath: testFilePath,
        dependencies: sourceFiles.map(f => ({
          filePath: path.relative(this.sourceRoot, f),
          type: 'import',
        })),
        avgDuration: 0,
        flakyScore: 0,
        history: [],
      });
    }

    return cases;
  }

  /**
   * 更新源文件到测试的反向索引
   */
  private updateSourceIndex(suiteId: string, sourcePaths: string[]): void {
    for (const sourcePath of sourcePaths) {
      if (!this.sourceToTestsIndex.has(sourcePath)) {
        this.sourceToTestsIndex.set(sourcePath, new Set());
      }
      this.sourceToTestsIndex.get(sourcePath)!.add(suiteId);
    }
  }
}
