/**
 * 审查结果聚合器
 *
 * 功能：
 * 1. 收集来自多个来源 (规则引擎、AI API) 的审查评论
 * 2. 去重相似的评论
 * 3. 按严重程度和文件排序
 * 4. 计算审查评分
 * 5. 生成审查摘要报告
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ReviewComment,
  ReviewResult,
  ReviewSummary,
  Severity,
  RuleCategory,
  ReviewStatus,
  ReviewConfig,
} from './types';

/** 默认配置 */
const DEFAULT_CONFIG: ReviewConfig = {
  rules: [],
  enabledCategories: [
    RuleCategory.SECURITY,
    RuleCategory.PERFORMANCE,
    RuleCategory.STYLE,
    RuleCategory.BEST_PRACTICE,
  ],
  maxCommentsPerFile: 20,
  maxTotalComments: 100,
  autoApproveThreshold: 90,
  deduplicationEnabled: true,
  similarityThreshold: 0.8,
  postCommentsToPR: true,
};

/**
 * 审查结果聚合器
 */
export class ReviewAggregator {
  private config: ReviewConfig;
  private comments: ReviewComment[];
  private reviewStartTime: Date;

  constructor(config?: Partial<ReviewConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.comments = [];
    this.reviewStartTime = new Date();
  }

  /**
   * 添加审查评论
   */
  addComments(newComments: ReviewComment[]): void {
    this.comments.push(...newComments);
  }

  /**
   * 去重相似评论
   * 使用内容相似度来判断重复
   */
  deduplicate(): ReviewComment[] {
    if (!this.config.deduplicationEnabled) {
      return this.comments;
    }

    const uniqueComments: ReviewComment[] = [];
    const seen = new Set<string>();

    for (const comment of this.comments) {
      // 创建去重键: 文件路径 + 规则 ID + 近似行号 (每10行为一个区间)
      const lineBucket = Math.floor(comment.lineNumber / 10) * 10;
      const dedupKey = `${comment.filePath}:${comment.ruleId}:${lineBucket}:${this.normalizeMessage(comment.message)}`;

      if (!seen.has(dedupKey)) {
        seen.add(dedupKey);
        uniqueComments.push(comment);
      } else {
        // 标记为重复
        comment.isDuplicate = true;
      }
    }

    // 额外去重: 同一文件、同一严重程度、相似内容
    const additionallyDeduped: ReviewComment[] = [];
    const contentSeen = new Map<string, ReviewComment>();

    for (const comment of uniqueComments) {
      if (comment.isDuplicate) {
        additionallyDeduped.push(comment);
        continue;
      }

      const contentKey = `${comment.filePath}:${comment.severity}:${this.normalizeMessage(comment.message)}`;
      const existing = contentSeen.get(contentKey);

      if (existing) {
        // 检查相似度
        const similarity = this.calculateSimilarity(
          existing.message,
          comment.message
        );
        if (similarity >= this.config.similarityThreshold) {
          comment.isDuplicate = true;
        }
      } else {
        contentSeen.set(contentKey, comment);
      }

      additionallyDeduped.push(comment);
    }

    this.comments = additionallyDeduped;
    return this.getNonDuplicateComments();
  }

  /**
   * 获取非重复评论
   */
  getNonDuplicateComments(): ReviewComment[] {
    return this.comments.filter((c) => !c.isDuplicate);
  }

  /**
   * 按严重程度和文件排序
   */
  sortComments(): ReviewComment[] {
    const severityOrder: Record<Severity, number> = {
      [Severity.CRITICAL]: 0,
      [Severity.WARNING]: 1,
      [Severity.INFO]: 2,
      [Severity.SUGGESTION]: 3,
    };

    this.comments.sort((a, b) => {
      // 首先按严重程度排序
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;

      // 然后按文件路径排序
      const pathDiff = a.filePath.localeCompare(b.filePath);
      if (pathDiff !== 0) return pathDiff;

      // 最后按行号排序
      return a.lineNumber - b.lineNumber;
    });

    return this.comments;
  }

