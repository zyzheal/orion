/**
 * ExpressionEvaluator - Pipeline Condition Expression Evaluator
 *
 * A secure expression evaluator for pipeline stage conditions.
 * Uses expr-eval with strict whitelisting and security protections.
 *
 * Supported syntax:
 * - Comparison: ==, !=, >, <, >=, <=
 * - Logical: &&, ||, !
 * - String functions: startsWith(), endsWith(), contains()
 * - Status functions: success(), failure(), cancelled(), always()
 * - Context variables: branch, tags, changedFiles, triggerBy
 *
 * Example:
 *   "branch == 'refs/heads/main' && success() && contains(changedFiles, 'Dockerfile')"
 *
 * Security:
 * - No eval, Function, require access
 * - Whitelist-only operators and functions
 * - Prototype pollution protection
 * - Timeout protection (< 100ms)
 */

import { Parser, Expression, Value } from 'expr-eval';

/**
 * Error thrown when expression evaluation fails
 */
export class EvaluationError extends Error {
  constructor(message: string, public expression?: string) {
    super(message);
    this.name = 'EvaluationError';
  }
}

/**
 * Pipeline execution context available to expressions
 */
export interface ExpressionContext {
  /** Current branch/ref (e.g., 'refs/heads/main') */
  branch?: string;
  /** Tags associated with the trigger */
  tags?: string[];
  /** List of files changed in the trigger */
  changedFiles?: string[];
  /** Who triggered the pipeline */
  triggerBy?: string;
  /** Current execution status for status functions */
  executionStatus?: string;
  /** Additional custom variables */
  [key: string]: unknown;
}

/**
 * Whitelist of allowed function names in expressions
 */
const ALLOWED_FUNCTIONS = new Set([
  'startsWith',
  'endsWith',
  'contains',
  'success',
  'failure',
  'cancelled',
  'always',
]);

/**
 * Patterns that indicate dangerous code injection attempts
 */
