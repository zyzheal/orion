/**
 * AIReviewService 测试
 */

import { AIReviewService } from '../AIReviewService';
import {
  ReviewRequest,
  RuleCategory,
  Severity,
  ReviewStatus,
} from '../types';

describe('AIReviewService', () => {
  let service: AIReviewService;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });
    service = new AIReviewService();
  });

  afterEach(() => jest.restoreAllMocks());

  const sampleDiff = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,3 +1,5 @@
 import express from 'express';
+const password = 'secret123';
+console.log('debug mode');

 const app = express();
diff --git a/src/utils.ts b/src/utils.ts
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -5,3 +5,5 @@ function process(input: any) {
+  eval(input);
+  // TODO: fix this
   return input;
 }
`;

  describe('reviewPR', () => {
    it('应该成功审查 PR', async () => {
      const request: ReviewRequest = {
        prId: 'mr-123',
        repoId: 'repo-456',
        diff: sampleDiff,
        repoType: 'gitlab',
      };

      const response = await service.reviewPR(request);

      expect(response.success).toBe(true);
      expect(response.result.prId).toBe('mr-123');
      expect(response.result.repoId).toBe('repo-456');
      expect(response.result.status).toBe('completed');
      expect(response.result.comments.length).toBeGreaterThan(0);
      expect(response.result.score).toBeLessThan(100);
      expect(response.result.duration).toBeGreaterThanOrEqual(0);
    });

    it('应该对空 diff 返回空结果', async () => {
      const request: ReviewRequest = {
        prId: 'mr-empty',
        repoId: 'repo-456',
        diff: '',
        repoType: 'gitlab',
      };

      const response = await service.reviewPR(request);

      expect(response.success).toBe(true);
      expect(response.result.comments).toHaveLength(0);
      expect(response.result.score).toBe(100);
      expect(response.result.autoApproved).toBe(true);
    });

    it('应该检测安全问题', async () => {
      const request: ReviewRequest = {
        prId: 'mr-security',
        repoId: 'repo-456',
        diff: `diff --git a/src/secret.ts b/src/secret.ts