  /**
   * 计算审查评分 (0-100)
   * 评分越高表示代码质量越好
   */
  calculateScore(comments?: ReviewComment[]): number {
    const targetComments = comments || this.getNonDuplicateComments();

    // 权重: CRITICAL 扣分最多，SUGGESTION 扣分最少
    const severityWeights: Record<Severity, number> = {
      [Severity.CRITICAL]: 15,
      [Severity.WARNING]: 8,
      [Severity.INFO]: 3,
      [Severity.SUGGESTION]: 1,
    };

    let totalDeduction = 0;
    for (const comment of targetComments) {
      totalDeduction += severityWeights[comment.severity] || 0;
    }

    // 基础分 100，减去扣分，最低 0
    const score = Math.max(0, 100 - totalDeduction);
    return Math.min(100, score);
  }

  /**
   * 生成审查摘要
   */
  generateSummary(comments?: ReviewComment[]): ReviewSummary {
    const targetComments = comments || this.getNonDuplicateComments();

    const summary: ReviewSummary = {
      totalIssues: targetComments.length,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      suggestionCount: 0,
      categoryBreakdown: {
        [RuleCategory.SECURITY]: 0,
        [RuleCategory.PERFORMANCE]: 0,
        [RuleCategory.STYLE]: 0,
        [RuleCategory.BEST_PRACTICE]: 0,
      },
      affectedFiles: 0,
      verdict: 'approved',
      verdictReason: '',
    };

    const affectedFilesSet = new Set<string>();

    for (const comment of targetComments) {
      // 统计严重程度
      switch (comment.severity) {
        case Severity.CRITICAL:
          summary.criticalCount++;
          break;
        case Severity.WARNING:
          summary.warningCount++;
          break;
        case Severity.INFO:
          summary.infoCount++;
          break;
        case Severity.SUGGESTION:
          summary.suggestionCount++;
          break;
      }

      // 统计分类
      // 需要通过 ruleId 查找规则分类
      const category = this.inferCategory(comment);
      if (category && Object.prototype.hasOwnProperty.call(summary.categoryBreakdown, category)) {
        summary.categoryBreakdown[category]++;
      }

      affectedFilesSet.add(comment.filePath);
    }

    summary.affectedFiles = affectedFilesSet.size;

    // 判定审查结论
    const { verdict, verdictReason } = this.determineVerdict(summary);
    summary.verdict = verdict;
    summary.verdictReason = verdictReason;

    return summary;
  }

  /**
   * 生成完整审查结果
   */
  generateResult(
    prId: string,
    repoId: string,
    duration: number
  ): ReviewResult {
    const sortedComments = this.sortComments();
    const dedupedComments = this.deduplicate();
    const finalComments = this.limitComments(dedupedComments);
    const score = this.calculateScore(finalComments);
    const summary = this.generateSummary(finalComments);

    // 检查是否自动批准
    const autoApproved = this.checkAutoApprove(score, summary);

    return {
      id: uuidv4(),
      prId,
      repoId,
      comments: finalComments,
      summary,
      score,
      duration,
      status: 'completed' as ReviewStatus,
      autoApproved,
      createdAt: this.reviewStartTime,
      completedAt: new Date(),
    };
  }

  /**
   * 检查是否应自动批准
   */
  checkAutoApprove(score: number, summary: ReviewSummary): boolean {
    // 有 CRITICAL 问题不能自动批准
    if (summary.criticalCount > 0) {
      return false;
    }

    // 评分低于阈值不能自动批准
    if (score < this.config.autoApproveThreshold) {
      return false;
    }

    return true;
  }

  /**
   * 获取聚合器状态
   */
  getState(): {
    totalComments: number;
    uniqueComments: number;
    duplicateComments: number;
    score: number;
    summary: ReviewSummary;
  } {
    const unique = this.getNonDuplicateComments();
    const duplicates = this.comments.filter((c) => c.isDuplicate);
    const summary = this.generateSummary(unique);

    return {
      totalComments: this.comments.length,
      uniqueComments: unique.length,
      duplicateComments: duplicates.length,
      score: this.calculateScore(unique),
      summary,
    };
  }

  // ==================== 内部方法 ====================

