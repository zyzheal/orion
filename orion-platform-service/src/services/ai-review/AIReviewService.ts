/**
 * AI 代码审查服务 - 主编排服务
 *
 * 功能：
 * 1. 编排完整的审查工作流
 * 2. 订阅 code.pr.opened NATS 事件
 * 3. 触发 diff 审查
 * 4. 查询审查历史
 * 5. 查询审查详情
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ReviewRequest,
  ReviewResponse,
  ReviewResult,
  ReviewComment,
  ReviewConfig,
  ReviewHistoryQuery,
  ReviewHistoryPage,
  RuleCategory,
  RuleCreateRequest,
  RuleUpdateRequest,
  ReviewRule,
} from './types';
import { DiffAnalyzer } from './DiffAnalyzer';
import { ReviewRuleEngine } from './ReviewRuleEngine';
import { ReviewRuleRepository } from '../../repositories/ReviewRuleRepository';
import { ReviewAggregator } from './ReviewAggregator';
import { ReviewIntegrationService } from './ReviewIntegrationService';
import { createLLMClient, LLMClient } from './LLMClient';
import pino from 'pino';

const logger = pino({ name: 'LA-LI-LReview-LService' });

/** 审查历史记录存储 (内存版，生产环境应使用数据库) */
interface ReviewHistoryEntry {
  result: ReviewResult;
  repoType: string;
  diffLength: number;
}

/**
 * AI 代码审查服务
 */
export class AIReviewService {
  private ruleEngine: ReviewRuleEngine;
  private diffAnalyzer: DiffAnalyzer;
  private integrationService: ReviewIntegrationService;
  private llmClient: LLMClient;
  private reviewHistory: ReviewHistoryEntry[];
  private config: ReviewConfig;
  private eventBus: any; // EventBusService

  constructor(options?: {
    config?: Partial<ReviewConfig>;
    eventBus?: any;
    customRules?: ReviewRule[];
    ruleRepository?: ReviewRuleRepository;
  }) {
    this.config = {
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
      ...options?.config,
    };

    this.ruleEngine = new ReviewRuleEngine(options?.ruleRepository, options?.customRules);
    this.diffAnalyzer = new DiffAnalyzer();
    this.integrationService = new ReviewIntegrationService(this.config);
    this.reviewHistory = [];
    this.eventBus = options?.eventBus;
    this.llmClient = createLLMClient(options?.config?.llm);

    // 如果提供了事件总线，订阅 code.pr.opened 事件
    if (this.eventBus) {
      this.subscribeToEvents();
    }
  }

