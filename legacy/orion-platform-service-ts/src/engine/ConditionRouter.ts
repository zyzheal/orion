/**
 * ConditionRouter — Stage condition evaluation with execution context
 *
 * Extends ExpressionEvaluator to support stage-level conditions
 * based on upstream stage results (NeatLogic Condition feature).
 *
 * Supported condition syntax (dot-paths are aliased to bypass security):
 * - stages.<name>.status == 'success' | 'failed' | 'skipped'
 * - stages.<name>.result.<key> <op> <value>
 * - tasks.<name>.outputs.<key> <op> <value>
 * - Logical operators: &&, ||, !
 * - Comparison: ==, !=, >, <, >=, <=
 *
 * @example
 * "stages.build.status == 'success' && stages.test.result.passRate >= 0.9"
 */

import { OrionError, ErrorCode } from '../errors';
import { ExpressionEvaluator, ExpressionContext } from './ExpressionEvaluator';
import { VariableContext } from './VariableContext';
import { Stage, StageStatus } from '../models/Stage';
import { PipelineExecution } from './PipelineEngine';
import { createLogger } from '../utils/logger';

const logger = createLogger('ConditionRouter');

export class ConditionRouter {
  constructor(private variableCtx: VariableContext) {}

  /**
   * Evaluate a stage condition against the current execution state.
   *
   * @param condition - The condition expression string
   * @param execution - Current pipeline execution state
   * @returns true if condition is met (stage should execute), false to skip
   */
  evaluate(condition: string | undefined, execution: PipelineExecution): boolean {
    if (!condition) return true;

    try {
      const { context, aliasedCondition } = this.buildExecutionContext(execution, condition);
      const evaluator = new ExpressionEvaluator();
      return evaluator.evaluate(aliasedCondition, context);
    } catch (error) {
      // On evaluation error, default to true (don't skip stage)
      // This is safer than silently skipping important stages
      logger.warn(
        { condition, error: error instanceof Error ? error.message : String(error) },
        'Condition evaluation failed, defaulting to true'
      );
      return true;
    }
  }

  /**
   * Build the expression evaluation context and alias dot-path variables.
   *
   * Since ExpressionEvaluator blocks dot notation in expressions for security,
   * we replace dot-path variables (stages.X.Y, tasks.X.Y) with flat aliases
   * like __stage_name_field, and provide the actual values in the context.
   */
  private buildExecutionContext(
    execution: PipelineExecution,
    condition: string
  ): { context: ExpressionContext; aliasedCondition: string } {
    const context: Record<string, unknown> = {};
    let aliasedCondition = condition;

    // Collect stage data and build aliases
    // Handle both Map (real PipelineExecution) and plain object (test helpers)
    const stageEntries: Array<[string, Stage]> = execution.stages instanceof Map
      ? Array.from(execution.stages.entries())
      : Object.entries(execution.stages as Record<string, Stage>);

    for (const [, stage] of stageEntries) {
      const safeStageName = this.sanitizeName(stage.name);

      // Alias stages.<name>.status
      const statusKey = `__stage_${safeStageName}_status`;
      context[statusKey] = stage.status;
      aliasedCondition = this.replaceDotPath(
        aliasedCondition,
        `stages.${stage.name}.status`,
        statusKey
      );

      // Alias stages.<name>.result.<key>
      if (stage.result) {
        for (const [key, value] of Object.entries(stage.result)) {
          const safeKey = this.sanitizeName(key);
          const resultKey = `__stage_${safeStageName}_result_${safeKey}`;
          context[resultKey] = value;
          aliasedCondition = this.replaceDotPath(
            aliasedCondition,
            `stages.${stage.name}.result.${key}`,
            resultKey
          );
        }
      }
    }

    // Collect task outputs and build aliases
    const taskOutputsMap = this.getTaskOutputsMap();
    for (const [taskName, outputs] of Object.entries(taskOutputsMap)) {
      const safeTaskName = this.sanitizeName(taskName);
      for (const [key, value] of Object.entries(outputs)) {
        const safeKey = this.sanitizeName(key);
        const outputKey = `__task_${safeTaskName}_output_${safeKey}`;
        context[outputKey] = value;
        aliasedCondition = this.replaceDotPath(
          aliasedCondition,
          `tasks.${taskName}.outputs.${key}`,
          outputKey
        );
      }
    }

    return { context: context as ExpressionContext, aliasedCondition };
  }

  /**
   * Get all task outputs from VariableContext as a flat map.
   * Uses toExpressionContext() which exposes the internal taskOutputs structure.
   */
  private getTaskOutputsMap(): Record<string, Record<string, string>> {
    const exprCtx = this.variableCtx.toExpressionContext();
    return (exprCtx as any).tasks || {};
  }

  /**
   * Replace a dot-path pattern in the condition with a flat alias key.
   * Uses escaped regex to handle special characters in names.
   */
  private replaceDotPath(condition: string, dotPath: string, alias: string): string {
    const escaped = dotPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    return condition.replace(regex, alias);
  }

  /**
   * Sanitize a name for use in alias keys (replace non-alphanumeric with underscore).
   */
  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  }
}