--- a/src/secret.ts
+++ b/src/secret.ts
@@ -1 +1,2 @@
+const apiKey = 'sk-123456789abcdef';
+const password = 'admin123';
`,
      };

      const response = await service.reviewPR(request);

      expect(response.success).toBe(true);
      expect(response.result.comments.length).toBeGreaterThan(0);

      const securityComments = response.result.comments.filter(
        (c) => c.ruleId.startsWith('sec-')
      );
      expect(securityComments.length).toBeGreaterThan(0);
    });

    it('应该设置审查状态', async () => {
      const request: ReviewRequest = {
        prId: 'mr-status',
        repoId: 'repo-456',
        diff: sampleDiff,
      };

      const response = await service.reviewPR(request);

      expect(response.result.status).toBe('completed');
      expect(response.result.completedAt).toBeDefined();
    });
  });

  describe('reviewDiff', () => {
    it('应该返回评论和统计', () => {
      const result = service.reviewDiff(sampleDiff);

      expect(result.comments.length).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(100);
      expect(result.stats.totalLines).toBeGreaterThan(0);
      expect(result.stats.filesChanged).toBeGreaterThan(0);
      expect(result.stats.rulesEvaluated).toBeGreaterThan(0);
    });

    it('应该返回正确的变更统计', () => {
      const diff = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1,4 @@
+line1
+line2
+line3
`;

      const result = service.reviewDiff(diff);

      expect(result.stats.totalAdditions).toBe(3);
      expect(result.stats.totalDeletions).toBe(0);
      expect(result.stats.filesChanged).toBe(1);
    });

    it('应该对干净代码返回高分', () => {
      const cleanDiff = `diff --git a/src/clean.ts b/src/clean.ts
--- a/src/clean.ts
+++ b/src/clean.ts
@@ -1 +1,2 @@
+const greeting: string = 'hello';
`;

      const result = service.reviewDiff(cleanDiff);

      expect(result.score).toBe(100);
      expect(result.comments).toHaveLength(0);
    });
  });

  describe('getReviewHistory', () => {
    it('应该在审查后返回历史记录', async () => {
      const request: ReviewRequest = {
        prId: 'mr-history',
        repoId: 'repo-456',
        diff: sampleDiff,
      };

      await service.reviewPR(request);

      const history = service.getReviewHistory();

      expect(history.total).toBeGreaterThanOrEqual(1);
      expect(history.results.length).toBeGreaterThanOrEqual(1);
    });

    it('应该支持按 PR ID 过滤', async () => {
      await service.reviewPR({
        prId: 'mr-filter',
        repoId: 'repo-456',
        diff: sampleDiff,
      });

      await service.reviewPR({
        prId: 'mr-other',
        repoId: 'repo-456',
        diff: sampleDiff,
      });

      const filtered = service.getReviewHistory({ prId: 'mr-filter' });

      expect(filtered.results.every((r) => r.prId === 'mr-filter')).toBe(true);
    });

    it('应该支持按仓库 ID 过滤', async () => {
      await service.reviewPR({
        prId: 'mr-1',
        repoId: 'repo-a',
        diff: sampleDiff,
      });

      const filtered = service.getReviewHistory({ repoId: 'repo-a' });

      expect(filtered.results.every((r) => r.repoId === 'repo-a')).toBe(true);
    });

    it('应该支持分页', async () => {
      for (let i = 0; i < 5; i++) {
        await service.reviewPR({
          prId: `mr-page-${i}`,
          repoId: 'repo-456',
          diff: sampleDiff,
        });
      }

      const page1 = service.getReviewHistory({ page: 1, perPage: 2 });
      expect(page1.results.length).toBeLessThanOrEqual(2);
      expect(page1.page).toBe(1);
      expect(page1.perPage).toBe(2);
    });
  });

  describe('getReviewDetail', () => {
    it('应该返回审查详情', async () => {
      const request: ReviewRequest = {
        prId: 'mr-detail',
        repoId: 'repo-456',
        diff: sampleDiff,
      };

      const response = await service.reviewPR(request);
      const reviewId = response.result.id;

      const detail = service.getReviewDetail(reviewId);

      expect(detail).toBeDefined();
      expect(detail?.id).toBe(reviewId);
      expect(detail?.prId).toBe('mr-detail');
    });

    it('应该返回 undefined 当 ID 不存在', () => {
      const detail = service.getReviewDetail('nonexistent-id');
      expect(detail).toBeUndefined();
    });
  });

  describe('规则管理', () => {
    it('应该获取所有规则', async () => {
      const rules = await service.getRules();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('应该获取启用的规则', async () => {
      const rules = await service.getEnabledRules();
      expect(rules.every((r) => r.enabled)).toBe(true);
    });

    it('应该获取单个规则', async () => {
      const rule = await service.getRule('sec-001');
      expect(rule).toBeDefined();
      expect(rule?.id).toBe('sec-001');
    });

    it('应该创建规则', async () => {
      const rule = await service.createRule({
        name: '测试规则',
        category: RuleCategory.SECURITY,
        severity: Severity.WARNING,
        pattern: 'testPattern',
        description: '测试规则描述',
        suggestion: '测试建议',
      });

      expect(rule.id).toBeDefined();
      expect(rule.name).toBe('测试规则');
      expect(rule.enabled).toBe(true);

      const retrieved = await service.getRule(rule.id);
      expect(retrieved).toBeDefined();
    });

    it('应该更新规则', async () => {
      const updated = await service.updateRule('sec-001', {
        name: '更新后的名称',
        enabled: false,
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('更新后的名称');
      expect(updated?.enabled).toBe(false);
    });

    it('应该删除规则', async () => {
      const rule = await service.createRule({
        name: '可删除规则',
        category: RuleCategory.STYLE,
        severity: Severity.INFO,
        pattern: 'deletable',
        description: '测试',
      });

      const deleted = await service.deleteRule(rule.id);
      expect(deleted).toBe(true);

      const retrieved = await service.getRule(rule.id);
      expect(retrieved).toBeUndefined();
    });

    it('应该切换规则状态', async () => {
      const rule = await service.toggleRule('sec-001', false);
      expect(rule?.enabled).toBe(false);

      const rule2 = await service.toggleRule('sec-001', true);
      expect(rule2?.enabled).toBe(true);
    });
  });

  describe('配置管理', () => {
    it('应该获取默认配置', () => {
      const config = service.getConfig();

      expect(config.maxCommentsPerFile).toBeDefined();
      expect(config.autoApproveThreshold).toBeDefined();
      expect(config.enabledCategories).toBeDefined();
    });

    it('应该更新配置', () => {
      const updated = service.updateConfig({
        autoApproveThreshold: 95,
        maxCommentsPerFile: 10,
      });

      expect(updated.autoApproveThreshold).toBe(95);
      expect(updated.maxCommentsPerFile).toBe(10);
    });
  });

  describe('自定义规则', () => {
    it('应该在构造时加载自定义规则', async () => {
      const customService = new AIReviewService({
        customRules: [
          {
            id: 'custom-init-001',
            name: '自定义初始化规则',
            category: RuleCategory.SECURITY,
            severity: Severity.CRITICAL,
            pattern: 'customPattern',
            description: '自定义规则',
            enabled: true,
            metadata: { createdAt: new Date(), updatedAt: new Date() },
          },
        ],
      });

      const rule = await customService.getRule('custom-init-001');
      expect(rule).toBeDefined();
      expect(rule?.name).toBe('自定义初始化规则');
    });
  });

  describe('事件订阅', () => {
    it('应该在没有事件总线时正常工作', () => {
      // 不应该抛出错误
      const svc = new AIReviewService();
      expect(svc).toBeDefined();
    });

    it('应该在使用 mock 事件总线时订阅', () => {
      const mockEventBus = {
        subscribe: jest.fn().mockResolvedValue(async () => {}),
      };

      const svc = new AIReviewService({ eventBus: mockEventBus });
      expect(svc).toBeDefined();
    });
  });
});