  /**
   * 审查 PR (完整工作流)
   */
  async reviewPR(request: ReviewRequest): Promise<ReviewResponse> {
    const startTime = Date.now();

    try {
      // 1. 解析 diff
      const diffResult = this.diffAnalyzer.parseDiff(request.diff);

      if (diffResult.files.length === 0) {
        return {
          result: this.createEmptyResult(request.prId, request.repoId, Date.now() - startTime),
          success: true,
        };
      }

      // 2. 运行规则审查
      const { comments: ruleComments, stats } = this.ruleEngine.runReview(
        request.diff
      );

      // 3. 聚合结果
      const aggregator = new ReviewAggregator(this.config);
      aggregator.addComments(ruleComments);

      // 4. Call AI review (falls back to empty if LLM unavailable)
      const aiComments = await this.callAIReview(request.diff);
      aggregator.addComments(aiComments);

      // 5. 生成最终结果
      const duration = Date.now() - startTime;
      const result = aggregator.generateResult(request.prId, request.repoId, duration);

      // 6. 发布评论到 PR
      const repoType = request.repoType || 'gitlab';
      await this.integrationService.postReviewComments(
        repoType,
        request.repoId,
        request.prId,
        result
      );

      // 7. 保存历史记录
      this.reviewHistory.push({
        result,
        repoType,
        diffLength: request.diff.length,
      });

      return { result, success: true };
    } catch (error) {
      return {
        result: this.createFailedResult(request.prId, request.repoId, Date.now() - startTime),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 仅审查 diff (不发布到 PR)
   */
  reviewDiff(diffText: string, prId?: string): {
    comments: ReviewComment[];
    score: number;
    stats: {
      totalLines: number;
      matchedLines: number;
      rulesEvaluated: number;
      filesChanged: number;
      totalAdditions: number;
      totalDeletions: number;
    };
  } {
    const startTime = Date.now();

    // 1. 运行规则审查
    const { comments, stats } = this.ruleEngine.runReview(diffText);

    // 2. 解析 diff 统计
    const diffResult = this.diffAnalyzer.parseDiff(diffText);

    // 3. 聚合
    const aggregator = new ReviewAggregator(this.config);
    aggregator.addComments(comments);
    const uniqueComments = aggregator.getNonDuplicateComments();
    const score = aggregator.calculateScore(uniqueComments);

    return {
      comments: uniqueComments,
      score,
      stats: {
        ...stats,
        filesChanged: diffResult.files.length,
        totalAdditions: diffResult.totalAdditions,
        totalDeletions: diffResult.totalDeletions,
      },
    };
  }

  /**
   * 获取审查历史
   */
  getReviewHistory(query?: ReviewHistoryQuery): ReviewHistoryPage {
    let results = this.reviewHistory.map((entry) => entry.result);

    // 过滤
    if (query?.repoId) {
      results = results.filter((r) => r.repoId === query.repoId);
    }
    if (query?.prId) {
      results = results.filter((r) => r.prId === query.prId);
    }
    if (query?.status) {
      results = results.filter((r) => r.status === query.status);
    }

    // 按创建时间倒序
    results.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // 分页
    const page = query?.page || 1;
    const perPage = query?.perPage || 20;
    const start = (page - 1) * perPage;
    const paginatedResults = results.slice(start, start + perPage);

    return {
      results: paginatedResults,
      total: results.length,
      page,
      perPage,
    };
  }

  /**
   * 获取审查详情
   */
  getReviewDetail(reviewId: string): ReviewResult | undefined {
    const entry = this.reviewHistory.find(
      (e) => e.result.id === reviewId
    );
    return entry?.result;
  }

  /**
   * 获取所有审查规则
   */
  async getRules(): Promise<ReviewRule[]> {
    return this.ruleEngine.getAllRules();
  }

  /**
   * 获取启用的审查规则
   */
  async getEnabledRules(): Promise<ReviewRule[]> {
    return this.ruleEngine.getEnabledRules();
  }

  /**
   * 获取单个规则
   */
  async getRule(ruleId: string): Promise<ReviewRule | undefined> {
    return this.ruleEngine.getRule(ruleId);
  }

  /**
   * 创建审查规则
   */
  async createRule(request: RuleCreateRequest): Promise<ReviewRule> {
    const rule: ReviewRule = {
      id: uuidv4(),
      name: request.name,
      category: request.category,
      severity: request.severity,
      pattern: request.pattern,
      description: request.description,
      suggestion: request.suggestion,
      enabled: true,
      fileExtensions: request.fileExtensions,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    await this.ruleEngine.registerRule(rule);
    return rule;
  }

  /**
   * 更新审查规则
   */
  async updateRule(ruleId: string, request: RuleUpdateRequest): Promise<ReviewRule | undefined> {
    const updates: Partial<ReviewRule> = {};

    if (request.name !== undefined) updates.name = request.name;
    if (request.category !== undefined) updates.category = request.category;
    if (request.severity !== undefined) updates.severity = request.severity;
    if (request.pattern !== undefined) updates.pattern = request.pattern;
    if (request.description !== undefined) updates.description = request.description;
    if (request.suggestion !== undefined) updates.suggestion = request.suggestion;
    if (request.enabled !== undefined) updates.enabled = request.enabled;
    if (request.fileExtensions !== undefined) updates.fileExtensions = request.fileExtensions;

    return this.ruleEngine.updateRule(ruleId, updates);
  }

  /**
   * 删除审查规则
   */
  async deleteRule(ruleId: string): Promise<boolean> {
    return this.ruleEngine.removeRule(ruleId);
  }

  /**
   * 启用/禁用规则
   */
  async toggleRule(ruleId: string, enabled: boolean): Promise<ReviewRule | undefined> {
    return this.ruleEngine.updateRule(ruleId, { enabled });
  }

  /**
   * 获取审查配置
   */
  getConfig(): ReviewConfig {
    return { ...this.config };
  }

  /**
   * 更新审查配置
   */
  updateConfig(updates: Partial<ReviewConfig>): ReviewConfig {
    this.config = { ...this.config, ...updates };
    return this.config;
  }

  // ==================== 内部方法 ====================

  /**
   * Call LLM API for AI code review
   * Falls back to empty array if LLM is unavailable
   */
  private async callAIReview(diff: string): Promise<ReviewComment[]> {
    return this.llmClient.reviewDiff(diff);
  }

  /**
   * 订阅 NATS 事件
   */
  private async subscribeToEvents(): Promise<void> {
    if (!this.eventBus) return;

    try {
      await this.eventBus.subscribe(
        'code.pr.opened',
        async (event: any) => {
          logger.info('[AIReview] Received code.pr.opened event:', event.type);
          // 这里可以从事件中提取 diff 并触发审查
          // 实际实现需要获取 diff 内容
        },
        { filterSubject: 'code.pr.opened' }
      );

      await this.eventBus.subscribe(
        'code.pr.updated',
        async (event: any) => {
          logger.info('[AIReview] Received code.pr.updated event:', event.type);
        },
        { filterSubject: 'code.pr.updated' }
      );

      logger.info('[AIReview] Subscribed to code review events');
    } catch (error) {
      logger.warn('[AIReview] Failed to subscribe to events:', error);
    }
  }

  /**
   * 创建空审查结果 (无变更)
   */
  private createEmptyResult(
    prId: string,
    repoId: string,
    duration: number
  ): ReviewResult {
    return {
      id: uuidv4(),
      prId,
      repoId,
      comments: [],
      summary: {
        totalIssues: 0,
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
        verdictReason: 'No changes detected',
      },
      score: 100,
      duration,
      status: 'completed',
      autoApproved: true,
      createdAt: new Date(),
      completedAt: new Date(),
    };
  }

  /**
   * 创建失败审查结果
   */
  private createFailedResult(
    prId: string,
    repoId: string,
    duration: number
  ): ReviewResult {
    return {
      id: uuidv4(),
      prId,
      repoId,
      comments: [],
      summary: {
        totalIssues: 0,
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
        verdict: 'needs_review',
        verdictReason: 'Review failed, please check manually',
      },
      score: 0,
      duration,
      status: 'failed',
      autoApproved: false,
      createdAt: new Date(),
      completedAt: new Date(),
    };
  }
}
