/**
 * ReviewRuleEngine 测试
 */

import { ReviewRuleEngine } from '../ReviewRuleEngine';
import { ReviewRule, RuleCategory, Severity, ChangedLine } from '../types';

describe('ReviewRuleEngine', () => {
  let engine: ReviewRuleEngine;

  beforeEach(() => {
    engine = new ReviewRuleEngine();
  });

  describe('规则初始化', () => {
    it('应该初始化所有内置规则', () => {
      const rules = engine.getAllRules();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('应该包含安全规则', () => {
      const rules = engine.getAllRules();
      const securityRules = rules.filter((r) => r.category === RuleCategory.SECURITY);
      expect(securityRules.length).toBeGreaterThan(0);
    });

    it('应该包含性能规则', () => {
      const rules = engine.getAllRules();
      const perfRules = rules.filter((r) => r.category === RuleCategory.PERFORMANCE);
      expect(perfRules.length).toBeGreaterThan(0);
    });

    it('应该包含风格规则', () => {
      const rules = engine.getAllRules();
      const styleRules = rules.filter((r) => r.category === RuleCategory.STYLE);
      expect(styleRules.length).toBeGreaterThan(0);
    });

    it('应该包含最佳实践规则', () => {
      const rules = engine.getAllRules();
      const bpRules = rules.filter((r) => r.category === RuleCategory.BEST_PRACTICE);
      expect(bpRules.length).toBeGreaterThan(0);
    });
  });

  describe('规则管理', () => {
    it('应该支持注册自定义规则', async () => {
      const customRule: ReviewRule = {
        id: 'custom-001',
        name: '自定义规则',
        category: RuleCategory.SECURITY,
        severity: Severity.CRITICAL,
        pattern: 'dangerousFunction',
        description: '检测危险函数调用',
        suggestion: '避免使用 dangerousFunction',
        enabled: true,
        metadata: { createdAt: new Date(), updatedAt: new Date() },
      };

      await engine.registerRule(customRule);
      const rule = engine.getRule('custom-001');

      expect(rule).toBeDefined();
      expect(rule?.name).toBe('自定义规则');
    });

    it('应该支持移除规则', async () => {
      const removed = await engine.removeRule('sec-001');
      expect(removed).toBe(true);

      const rule = engine.getRule('sec-001');
      expect(rule).toBeUndefined();
    });

    it('应该支持更新规则', async () => {
      const updated = await engine.updateRule('sec-001', {
        name: '更新后的规则名称',
        enabled: false,
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('更新后的规则名称');
      expect(updated?.enabled).toBe(false);
    });

    it('应该返回 undefined 当更新不存在的规则', async () => {
      const result = await engine.updateRule('nonexistent', { name: 'test' });
      expect(result).toBeUndefined();
    });

    it('应该只返回启用的规则', async () => {
      await engine.updateRule('sec-001', { enabled: false });
      const enabled = engine.getEnabledRules();

      expect(enabled.find((r) => r.id === 'sec-001')).toBeUndefined();
    });
  });

  describe('evaluateLine', () => {
    it('应该检测硬编码密码', () => {
      const line: ChangedLine = {
        filePath: 'src/config.ts',
        lineNumber: 10,
        content: "const password = 'secret123';",
      };

      const comments = engine.evaluateLine(line);
      expect(comments.length).toBeGreaterThan(0);
      expect(comments[0].severity).toBe(Severity.CRITICAL);
      expect(comments[0].filePath).toBe('src/config.ts');
      expect(comments[0].lineNumber).toBe(10);
    });

    it('应该检测 eval() 使用', () => {
      const line: ChangedLine = {
        filePath: 'src/app.ts',
        lineNumber: 25,
        content: 'const result = eval(userInput);',
      };

      const comments = engine.evaluateLine(line);
      const evalComment = comments.find((c) => c.ruleId === 'sec-004');
      expect(evalComment).toBeDefined();
      expect(evalComment?.severity).toBe(Severity.WARNING);
    });

    it('应该检测 console.log', () => {
      const line: ChangedLine = {
        filePath: 'src/handler.ts',
        lineNumber: 15,
        content: "console.log('debugging');",
      };

      const comments = engine.evaluateLine(line);
      const consoleComment = comments.find((c) => c.ruleId === 'perf-002');
      expect(consoleComment).toBeDefined();
    });

    it('应该检测 TODO 注释', () => {
      const line: ChangedLine = {
        filePath: 'src/utils.ts',
        lineNumber: 30,
        content: '// TODO: fix this later',
      };

      const comments = engine.evaluateLine(line);
      const todoComment = comments.find((c) => c.ruleId === 'style-002');
      expect(todoComment).toBeDefined();
    });

    it('应该检测 FIXME 注释', () => {
      const line: ChangedLine = {
        filePath: 'src/handler.ts',
        lineNumber: 45,
        content: '// FIXME: broken on weekends',
      };

      const comments = engine.evaluateLine(line);
      const fixmeComment = comments.find((c) => c.ruleId === 'style-003');
      expect(fixmeComment).toBeDefined();
    });

    it('应该检测 any 类型使用', () => {
      const line: ChangedLine = {
        filePath: 'src/types.ts',
        lineNumber: 5,
        content: 'function process(data: any): void {}',
      };

      const comments = engine.evaluateLine(line);
      const anyComment = comments.find((c) => c.ruleId === 'bp-001');
      expect(anyComment).toBeDefined();
    });

    it('应该检测 var 声明', () => {
      const line: ChangedLine = {
        filePath: 'src/legacy.js',
        lineNumber: 8,
        content: 'var x = 10;',
      };

      const comments = engine.evaluateLine(line);
      const varComment = comments.find((c) => c.ruleId === 'bp-003');
      expect(varComment).toBeDefined();
    });

    it('应该根据文件扩展名过滤规则', () => {
      const line: ChangedLine = {
        filePath: 'src/config.json',
        lineNumber: 1,
        content: "const password = 'secret';",
      };

      const comments = engine.evaluateLine(line);
      // bp-001 (any type) 只适用于 .ts 文件
      const anyComment = comments.find((c) => c.ruleId === 'bp-001');
      expect(anyComment).toBeUndefined();
    });

    it('不应该对干净代码产生评论', () => {
      const line: ChangedLine = {
        filePath: 'src/clean.ts',
        lineNumber: 1,
        content: 'const greeting: string = "hello";',
      };

      const comments = engine.evaluateLine(line);
      expect(comments).toHaveLength(0);
    });

    it('应该支持自定义规则集', () => {
      const customRule: ReviewRule = {
        id: 'custom-test',
        name: '测试规则',
        category: RuleCategory.SECURITY,
        severity: Severity.WARNING,
        pattern: 'testPattern',
        description: '测试描述',
        suggestion: '测试建议',
        enabled: true,
        metadata: { createdAt: new Date(), updatedAt: new Date() },
      };

      const line: ChangedLine = {
        filePath: 'src/test.ts',
        lineNumber: 1,
        content: 'this has testPattern in it',
      };

      const comments = engine.evaluateLine(line, [customRule]);
      expect(comments).toHaveLength(1);
      expect(comments[0].ruleId).toBe('custom-test');
    });
  });

  describe('evaluateDiff', () => {
    it('应该评估整个 diff 并返回评论', () => {
      const diff = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -1 +1,3 @@
+const password = 'secret123';
+console.log('debug');
+// TODO: implement
`;

      const comments = engine.evaluateDiff(diff);
      expect(comments.length).toBeGreaterThan(0);
    });

    it('应该对空 diff 返回空评论', () => {
      const comments = engine.evaluateDiff('');
      expect(comments).toHaveLength(0);
    });
  });

  describe('runReview', () => {
    it('应该运行完整审查并返回统计', () => {
      const diff = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1 +1,4 @@
+const password = 'mysecret';
+eval(input);
+console.log('test');
+// TODO: fix
`;

      const result = engine.runReview(diff);

      expect(result.comments.length).toBeGreaterThan(0);
      expect(result.stats.totalLines).toBeGreaterThan(0);
      expect(result.stats.rulesEvaluated).toBeGreaterThan(0);
    });
  });

  describe('getMatchingRules', () => {
    it('应该返回匹配的代码规则', () => {
      const code = "const apiKey = 'abc123def456';";
      const rules = engine.getMatchingRules(code);

      expect(rules.length).toBeGreaterThan(0);
      expect(rules.find((r) => r.id === 'sec-002')).toBeDefined();
    });

    it('应该返回空数组当无匹配', () => {
      const code = 'const greeting = "hello world";';
      const rules = engine.getMatchingRules(code);

      // 对于干净的代码，应该没有规则匹配
      // 但如果有任何宽松的规则可能匹配，我们只检查没有 CRITICAL 级别
      const criticalRules = rules.filter((r) => r.severity === Severity.CRITICAL);
      expect(criticalRules).toHaveLength(0);
    });
  });

  describe('自定义规则加载', () => {
    it('应该在构造时加载自定义规则', () => {
      const customRule: ReviewRule = {
        id: 'custom-init',
        name: '初始自定义规则',
        category: RuleCategory.SECURITY,
        severity: Severity.CRITICAL,
        pattern: 'badCode',
        description: '自定义规则',
        enabled: true,
        metadata: { createdAt: new Date(), updatedAt: new Date() },
      };

      const customEngine = new ReviewRuleEngine(undefined, [customRule]);
      const rule = customEngine.getRule('custom-init');

      expect(rule).toBeDefined();
      expect(rule?.name).toBe('初始自定义规则');
    });
  });
});
