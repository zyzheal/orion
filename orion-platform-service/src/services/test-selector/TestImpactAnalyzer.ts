/**
 * TestImpactAnalyzer - 测试影响分析器
 *
 * 根据代码变更，分析哪些测试用例受到影响，
 * 计算影响评分并进行优先级排序。
 */

import {
  TestImpact,
  TestSuite,
  TestCase,
  ChangedFile,
  ImpactPriority,
  TestExecutionPlan,
  SelectedTest,
  SkippedTest,
} from './types';
import { TestDependencyAnalyzer } from './TestDependencyAnalyzer';

/**
 * 影响分析结果
 */
export interface ImpactAnalysisResult {
  /** 所有受影响的影响分析 */
  impacts: TestImpact[];
  /** 受影响的测试 ID 去重列表 */
  allAffectedTestIds: Set<string>;
  /** 总预估执行时长 */
  totalEstimatedDuration: number;
}

/**
 * 测试影响分析器
 *
 * 分析代码变更对测试的影响，推荐需要执行的测试。
 */
export class TestImpactAnalyzer {
  private dependencyAnalyzer: TestDependencyAnalyzer;

  constructor(dependencyAnalyzer: TestDependencyAnalyzer) {
    this.dependencyAnalyzer = dependencyAnalyzer;
  }

  /**
   * 分析变更影响
   *
   * 给定变更文件列表，找出所有受影响的测试。
   *
   * @param changedFiles 变更文件列表
   * @returns 影响分析结果
   */
  async analyzeImpact(changedFiles: ChangedFile[]): Promise<ImpactAnalysisResult> {
    const impacts: TestImpact[] = [];
    const allAffectedTestIds = new Set<string>();

    for (const changedFile of changedFiles) {
      const affectedTests = this.dependencyAnalyzer.getTestsForSourceFile(changedFile.path);

      if (affectedTests.length > 0) {
        const impactScore = this.calculateImpactScore(changedFile, affectedTests);
        const priority = this.assessPriority(impactScore, changedFile);
        const estimatedDuration = this.estimateDuration(affectedTests);

        impacts.push({
          changedFile: changedFile.path,
          changeType: changedFile.changeType,
          affectedTests,
          priority,
          estimatedDuration,
          impactScore,
        });

        affectedTests.forEach(id => allAffectedTestIds.add(id));
      }
    }

    // 按影响评分降序排序
    impacts.sort((a, b) => b.impactScore - a.impactScore);

    const totalEstimatedDuration = impacts.reduce((sum, i) => sum + i.estimatedDuration, 0);

    return {
      impacts,
      allAffectedTestIds,
      totalEstimatedDuration,
    };
  }

  /**
   * 获取受影响的测试
   *
   * @param sourceFilePath 源文件路径
   * @returns 受影响的测试列表
   */
  async getAffectedTests(sourceFilePath: string): Promise<{
    suites: TestSuite[];
    cases: TestCase[];
  }> {
    const testIds = this.dependencyAnalyzer.getTestsForSourceFile(sourceFilePath);
    const allSuites = this.dependencyAnalyzer.getSuites();
    const allCases = this.dependencyAnalyzer.getCases();

    const affectedSuites = allSuites.filter(s => testIds.includes(s.id));
    const affectedCases = allCases.filter(c => testIds.includes(c.id));

    return { suites: affectedSuites, cases: affectedCases };
  }

