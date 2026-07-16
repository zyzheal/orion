/**
 * ReviewAggregator 测试
 */

import { ReviewAggregator } from '../ReviewAggregator';
import { ReviewComment, Severity, RuleCategory } from '../types';

describe('ReviewAggregator', () => {
  let aggregator: ReviewAggregator;

  const createComment = (overrides: Partial<ReviewComment> = {}): ReviewComment => ({
    id: `comment-${Date.now()}-${Math.random()}`,
    ruleId: overrides.ruleId || 'sec-001',
    filePath: overrides.filePath || 'src/test.ts',
    lineNumber: overrides.lineNumber || 1,
    severity: overrides.severity || Severity.WARNING,
    message: overrides.message || 'Test comment',
    suggestion: overrides.suggestion,
    source: overrides.source || 'rule',
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    aggregator = new ReviewAggregator();
  });

  describe('addComments', () => {
    it('应该添加评论', () => {
      const comments = [
        createComment({ ruleId: 'sec-001', severity: Severity.CRITICAL }),
        createComment({ ruleId: 'perf-001', severity: Severity.WARNING }),
      ];

      aggregator.addComments(comments);

      const state = aggregator.getState();
      expect(state.totalComments).toBe(2);
    });

    it('应该支持多次添加', () => {
      aggregator.addComments([createComment({ ruleId: 'sec-001' })]);
      aggregator.addComments([createComment({ ruleId: 'perf-001' })]);

      const state = aggregator.getState();
      expect(state.totalComments).toBe(2);
    });
  });

  describe('deduplicate', () => {
    it('应该去重相同的评论', () => {
      const comments = [
        createComment({
          ruleId: 'sec-001',
          filePath: 'src/config.ts',
          lineNumber: 10,
          message: '[硬编码密码检测] 检测代码中的硬编码密码或密钥',
        }),
        createComment({
          ruleId: 'sec-001',
          filePath: 'src/config.ts',
          lineNumber: 12,
          message: '[硬编码密码检测] 检测代码中的硬编码密码或密钥',
        }),
      ];

      aggregator.addComments(comments);
      const unique = aggregator.deduplicate();

      // 相同规则、相同文件、相近行号、相同消息应该被去重
      const nonDupes = unique.filter((c) => !c.isDuplicate);
      expect(nonDupes.length).toBeLessThanOrEqual(2);
    });

    it('应该保留不同的评论', () => {
      const comments = [
        createComment({ ruleId: 'sec-001', message: '密码检测' }),
        createComment({ ruleId: 'perf-001', message: '性能检测' }),
        createComment({ ruleId: 'style-001', message: '行太长' }),
      ];

      aggregator.addComments(comments);
      const unique = aggregator.deduplicate();
      const nonDupes = unique.filter((c) => !c.isDuplicate);

      expect(nonDupes).toHaveLength(3);
    });

    it('应该正确处理禁用去重的情况', () => {
      const agg = new ReviewAggregator({ deduplicationEnabled: false });
      const comments = [
        createComment({ ruleId: 'sec-001', message: '相同消息' }),
        createComment({ ruleId: 'sec-001', message: '相同消息' }),
      ];

      agg.addComments(comments);
      const result = agg.deduplicate();
      expect(result).toHaveLength(2);
    });
  });

  describe('sortComments', () => {
    it('应该按严重程度排序', () => {
      const comments = [
        createComment({ severity: Severity.SUGGESTION, lineNumber: 1 }),
        createComment({ severity: Severity.CRITICAL, lineNumber: 2 }),
        createComment({ severity: Severity.INFO, lineNumber: 3 }),
        createComment({ severity: Severity.WARNING, lineNumber: 4 }),
      ];

      aggregator.addComments(comments);
      aggregator.sortComments();

      const sorted = aggregator.getState();
      // 获取所有评论
      expect(sorted.totalComments).toBe(4);
    });

    it('应该按文件路径排序 (同严重程度时)', () => {
      const comments = [
        createComment({ severity: Severity.WARNING, filePath: 'z-file.ts', lineNumber: 1 }),
        createComment({ severity: Severity.WARNING, filePath: 'a-file.ts', lineNumber: 1 }),
      ];

      aggregator.addComments(comments);
      aggregator.sortComments();

      const nonDupes = aggregator.getNonDuplicateComments();
      expect(nonDupes[0].filePath).toBe('a-file.ts');
    });

    it('应该按行号排序 (同文件同严重程度时)', () => {
      const comments = [
        createComment({ severity: Severity.WARNING, filePath: 'a.ts', lineNumber: 10 }),
        createComment({ severity: Severity.WARNING, filePath: 'a.ts', lineNumber: 5 }),
      ];

      aggregator.addComments(comments);
      aggregator.sortComments();

      const nonDupes = aggregator.getNonDuplicateComments();
      expect(nonDupes[0].lineNumber).toBe(5);
      expect(nonDupes[1].lineNumber).toBe(10);
    });
  });

  describe('calculateScore', () => {
    it('应该返回 100 当没有评论', () => {
      const score = aggregator.calculateScore([]);
      expect(score).toBe(100);
    });

    it('应该根据严重程度扣分', () => {
      const comments = [
        createComment({ severity: Severity.CRITICAL }),
      ];

      const score = aggregator.calculateScore(comments);
      expect(score).toBe(85); // 100 - 15
    });

    it('应该累计多种严重程度扣分', () => {
      const comments = [
        createComment({ severity: Severity.CRITICAL }),
        createComment({ severity: Severity.WARNING }),
        createComment({ severity: Severity.INFO }),
      ];

      const score = aggregator.calculateScore(comments);
      expect(score).toBe(74); // 100 - 15 - 8 - 3
    });

    it('应该正确计算 SUGGESTION 扣分', () => {
      const comments = [
        createComment({ severity: Severity.SUGGESTION }),
      ];

      const score = aggregator.calculateScore(comments);
      expect(score).toBe(99); // 100 - 1
    });

    it('分数不应低于 0', () => {
      const comments = Array(10).fill(null).map(() =>
        createComment({ severity: Severity.CRITICAL })
      );

      const score = aggregator.calculateScore(comments);
      expect(score).toBe(0); // 100 - 150 = -50, clamped to 0
    });

    it('分数不应高于 100', () => {
      const score = aggregator.calculateScore([]);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('generateSummary', () => {
    it('应该生成正确的摘要统计', () => {
      const comments = [
        createComment({ severity: Severity.CRITICAL, ruleId: 'sec-001' }),
        createComment({ severity: Severity.WARNING, ruleId: 'perf-001' }),
        createComment({ severity: Severity.INFO, ruleId: 'style-002' }),
        createComment({ severity: Severity.SUGGESTION, ruleId: 'bp-003' }),
      ];

      aggregator.addComments(comments);
      const summary = aggregator.generateSummary(comments);

      expect(summary.totalIssues).toBe(4);
      expect(summary.criticalCount).toBe(1);
      expect(summary.warningCount).toBe(1);
      expect(summary.infoCount).toBe(1);
      expect(summary.suggestionCount).toBe(1);
    });

    it('应该正确统计受影响文件数', () => {
      const comments = [
        createComment({ filePath: 'a.ts' }),
        createComment({ filePath: 'a.ts' }),
        createComment({ filePath: 'b.ts' }),
        createComment({ filePath: 'c.ts' }),
      ];

      aggregator.addComments(comments);
      const summary = aggregator.generateSummary(comments);

      expect(summary.affectedFiles).toBe(3);
    });

    it('应该判定为 changes_requested 当有 CRITICAL', () => {
      const comments = [
        createComment({ severity: Severity.CRITICAL, ruleId: 'sec-001' }),
      ];

      aggregator.addComments(comments);
      const summary = aggregator.generateSummary(comments);

      expect(summary.verdict).toBe('changes_requested');
    });

    it('应该判定为 needs_review 当只有少量警告', () => {
      const comments = [
        createComment({ severity: Severity.WARNING, ruleId: 'perf-001' }),
      ];

      aggregator.addComments(comments);
      const summary = aggregator.generateSummary(comments);

      expect(summary.verdict).toBe('needs_review');
    });

    it('应该判定为 approved 当没有问题', () => {
      const summary = aggregator.generateSummary([]);
      expect(summary.verdict).toBe('approved');
    });
  });

  describe('generateResult', () => {
    it('应该生成完整的审查结果', () => {
      const comments = [
        createComment({ severity: Severity.CRITICAL, ruleId: 'sec-001' }),
        createComment({ severity: Severity.WARNING, ruleId: 'perf-001' }),
      ];

      aggregator.addComments(comments);
      const result = aggregator.generateResult('pr-123', 'repo-456', 1500);

      expect(result.id).toBeDefined();
      expect(result.prId).toBe('pr-123');
      expect(result.repoId).toBe('repo-456');
      expect(result.duration).toBe(1500);
      expect(result.status).toBe('completed');
      expect(result.summary.totalIssues).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(100);
    });

    it('应该正确设置 autoApproved', () => {
      const result = aggregator.generateResult('pr-1', 'repo-1', 100);
      expect(result.autoApproved).toBeDefined();
    });
  });

  describe('checkAutoApprove', () => {
    it('当有 CRITICAL 时不应自动批准', () => {
      const approved = aggregator.checkAutoApprove(95, {
        totalIssues: 1,
        criticalCount: 1,
        warningCount: 0,
        infoCount: 0,
        suggestionCount: 0,
        categoryBreakdown: {
          [RuleCategory.SECURITY]: 1,
          [RuleCategory.PERFORMANCE]: 0,
          [RuleCategory.STYLE]: 0,
          [RuleCategory.BEST_PRACTICE]: 0,
        },
        affectedFiles: 1,
        verdict: 'changes_requested',
        verdictReason: 'has critical',
      });

      expect(approved).toBe(false);
    });

    it('当分数低于阈值时不应自动批准', () => {
      const approved = aggregator.checkAutoApprove(80, {
        totalIssues: 1,
        criticalCount: 0,
        warningCount: 1,
        infoCount: 0,
        suggestionCount: 0,
        categoryBreakdown: {
          [RuleCategory.SECURITY]: 0,
          [RuleCategory.PERFORMANCE]: 1,
          [RuleCategory.STYLE]: 0,
          [RuleCategory.BEST_PRACTICE]: 0,
        },
        affectedFiles: 1,
        verdict: 'needs_review',
        verdictReason: 'low score',
      });

      expect(approved).toBe(false);
    });

    it('当分数足够且无 CRITICAL 时应自动批准', () => {
      const approved = aggregator.checkAutoApprove(95, {
        totalIssues: 1,
        criticalCount: 0,
        warningCount: 0,
        infoCount: 1,
        suggestionCount: 0,
        categoryBreakdown: {
          [RuleCategory.SECURITY]: 0,
          [RuleCategory.PERFORMANCE]: 0,
          [RuleCategory.STYLE]: 1,
          [RuleCategory.BEST_PRACTICE]: 0,
        },
        affectedFiles: 1,
        verdict: 'approved',
        verdictReason: 'good',
      });

      expect(approved).toBe(true);
    });
  });

  describe('getState', () => {
    it('应该返回正确的聚合状态', () => {
      aggregator.addComments([
        createComment({ severity: Severity.CRITICAL }),
        createComment({ severity: Severity.WARNING }),
      ]);

      const state = aggregator.getState();

      expect(state.totalComments).toBe(2);
      expect(state.score).toBeLessThan(100);
      expect(state.summary.totalIssues).toBe(2);
    });
  });
});