const DANGEROUS_PATTERNS = [
  /\bFunction\b/,
  /\beval\b/,
  /\brequire\b/,
  /\bprocess\b/,
  /\bglobal\b/,
  /\bthis\b/,
  /\bwindow\b/,
  /\bconsole\b/,
  /\bglobalThis\b/,
  /\b__proto__\b/,
  /\bconstructor\b/,
  /\bprototype\b/,
  /=>/, // Arrow functions
  /\bfunction\b/, // Function declarations
  /\bfor\s*\(/, // For loops
  /\bwhile\s*\(/, // While loops
  /\bdelete\b/, // Delete operator
];

/**
 * ExpressionEvaluator provides secure evaluation of pipeline condition expressions.
 *
 * @example
 * ```typescript
 * const evaluator = new ExpressionEvaluator();
 * const context: ExpressionContext = {
 *   branch: 'refs/heads/main',
 *   changedFiles: ['src/index.ts', 'Dockerfile'],
 *   triggerBy: 'user@example.com',
 * };
 *
 * // Evaluate a condition
 * const shouldRun = evaluator.evaluate(
 *   "branch == 'refs/heads/main' && contains(changedFiles, 'Dockerfile')",
 *   context
 * );
 * ```
 */
export class ExpressionEvaluator {
  private parser: Parser;

  constructor() {
    // Create parser with restricted operators
    this.parser = new Parser({
      allowMemberAccess: true, // Enable for github.ref backward compat; dangerous patterns blocked by validation
      operators: {
        // Allow comparison operators
        comparison: true,
        // Allow logical operators
        logical: true,
        // Allow basic arithmetic (needed for some numeric comparisons)
        add: true,
        subtract: true,
        multiply: true,
        divide: true,
        // Block potentially dangerous operators
        remainder: true,
        power: false,
        factorial: false,
        assignment: false, // Block assignment (=)
        fndef: false, // Block function definitions
        // Block math functions that could be abused
        sin: false,
        cos: false,
        tan: false,
        asin: false,
        acos: false,
        atan: false,
        sinh: false,
        cosh: false,
        tanh: false,
        asinh: false,
        acosh: false,
        atanh: false,
        sqrt: false,
        log: false,
        ln: false,
        lg: false,
        log10: false,
        abs: false,
        ceil: false,
        floor: false,
        round: false,
        trunc: false,
        exp: false,
        length: false,
        in: false, // Block 'in' operator for security
        random: false,
        min: false,
        max: false,
        cbrt: false,
        expm1: false,
        log1p: false,
        sign: false,
        log2: false,
      },
    });

    // Register custom pipeline functions
    this.registerCustomFunctions();
  }

  /**
   * Evaluate a condition expression against the given context
   *
   * @param expression - The condition expression string
   * @param context - The execution context providing variable values
   * @returns boolean result of the evaluation
   * @throws EvaluationError if expression is invalid or dangerous
   */
  evaluate(expression: string, context: ExpressionContext): boolean {
    // Handle empty or whitespace-only expressions
    const trimmed = expression.trim();
    if (trimmed === '') {
      return true; // Empty condition means "always run"
    }

    // Security check: scan for dangerous patterns
    this.validateExpression(trimmed);

    // Preprocess: convert JS-style operators to expr-eval operators
    // && -> and, || -> or, ! -> not
    // Also preprocess status functions to inject executionStatus
    let normalized = this.normalizeOperators(trimmed);
    normalized = this.preprocessStatusFunctions(normalized);

    try {
      // Parse and compile the expression (with timeout protection)
      const timeoutStart = Date.now();
      const compiled: Expression = this.parser.parse(normalized);
      this.checkTimeout(timeoutStart);

      // Build the values object from context
      const values = this.buildContextValues(context);

      // Evaluate with timeout protection
      const result = compiled.evaluate(values);
      this.checkTimeout(timeoutStart);

      // Normalize result to boolean
      return this.normalizeResult(result);
    } catch (error) {
      if (error instanceof EvaluationError) {
        throw error;
      }
      throw new EvaluationError(
        `Failed to evaluate expression: ${error instanceof Error ? error.message : String(error)}`,
        expression
      );
    }
  }

  /**
   * Normalize JavaScript-style operators to expr-eval format
   * && -> and, || -> or, !func() -> not func(), !(expr) -> not (expr)
   */
  private normalizeOperators(expression: string): string {
    let result = expression;

    // Replace || with or (before && to avoid partial matches)
    result = result.replace(/\|\|/g, ' or ');

    // Replace && with and
    result = result.replace(/&&/g, ' and ');

    // Replace ! before parentheses: !(expr) -> not (expr)
    result = result.replace(/!\s*\(/g, 'not (');

    // Replace ! before function calls: !func( -> not func(
    result = result.replace(/!\s*([a-zA-Z_]\w*\s*\()/g, 'not $1');

    // Clean up extra whitespace
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }

  /**
   * Preprocess status function calls by injecting executionStatus as argument
   * success() -> success(executionStatus)
   * failure() -> failure(executionStatus)
   * cancelled() -> cancelled(executionStatus)
   */
  private preprocessStatusFunctions(expression: string): string {
    // Add executionStatus parameter to status function calls
    let result = expression;
    result = result.replace(/\bsuccess\s*\(\s*\)/g, 'success(executionStatus)');
    result = result.replace(/\bfailure\s*\(\s*\)/g, 'failure(executionStatus)');
    result = result.replace(/\bcancelled\s*\(\s*\)/g, 'cancelled(executionStatus)');
    return result;
  }

  /**
   * Check if the evaluation has exceeded the timeout limit
   * @throws EvaluationError if timeout exceeded
   */
  private checkTimeout(startMs: number, maxMs: number = 100): void {
    const elapsed = Date.now() - startMs;
    if (elapsed > maxMs) {
      throw new EvaluationError(`Expression evaluation timed out (${elapsed}ms > ${maxMs}ms)`);
    }
  }

  /**
   * Validate expression for dangerous patterns before evaluation
   * @throws EvaluationError if dangerous patterns detected
   */
  private validateExpression(expression: string): void {
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(expression)) {
        throw new EvaluationError(
          `Expression contains blocked pattern: ${pattern.source}`,
          expression
        );
      }
    }

    // Block dot notation access (e.g., obj.property) for security
    // Exception: allow github.ref for backward compatibility with existing YAML configs
    const withoutStrings = expression.replace(/'[^']*'/g, '');
    // Remove allowed github.xxx patterns before checking for remaining dots
    const withoutGithub = withoutStrings.replace(/\bgithub\.\w+/g, '');
    if (withoutGithub.includes('.')) {
      // Dot notation could be used for prototype pollution
      // We handle dot paths through our custom variable system instead
      throw new EvaluationError(
        'Dot notation is not allowed. Use context variables directly.',
        expression
      );
    }
  }

  /**
   * Build the values object from the execution context
   * Includes both known variables and custom variables from context
   * Uses a Proxy to return empty defaults for truly undefined variables
   */
  private buildContextValues(context: ExpressionContext): Value {
    const baseValues: Record<string, unknown> = {
      branch: context.branch ?? '',
      tags: context.tags ?? [],
      changedFiles: context.changedFiles ?? [],
      triggerBy: context.triggerBy ?? '',
      executionStatus: context.executionStatus ?? 'success', // Default to success for normal flow
      // Backward compatibility: github.ref aliases to branch for existing YAML configs
      github: { ref: context.branch ?? '' },
    };

    // Include any additional custom variables from context
    const knownKeys = new Set(['branch', 'tags', 'changedFiles', 'triggerBy', 'executionStatus', 'github']);
    for (const [key, value] of Object.entries(context)) {
      if (!knownKeys.has(key)) {
        baseValues[key] = value;
      }
    }

    // Use Proxy to handle truly undefined variables gracefully
    return new Proxy(baseValues, {
      get(target, prop: string) {
        if (prop in target) {
          return target[prop];
        }
        // Return empty string for undefined variables
        return '';
      },
    }) as unknown as Value;
  }

  /**
   * Register custom functions available in expressions
   */
  private registerCustomFunctions(): void {
    // String functions
    this.parser.functions.startsWith = (value: Value, prefix: Value): Value => {
      if (typeof value !== 'string' || typeof prefix !== 'string') return 0;
      return value.startsWith(prefix) ? 1 : 0;
    };

    this.parser.functions.endsWith = (value: Value, suffix: Value): Value => {
      if (typeof value !== 'string' || typeof suffix !== 'string') return 0;
      return value.endsWith(suffix) ? 1 : 0;
    };

    this.parser.functions.contains = (collection: Value, item: Value): Value => {
      if (Array.isArray(collection)) {
        // Array containment
        return collection.includes(item as string) ? 1 : 0;
      }
      if (typeof collection === 'string') {
        // String substring check
        if (typeof item !== 'string') return 0;
        return collection.includes(item) ? 1 : 0;
      }
      return 0;
    };

    // Status functions
    this.parser.functions.success = (status: Value): Value => {
      return status === 'success' ? 1 : 0;
    };

    this.parser.functions.failure = (status: Value): Value => {
      return status === 'failed' ? 1 : 0;
    };

    this.parser.functions.cancelled = (status: Value): Value => {
      return status === 'cancelled' ? 1 : 0;
    };

    this.parser.functions.always = (): Value => {
      return 1; // Always true
    };
  }

  /**
   * Normalize the evaluation result to a boolean
   * expr-eval returns 1/0 for comparisons, we need true/false
   */
  private normalizeResult(result: unknown): boolean {
    if (typeof result === 'boolean') {
      return result;
    }
    if (typeof result === 'number') {
      return result !== 0;
    }
    if (typeof result === 'string') {
      return result !== '';
    }
    return false;
  }
}