  /**
   * 计算影响评分
   *
   * 综合考虑变更类型、变更行数、测试数量等因素。
   * 评分范围 0-100。
   *
   * @param changedFile 变更文件
   * @param affectedTests 受影响的测试 ID 列表
   * @returns 影响评分 (0-100)
   */
  calculateImpactScore(changedFile: ChangedFile, affectedTests: string[]): number {
    let score = 0;

    // 变更类型权重 (0-30 分)
    switch (changedFile.changeType) {
      case 'deleted':
        score += 30;
        break;
      case 'modified':
        score += 20;
        break;
      case 'added':
        score += 15;
        break;
      case 'renamed':
        score += 10;
        break;
    }

    // 变更行数权重 (0-25 分)
    const totalChanges = changedFile.additions + changedFile.deletions;
    if (totalChanges > 100) {
      score += 25;
    } else if (totalChanges > 50) {
      score += 20;
    } else if (totalChanges > 20) {
      score += 15;
    } else if (totalChanges > 5) {
      score += 10;
    } else {
      score += 5;
    }

    // 受影响测试数量权重 (0-25 分)
    const testCount = affectedTests.length;
    if (testCount > 20) {
      score += 25;
    } else if (testCount > 10) {
      score += 20;
    } else if (testCount > 5) {
      score += 15;
    } else if (testCount > 1) {
      score += 10;
    } else {
      score += 5;
    }

    // 文件类型权重 (0-20 分)
    const fileType = this.getFileType(changedFile.path);
    switch (fileType) {
      case 'core':
        // 核心逻辑文件
        score += 20;
        break;
      case 'service':
        // 服务层文件
        score += 15;
        break;
      case 'api':
        // API/路由文件
        score += 12;
        break;
      case 'config':
        // 配置文件
        score += 8;
        break;
      case 'util':
        // 工具函数
        score += 10;
        break;
      default:
        score += 5;
    }

    // 限制在 0-100 范围
    return Math.min(100, Math.max(0, score));
  }

  /**
   * 根据变更文件和影响评分推荐优先级
   */
  private assessPriority(impactScore: number, changedFile: ChangedFile): ImpactPriority {
    // 删除操作始终是 critical
    if (changedFile.changeType === 'deleted') {
      return 'critical';
    }

    if (impactScore >= 75) {
      return 'critical';
    } else if (impactScore >= 50) {
      return 'high';
    } else if (impactScore >= 25) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * 预估测试执行总时长
   */
  private estimateDuration(affectedTestIds: string[]): number {
    const allSuites = this.dependencyAnalyzer.getSuites();
    const allCases = this.dependencyAnalyzer.getCases();
    let totalDuration = 0;

    for (const testId of affectedTestIds) {
      const suite = allSuites.find(s => s.id === testId);
      if (suite) {
        totalDuration += suite.avgDuration || 1000; // 默认 1s
        continue;
      }
      const testCase = allCases.find(c => c.id === testId);
      if (testCase) {
        totalDuration += testCase.avgDuration || 500; // 默认 0.5s
      } else {
        // 未知测试使用保守估计
        totalDuration += 1000;
      }
    }

    return totalDuration;
  }

  /**
   * 获取文件类型分类
   */
  private getFileType(filePath: string): 'core' | 'service' | 'api' | 'config' | 'util' | 'other' {
    const lowerPath = filePath.toLowerCase();

    if (lowerPath.includes('/services/') || lowerPath.includes('/service/')) {
      return 'service';
    }
    if (lowerPath.includes('/api/') || lowerPath.includes('/routes') || lowerPath.includes('/controller')) {
      return 'api';
    }
    if (lowerPath.includes('/config') || lowerPath.includes('.config.') || lowerPath.includes('.env')) {
      return 'config';
    }
    if (lowerPath.includes('/utils/') || lowerPath.includes('/helpers/') || lowerPath.includes('/lib/')) {
      return 'util';
    }
    if (
      lowerPath.includes('/engine/') ||
      lowerPath.includes('/core/') ||
      lowerPath.includes('/models/') ||
      lowerPath.includes('/model/')
    ) {
      return 'core';
    }

    return 'other';
  }

  /**
   * 获取测试覆盖率统计
   *
   * 返回每个源文件的测试覆盖情况。
   */
  getCoverageStats(): Map<string, { testCount: number; testIds: string[] }> {
    return this.dependencyAnalyzer.getTestCoverage();
  }

  /**
   * 查找未覆盖的源文件
   *
   * 给定所有源文件列表，返回没有被任何测试覆盖的文件。
   */
  findUncoveredFiles(allSourceFiles: string[]): string[] {
    const coverage = this.dependencyAnalyzer.getTestCoverage();
    return allSourceFiles.filter(f => !coverage.has(f) || coverage.get(f)!.testCount === 0);
  }
}
