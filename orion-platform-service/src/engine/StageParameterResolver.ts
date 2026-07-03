import { createLogger } from '../utils/logger';
import { VariableContext } from './VariableContext';
import { Task, TaskStatus } from '../models/Task';

const logger = pino({ name: 'StageParameterResolver' });

/**
 * StageParameterResolver - Stage-to-stage parameter passing
 *
 * Implements NeatLogic-style parameter extraction and aggregation:
 * - extractStageOutputs: extract output variables from completed task results
 * - resolveStageParameters: resolve ${tasks.<name>.outputs.<key>} references
 * - aggregateParameters: merge multiple parameter sources (later overrides earlier)
 *
 * @example
 * ```typescript
 * const resolver = new StageParameterResolver(variableCtx);
 *
 * // Extract outputs from build stage tasks
 * const outputs = resolver.extractStageOutputs(buildTasks, {
 *   version: '${tasks.build.outputs.version}',
 * });
 *
 * // Resolve parameters for deploy stage
 * const params = resolver.resolveStageParameters('deploy', {
 *   image: '${tasks.build.outputs.image}',
 * });
 * ```
 */
export class StageParameterResolver {
  constructor(private variableCtx: VariableContext) {}

  /**
   * Extract stage outputs from completed tasks.
   *
   * If stageDeclaredOutputs is provided, resolve each output reference
   * through VariableContext. Otherwise, collect all successful task results.
   *
   * @param tasks - Tasks from the completed stage
   * @param stageDeclaredOutputs - Optional {key: reference} map from stage.outputs YAML
   * @returns Record of output key -> resolved value
   */
  extractStageOutputs(
    tasks: Task[],
    stageDeclaredOutputs?: Record<string, string>,
  ): Record<string, string> {
    if (stageDeclaredOutputs && Object.keys(stageDeclaredOutputs).length > 0) {
      // Resolve declared outputs through VariableContext
      const resolved: Record<string, string> = {};
      for (const [key, reference] of Object.entries(stageDeclaredOutputs)) {
        resolved[key] = this.variableCtx.resolve(reference);
      }
      logger.debug({ count: Object.keys(resolved).length }, 'extracted stage outputs via declared outputs');
      return resolved;
    }

    // Fallback: collect results from successful tasks only
    const outputs: Record<string, string> = {};
    for (const task of tasks) {
      if (task.status === TaskStatus.SUCCESS && task.result) {
        for (const [key, value] of Object.entries(task.result)) {
          if (typeof value === 'string' || typeof value === 'number') {
            outputs[key] = String(value);
          }
        }
      }
    }
    logger.debug({ count: Object.keys(outputs).length }, 'extracted stage outputs via fallback');
    return outputs;
  }

  /**
   * Resolve a single parameter value, handling default value syntax
   * and preserving unresolvable references.
   *
   * Supports:
   * - ${tasks.<name>.outputs.<key>} -> resolved value or empty string
   * - ${tasks.<name>.outputs.<key> || "default"} -> resolved value or default
   * - Plain strings -> returned as-is
   */
  private resolveParameterValue(value: string): string {
    // Check for default value syntax: ${path || "default"}
    const defaultValueMatch = value.match(/^\$\{([^}]+)\|\|\s*"([^"]+)"\}$/);
    if (defaultValueMatch) {
      const path = defaultValueMatch[1];
      const defaultValue = defaultValueMatch[2];
      const resolved = this.variableCtx.resolve(`\${${path}}`);
      // If resolution returns empty string (unresolved or empty value), use default
      return resolved || defaultValue;
    }

    // Check if the value is a variable reference at all
    if (!value.includes('${')) {
      return value;
    }

    const resolved = this.variableCtx.resolve(value);

    // If resolution returned empty string and the original had a ${} reference,
    // preserve the original string (unresolvable reference)
    if (resolved === '' && /\$\{[^}]+\}/.test(value)) {
      return value;
    }

    return resolved;
  }

  /**
   * Resolve parameter references for a downstream stage.
   *
   * Resolves ${tasks.<taskName>.outputs.<key>} references using VariableContext.
   * Unresolvable references are kept as-is (with original ${} syntax).
   * Supports default value syntax: ${tasks.build.outputs.env || "production"}
   *
   * @param stageName - The downstream stage name (for context)
   * @param params - Parameter map that may contain ${tasks.xxx} references
   * @returns Parameter map with resolved values
   */
  resolveStageParameters(
    stageName: string,
    params: Record<string, unknown>,
  ): Record<string, string> {
    const resolved: Record<string, string> = {};
    const unresolvable: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        const result = this.resolveParameterValue(value);
        if (result !== value && /\$\{[^}]+\}/.test(value)) {
          unresolvable.push(key);
        }
        resolved[key] = result;
      } else {
        resolved[key] = String(value);
      }
    }
    logger.debug(
      { resolvedKeys: Object.keys(resolved), unresolvable },
      'resolved stage parameters',
    );
    return resolved;
  }

  /**
   * Aggregate multiple parameter sources into one.
   *
   * Later sources override earlier ones for duplicate keys.
   * Mirrors NeatLogic's ParamAggregate behavior.
   *
   * @param sources - Parameter maps to merge
   * @returns Merged parameter map
   */
  aggregateParameters(...sources: Record<string, unknown>[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const source of sources) {
      for (const [key, value] of Object.entries(source)) {
        result[key] = value;
      }
    }
    return result;
  }
}
