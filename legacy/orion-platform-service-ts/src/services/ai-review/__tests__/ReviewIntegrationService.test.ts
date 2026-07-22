/**
 * ReviewIntegrationService 测试
 */

import { ReviewIntegrationService } from '../ReviewIntegrationService';
import {
  ReviewResult,
  ReviewComment,
  ReviewSummary,
  Severity,
  RuleCategory,
  ReviewStatus,
} from '../types';

describe('ReviewIntegrationService', () => {
  let service: ReviewIntegrationService;

  const createReviewResult = (overrides: Partial<ReviewResult> = {}): ReviewResult => ({
    id: 'review-001',
    prId: overrides.prId || 'mr-123',
    repoId: overrides.repoId || 'repo-456',
    comments: overrides.comments || [],
    summary: overrides.summary || {
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
      verdictReason: 'No issues found',
    },
    score: overrides.score ?? 100,
    duration: overrides.duration ?? 1000,
    status: overrides.status || ('completed' as ReviewStatus),
    autoApproved: overrides.autoApproved ?? false,
    createdAt: new Date(),
    completedAt: new Date(),
  });

  beforeEach(() => {
    service = new ReviewIntegrationService();
  });

  describe('postReviewComments', () => {
    it('应该成功发布评论到 GitLab', async () => {
      const result = createReviewResult({
        comments: [
          {
            id: 'c1',
            ruleId: 'sec-001',
            filePath: 'src/config.ts',
            lineNumber: 10,
            severity: Severity.CRITICAL,
            message: 'Hardcoded password',
            suggestion: 'Use env vars',
            source: 'rule',
            createdAt: new Date(),
          },
        ],
        score: 85,
      });

      const updateResult = await service.postReviewComments(
        'gitlab',
        'repo-1',
        'mr-123',
        result
      );

      expect(updateResult.success).toBe(true);
      expect(updateResult.labelsUpdated).toBe(true);
    });

    it('应该成功发布评论到 Gerrit', async () => {
      const result = createReviewResult({
        comments: [
          {
            id: 'c1',
            ruleId: 'perf-001',
            filePath: 'src/db.ts',
            lineNumber: 25,
            severity: Severity.WARNING,
            message: 'N+1 query detected',
            suggestion: 'Use batch query',
            source: 'rule',
            createdAt: new Date(),
          },
        ],
        score: 80,
      });

      const updateResult = await service.postReviewComments(
        'gerrit',
        'repo-1',
        'change-456',
        result
      );

      expect(updateResult.success).toBe(true);
    });

    it('应该成功发布评论到 GitHub', async () => {
      const result = createReviewResult({
        score: 90,
      });

      const updateResult = await service.postReviewComments(
        'github',
        'owner/repo',
        'pr-789',
        result
      );

      expect(updateResult.success).toBe(true);
    });

    it('当 postCommentsToPR 为 false 时不应发布', async () => {
      const noPostService = new ReviewIntegrationService({
        postCommentsToPR: false,
      });

      const result = createReviewResult({
        comments: [
          {
            id: 'c1',
            ruleId: 'sec-001',
            filePath: 'src/test.ts',
            lineNumber: 1,
            severity: Severity.CRITICAL,
            message: 'test',
            source: 'rule',
            createdAt: new Date(),
          },
        ],
      });

      const updateResult = await noPostService.postReviewComments(
        'gitlab',
        'repo-1',
        'mr-123',
        result
      );

      expect(updateResult.success).toBe(true);
      expect(updateResult.commentsPosted).toBe(0);
    });
  });

  describe('updatePRLabels', () => {
    it('应该生成正确的标签', async () => {
      const result = createReviewResult({
        score: 95,
        autoApproved: true,
      });

      const updated = await service.updatePRLabels(
        'gitlab',
        'repo-1',
        'mr-123',
        result
      );

      expect(updated).toBe(true);
    });

    it('应为 CRITICAL 问题生成相应标签', async () => {
      const result = createReviewResult({
        score: 50,
        summary: {
          totalIssues: 3,
          criticalCount: 2,
          warningCount: 1,
          infoCount: 0,
          suggestionCount: 0,
          categoryBreakdown: {
            [RuleCategory.SECURITY]: 2,
            [RuleCategory.PERFORMANCE]: 0,
            [RuleCategory.STYLE]: 1,
            [RuleCategory.BEST_PRACTICE]: 0,
          },
          affectedFiles: 2,
          verdict: 'changes_requested',
          verdictReason: 'critical issues found',
        },
      });

      const updated = await service.updatePRLabels(
        'gitlab',
        'repo-1',
        'mr-123',
        result
      );

      expect(updated).toBe(true);
    });
  });

  describe('checkAutoApprove', () => {
    it('当 autoApproved 为 false 时不应批准', async () => {
      const result = createReviewResult({ autoApproved: false });

      const approved = await service.checkAutoApprove(
        'gitlab',
        'repo-1',
        'mr-123',
        result
      );

      expect(approved).toBe(false);
    });

    it('当 autoApproved 为 true 时应批准', async () => {
      const result = createReviewResult({ autoApproved: true });

      const approved = await service.checkAutoApprove(
        'gerrit',
        'repo-1',
        'change-456',
        result
      );

      expect(approved).toBe(true);
    });
  });

  describe('generateReviewReport', () => {
    it('应该生成 approved 报告', () => {
      const result = createReviewResult({
        score: 95,
        summary: {
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
          verdictReason: 'Code quality is good',
        },
      });

      const report = service.generateReviewReport(result);

      expect(report).toContain('AI Code Review Report');
      expect(report).toContain('Score: 95/100');
      expect(report).toContain('APPROVED');
    });

    it('应该生成 changes_requested 报告', () => {
      const result = createReviewResult({
        score: 60,
        comments: [
          {
            id: 'c1',
            ruleId: 'sec-001',
            filePath: 'src/config.ts',
            lineNumber: 10,
            severity: Severity.CRITICAL,
            message: 'Hardcoded password detected',
            suggestion: 'Use environment variables',
            codeSnippet: "const password = 'secret';",
            source: 'rule',
            createdAt: new Date(),
          },
        ],
        summary: {
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
          verdictReason: 'Critical security issue found',
        },
      });

      const report = service.generateReviewReport(result);

      expect(report).toContain('CHANGES_REQUESTED');
      expect(report).toContain('CRITICAL (1)');
      expect(report).toContain('Hardcoded password detected');
      expect(report).toContain('Use environment variables');
    });

    it('应该包含审查摘要表格', () => {
      const result = createReviewResult({
        summary: {
          totalIssues: 5,
          criticalCount: 1,
          warningCount: 2,
          infoCount: 1,
          suggestionCount: 1,
          categoryBreakdown: {
            [RuleCategory.SECURITY]: 1,
            [RuleCategory.PERFORMANCE]: 2,
            [RuleCategory.STYLE]: 1,
            [RuleCategory.BEST_PRACTICE]: 1,
          },
          affectedFiles: 3,
          verdict: 'needs_review',
          verdictReason: 'Multiple warnings found',
        },
        duration: 2500,
      });

      const report = service.generateReviewReport(result);

      expect(report).toContain('| Total Issues | 5 |');
      expect(report).toContain('| Critical | 1 |');
      expect(report).toContain('| Warning | 2 |');
      expect(report).toContain('| Duration | 2500ms |');
    });

    it('应该包含自动批准提示', () => {
      const result = createReviewResult({
        autoApproved: true,
        score: 95,
      });

      const report = service.generateReviewReport(result);

      expect(report).toContain('automatically approved');
    });

    it('应该按严重程度分组显示评论', () => {
      const result = createReviewResult({
        comments: [
          {
            id: 'c1',
            ruleId: 'sec-001',
            filePath: 'src/a.ts',
            lineNumber: 10,
            severity: Severity.CRITICAL,
            message: 'Critical issue in a.ts',
            source: 'rule',
            createdAt: new Date(),
          },
          {
            id: 'c2',
            ruleId: 'perf-001',
            filePath: 'src/b.ts',
            lineNumber: 20,
            severity: Severity.WARNING,
            message: 'Warning in b.ts',
            source: 'rule',
            createdAt: new Date(),
          },
        ],
      });

      const report = service.generateReviewReport(result);

      expect(report).toContain('CRITICAL (1)');
      expect(report).toContain('WARNING (1)');
      expect(report).toContain('Critical issue in a.ts');
      expect(report).toContain('Warning in b.ts');
    });
  });
});