  /**
   * 限制评论数量
   */
  private limitComments(comments: ReviewComment[]): ReviewComment[] {
    // 按文件分组
    const byFile = new Map<string, ReviewComment[]>();
    for (const comment of comments) {
      const fileComments = byFile.get(comment.filePath) || [];
      fileComments.push(comment);
      byFile.set(comment.filePath, fileComments);
    }

    // 限制每个文件的评论数
    const limited: ReviewComment[] = [];
    for (const [filePath, fileComments] of byFile) {
      const fileLimited = fileComments.slice(0, this.config.maxCommentsPerFile);
      limited.push(...fileLimited);
    }

    // 限制总评论数
    if (limited.length > this.config.maxTotalComments) {
      // 优先保留严重程度高的
      const severityOrder: Record<Severity, number> = {
        [Severity.CRITICAL]: 0,
        [Severity.WARNING]: 1,
        [Severity.INFO]: 2,
        [Severity.SUGGESTION]: 3,
      };
      limited.sort(
        (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
      );
      return limited.slice(0, this.config.maxTotalComments);
    }

    return limited;
  }

  /**
   * 判定审查结论
   */
  private determineVerdict(summary: ReviewSummary): {
    verdict: ReviewSummary['verdict'];
    verdictReason: string;
  } {
    if (summary.criticalCount > 0) {
      return {
        verdict: 'changes_requested',
        verdictReason: `发现 ${summary.criticalCount} 个严重问题，必须修复后才能合并`,
      };
    }

    if (summary.warningCount > 5) {
      return {
        verdict: 'changes_requested',
        verdictReason: `发现 ${summary.warningCount} 个警告，建议修复后重新审查`,
      };
    }

    if (summary.warningCount > 0) {
      return {
        verdict: 'needs_review',
        verdictReason: `发现 ${summary.warningCount} 个警告和 ${summary.infoCount + summary.suggestionCount} 个建议，请人工审查`,
      };
    }

    if (summary.infoCount > 0 || summary.suggestionCount > 0) {
      return {
        verdict: 'approved',
        verdictReason: `代码质量良好，有 ${summary.infoCount + summary.suggestionCount} 个建议可以改进`,
      };
    }

    return {
      verdict: 'approved',
      verdictReason: '代码质量优秀，未发现任何问题',
    };
  }

  /**
   * 推断评论对应的规则分类
   */
  private inferCategory(comment: ReviewComment): RuleCategory | null {
    // 从 ruleId 前缀推断分类
    if (comment.ruleId.startsWith('sec-')) return RuleCategory.SECURITY;
    if (comment.ruleId.startsWith('perf-')) return RuleCategory.PERFORMANCE;
    if (comment.ruleId.startsWith('style-')) return RuleCategory.STYLE;
    if (comment.ruleId.startsWith('bp-')) return RuleCategory.BEST_PRACTICE;
    if (comment.ruleId === 'ai-generated') return RuleCategory.BEST_PRACTICE;
    return null;
  }

  /**
   * 标准化消息 (用于去重比较)
   */
  private normalizeMessage(message: string): string {
    return message
      .toLowerCase()
      .replace(/\[.*?\]/g, '') // 移除方括号内容 (如规则名称)
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 计算两个字符串的相似度 (Jaccard 相似度)
   */
  private calculateSimilarity(a: string, b: string): number {
    const normA = this.normalizeMessage(a);
    const normB = this.normalizeMessage(b);

    if (normA === normB) return 1.0;

    // 使用 n-gram 相似度
    const n = 3;
    const ngramsA = this.getNgrams(normA, n);
    const ngramsB = this.getNgrams(normB, n);

    if (ngramsA.size === 0 && ngramsB.size === 0) return 1.0;
    if (ngramsA.size === 0 || ngramsB.size === 0) return 0.0;

    let intersection = 0;
    for (const ngram of ngramsA) {
      if (ngramsB.has(ngram)) {
        intersection++;
      }
    }

    const union = ngramsA.size + ngramsB.size - intersection;
    return intersection / union;
  }

  /**
   * 获取字符串的 n-gram 集合
   */
  private getNgrams(str: string, n: number): Set<string> {
    const ngrams = new Set<string>();
    const normalized = str.replace(/\s+/g, ' ');

    if (normalized.length < n) {
      ngrams.add(normalized);
      return ngrams;
    }

    for (let i = 0; i <= normalized.length - n; i++) {
      ngrams.add(normalized.substring(i, i + n));
    }

    return ngrams;
  }
}
