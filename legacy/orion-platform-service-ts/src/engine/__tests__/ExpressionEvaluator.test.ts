/**
 * ExpressionEvaluator Tests
 *
 * Tests for the pipeline condition expression evaluator.
 * Covers all operators, functions, edge cases, and security requirements.
 */

import { ExpressionEvaluator, EvaluationError } from '../ExpressionEvaluator';

describe('ExpressionEvaluator', () => {
  let evaluator: ExpressionEvaluator;

  const createContext = (overrides: Record<string, unknown> = {}) => ({
    branch: 'refs/heads/main',
    tags: ['v1.0.0'],
    changedFiles: ['src/index.ts', 'Dockerfile', 'package.json'],
    triggerBy: 'user@example.com',
    executionStatus: 'success',
    ...overrides,
  });

  beforeEach(() => {
    evaluator = new ExpressionEvaluator();
  });

  describe('Comparison Operators', () => {
    test('== (equal) should return true for matching values', () => {
      const context = createContext();
      expect(evaluator.evaluate("branch == 'refs/heads/main'", context)).toBe(true);
    });

    test('== (equal) should return false for non-matching values', () => {
      const context = createContext();
      expect(evaluator.evaluate("branch == 'refs/heads/develop'", context)).toBe(false);
    });

    test('!= (not equal) should return true for different values', () => {
      const context = createContext();
      expect(evaluator.evaluate("branch != 'refs/heads/develop'", context)).toBe(true);
    });

    test('!= (not equal) should return false for same values', () => {
      const context = createContext();
      expect(evaluator.evaluate("branch != 'refs/heads/main'", context)).toBe(false);
    });

    test('> (greater than) should work with numbers', () => {
      const context = createContext({ version: 2 });
      expect(evaluator.evaluate('version > 1', context)).toBe(true);
      expect(evaluator.evaluate('version > 3', context)).toBe(false);
    });

    test('< (less than) should work with numbers', () => {
      const context = createContext({ version: 2 });
      expect(evaluator.evaluate('version < 3', context)).toBe(true);
      expect(evaluator.evaluate('version < 1', context)).toBe(false);
    });

    test('>= (greater than or equal) should work with numbers', () => {
      const context = createContext({ version: 2 });
      expect(evaluator.evaluate('version >= 2', context)).toBe(true);
      expect(evaluator.evaluate('version >= 3', context)).toBe(false);
    });

    test('<= (less than or equal) should work with numbers', () => {
      const context = createContext({ version: 2 });
      expect(evaluator.evaluate('version <= 2', context)).toBe(true);
      expect(evaluator.evaluate('version <= 1', context)).toBe(false);
    });
  });

  describe('Logical Operators', () => {
    test('&& (AND) should return true when both conditions are true', () => {
      const context = createContext();
      expect(evaluator.evaluate("branch == 'refs/heads/main' && triggerBy == 'user@example.com'", context)).toBe(true);
    });

    test('&& (AND) should return false when one condition is false', () => {
      const context = createContext();
      expect(evaluator.evaluate("branch == 'refs/heads/develop' && triggerBy == 'user@example.com'", context)).toBe(false);
    });

    test('|| (OR) should return true when at least one condition is true', () => {
      const context = createContext();
      expect(evaluator.evaluate("branch == 'refs/heads/main' || branch == 'refs/heads/develop'", context)).toBe(true);
    });

    test('|| (OR) should return false when both conditions are false', () => {
      const context = createContext();
      expect(evaluator.evaluate("branch == 'refs/heads/develop' || triggerBy == 'other@example.com'", context)).toBe(false);
    });

    test('! (NOT) should negate a condition', () => {
      const context = createContext();
      expect(evaluator.evaluate("!(branch == 'refs/heads/develop')", context)).toBe(true);
      expect(evaluator.evaluate("!(branch == 'refs/heads/main')", context)).toBe(false);
    });

    test('complex expression with mixed && and ||', () => {
      const context = createContext();
      // (branch is main OR branch is develop) AND triggerBy matches
      expect(evaluator.evaluate("(branch == 'refs/heads/main' || branch == 'refs/heads/develop') && triggerBy == 'user@example.com'", context)).toBe(true);
    });
  });

  describe('String Functions', () => {
    test('startsWith() should return true when string starts with prefix', () => {
      const context = createContext();
      expect(evaluator.evaluate("startsWith(branch, 'refs/heads/')", context)).toBe(true);
      expect(evaluator.evaluate("startsWith(branch, 'refs/tags/')", context)).toBe(false);
    });

    test('endsWith() should return true when string ends with suffix', () => {
      const context = createContext();
      expect(evaluator.evaluate("endsWith(branch, 'main')", context)).toBe(true);
      expect(evaluator.evaluate("endsWith(branch, 'develop')", context)).toBe(false);
    });

    test('contains() should return true when string contains substring', () => {
      const context = createContext();
      expect(evaluator.evaluate("contains(branch, 'heads')", context)).toBe(true);
      expect(evaluator.evaluate("contains(branch, 'release')", context)).toBe(false);
    });

    test('contains() with array should check array membership', () => {
      const context = createContext();
      expect(evaluator.evaluate("contains(changedFiles, 'Dockerfile')", context)).toBe(true);
      expect(evaluator.evaluate("contains(changedFiles, 'Makefile')", context)).toBe(false);
    });
  });

  describe('Status Functions', () => {
    test('success() should return the current execution status', () => {
      const context = createContext({ executionStatus: 'success' });
      expect(evaluator.evaluate('success()', context)).toBe(true);
    });

    test('failure() should return true when execution failed', () => {
      const context = createContext({ executionStatus: 'failed' });
      expect(evaluator.evaluate('failure()', context)).toBe(true);
    });

    test('cancelled() should return true when execution was cancelled', () => {
      const context = createContext({ executionStatus: 'cancelled' });
      expect(evaluator.evaluate('cancelled()', context)).toBe(true);
    });

    test('always() should always return true', () => {
      const context = createContext();
      expect(evaluator.evaluate('always()', context)).toBe(true);
    });

    test('status functions work with complex expressions', () => {
      const context = createContext({ executionStatus: 'failed' });
      expect(evaluator.evaluate('failure() || cancelled()', context)).toBe(true);
      expect(evaluator.evaluate('success()', context)).toBe(false);
    });
  });

  describe('Context Variables', () => {
    test('branch variable should be accessible from context', () => {
      const context = createContext({ branch: 'refs/heads/feature/new-feature' });
      expect(evaluator.evaluate("startsWith(branch, 'refs/heads/feature/')", context)).toBe(true);
    });

    test('tags variable should be accessible as array', () => {
      const context = createContext({ tags: ['v1.0.0', 'v1.0.1', 'latest'] });
      expect(evaluator.evaluate("contains(tags, 'v1.0.0')", context)).toBe(true);
      expect(evaluator.evaluate("contains(tags, 'v2.0.0')", context)).toBe(false);
    });

    test('triggerBy variable should be accessible from run', () => {
      const context = createContext({ triggerBy: 'ci-bot@example.com' });
      expect(evaluator.evaluate("contains(triggerBy, 'ci-bot')", context)).toBe(true);
    });

    test('changedFiles variable should support array operations', () => {
      const context = createContext({
        changedFiles: ['src/index.ts', 'src/utils.ts', 'Dockerfile'],
      });
      expect(evaluator.evaluate("contains(changedFiles, 'src/index.ts')", context)).toBe(true);
      expect(evaluator.evaluate("contains(changedFiles, 'Dockerfile')", context)).toBe(true);
    });
  });

  describe('Security - Blocked Functions', () => {
    test('should block Function constructor access', () => {
      const context = createContext();
      expect(() => evaluator.evaluate("Function('return 1')()", context)).toThrow(EvaluationError);
    });

    test('should block eval access', () => {
      const context = createContext();
      expect(() => evaluator.evaluate("eval('1 + 1')", context)).toThrow(EvaluationError);
    });

    test('should block require access', () => {
      const context = createContext();
      expect(() => evaluator.evaluate("require('fs')", context)).toThrow(EvaluationError);
    });

    test('should block process access', () => {
      const context = createContext();
      expect(() => evaluator.evaluate("process.exit(1)", context)).toThrow(EvaluationError);
    });

    test('should block prototype access', () => {
      const context = createContext();
      expect(() => evaluator.evaluate("branch.__proto__", context)).toThrow(EvaluationError);
    });

    test('should block constructor access', () => {
      const context = createContext();
      expect(() => evaluator.evaluate("branch.constructor", context)).toThrow(EvaluationError);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty string condition gracefully', () => {
      const context = createContext();
      // Empty condition should be handled without throwing
      const result = evaluator.evaluate('', context);
      expect(typeof result).toBe('boolean');
    });

    test('should handle undefined variables gracefully', () => {
      const context = createContext();
      // undefinedVar is not in context, should handle gracefully
      const result = evaluator.evaluate("undefinedVar == 'test'", context);
      // Should return false or handle it gracefully
      expect(typeof result).toBe('boolean');
    });

    test('should handle null values gracefully', () => {
      const context = createContext({ nullableField: null });
      const result = evaluator.evaluate("nullableField == 'test'", context);
      expect(result).toBe(false);
    });

    test('should handle whitespace in expressions', () => {
      const context = createContext();
      expect(evaluator.evaluate("  branch  ==  'refs/heads/main'  ", context)).toBe(true);
    });

    test('should handle nested parentheses', () => {
      const context = createContext();
      expect(evaluator.evaluate("((branch == 'refs/heads/main'))", context)).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    test('github.ref should alias to branch for existing YAML configs', () => {
      const context = createContext();
      expect(evaluator.evaluate("github.ref == 'refs/heads/main'", context)).toBe(true);
      expect(evaluator.evaluate("github.ref == 'refs/heads/develop'", context)).toBe(false);
    });

    test('github.ref should work with different branch values', () => {
      const context = createContext({ branch: 'refs/heads/feature/test' });
      expect(evaluator.evaluate("github.ref == 'refs/heads/feature/test'", context)).toBe(true);
    });

    test('github.ref should work in complex expressions', () => {
      const context = createContext();
      expect(evaluator.evaluate("github.ref == 'refs/heads/main' && success()", context)).toBe(true);
    });
  });

  describe('Timeout Protection', () => {
    test('should not allow infinite loops or long-running expressions', () => {
      // expr-eval doesn't support loops, but we test that evaluation completes quickly
      const context = createContext();
      const start = Date.now();
      evaluator.evaluate("1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10", context);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(10);
    });
  });

  describe('Real-world Pipeline Scenarios', () => {
    test('deploy-prod condition: main branch AND success AND has Dockerfile', () => {
      const context = createContext();
      const condition = "branch == 'refs/heads/main' && success() && contains(changedFiles, 'Dockerfile')";
      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    test('skip-deploy condition: non-main branch', () => {
      const context = createContext({ branch: 'refs/heads/feature/test' });
      const condition = "branch == 'refs/heads/main'";
      expect(evaluator.evaluate(condition, context)).toBe(false);
    });

    test('run-tests condition: changes in src folder', () => {
      const context = createContext({
        changedFiles: ['src/index.ts', 'src/utils.ts'],
      });
      const condition = "contains(changedFiles, 'src/index.ts') || contains(changedFiles, 'src/utils.ts')";
      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    test('notify condition: failure OR cancelled', () => {
      const context = createContext({ executionStatus: 'failed' });
      const condition = 'failure() || cancelled()';
      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    test('cleanup condition: always() run cleanup', () => {
      const context = createContext();
      const condition = 'always()';
      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    test('tag-trigger condition: tag starts with v', () => {
      const context = createContext({ tags: ['v2.0.0'] });
      const condition = "contains(tags, 'v2.0.0') && startsWith(branch, 'refs/tags/')";
      // This will be false because branch is still 'refs/heads/main'
      expect(evaluator.evaluate(condition, context)).toBe(false);

      const tagContext = createContext({ branch: 'refs/tags/v2.0.0', tags: ['v2.0.0'] });
      expect(evaluator.evaluate(condition, tagContext)).toBe(true);
    });
  });
});
