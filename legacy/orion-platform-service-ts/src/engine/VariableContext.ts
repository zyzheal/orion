/**
 * VariableContext - Pipeline Variable Management
 *
 * Manages pipeline-level variables and per-task output propagation.
 * Supports variable resolution using ${tasks.<taskName>.outputs.<key>} syntax,
 * consistent with Tekton's variable reference pattern.
 *
 * Features:
 * - Set/get task outputs: taskName -> key -> value
 * - Pipeline-level variables
 * - String templating: resolve variable references in strings
 * - Deep object resolution
 * - ExpressionContext adapter for ExpressionEvaluator integration
 *
 * @example
 * ```typescript
 * const ctx = new VariableContext('run-001');
 *
 * // Set task outputs
 * ctx.setTaskOutput('build', 'version', '1.2.3');
 * ctx.setTaskOutput('build', 'image', 'myapp:1.2.3');
 *
 * // Resolve variable references
 * const image = ctx.resolve('deploy ${tasks.build.outputs.image}');
 * // => 'deploy myapp:1.2.3'
 *
 * // Resolve deep objects
 * const config = ctx.resolveObject({ image: '${tasks.build.outputs.image}' });
 * // => { image: 'myapp:1.2.3' }
 * ```
 */

import { ExpressionContext } from './ExpressionEvaluator';

export interface TaskOutputs {
  [key: string]: string;
}

export interface TaskOutputMap {
  [taskName: string]: TaskOutputs;
}

export interface PipelineVariables {
  [key: string]: string;
}

export class VariableContext {
  private runId: string;
  private taskOutputs: TaskOutputMap;
  private variables: PipelineVariables;

  constructor(runId: string) {
    this.runId = runId;
    this.taskOutputs = {};
    this.variables = {};
  }

  /**
   * Set a task output value
   * @param taskName - The name of the task (e.g., 'build', 'test')
   * @param key - The output key (e.g., 'version', 'image')
   * @param value - The output value
   */
  setTaskOutput(taskName: string, key: string, value: string): void {
    if (!this.taskOutputs[taskName]) {
      this.taskOutputs[taskName] = {};
    }
    this.taskOutputs[taskName][key] = value;
  }

  /**
   * Get a task output value
   * @param taskName - The name of the task
   * @param key - The output key
   * @returns The output value, or undefined if not found
   */
  getTaskOutput(taskName: string, key: string): string | undefined {
    return this.taskOutputs[taskName]?.[key];
  }

  /**
   * Get all outputs for a given task
   * @param taskName - The name of the task
   * @returns Object containing all key-value pairs, or empty object if no outputs
   */
  getAllTaskOutputs(taskName: string): TaskOutputs {
    return this.taskOutputs[taskName] || {};
  }

  /**
   * Clear all outputs for a task
   * @param taskName - The name of the task
   */
  clearTaskOutputs(taskName: string): void {
    delete this.taskOutputs[taskName];
  }

  /**
   * Set a pipeline-level variable
   * @param key - Variable name
   * @param value - Variable value
   */
  setVariable(key: string, value: string): void {
    this.variables[key] = value;
  }

  /**
   * Get a pipeline-level variable
   * @param key - Variable name
   * @returns The variable value, or undefined if not found
   */
  getVariable(key: string): string | undefined {
    return this.variables[key];
  }

  /**
   * Get the run ID associated with this context
   */
  getRunId(): string {
    return this.runId;
  }

  /**
   * Resolve variable references in a string template.
   *
   * Supports:
   * - ${tasks.<taskName>.outputs.<key>} - task output references
   * - ${<variableName>} - pipeline-level variable references
   *
   * Unresolved references are replaced with empty string.
   *
   * @param template - The string template containing variable references
   * @returns The resolved string with all references substituted
   */
  resolve(template: string): string {
    if (!template) return '';

    // Regex matches ${...} patterns
    // Group 1: content inside ${...}
    return template.replace(/\$\{([^}]+)\}/g, (_match, path: string) => {
      return this.resolvePath(path);
    });
  }

  /**
   * Recursively resolve variable references in an object (deep clone with substitution).
   *
   * Handles:
   * - String values: direct resolution
   * - Arrays: resolve each element
   * - Nested objects: recursive resolution
   *
   * @param obj - The object to resolve
   * @returns A new object with all variable references resolved
   */
  resolveObject<T>(obj: T): T {
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (typeof obj === 'string') {
      return this.resolve(obj) as unknown as T;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveObject(item)) as unknown as T;
    }
    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        result[key] = this.resolveObject(value);
      }
      return result as T;
    }
    // Primitives (number, boolean, etc.)
    return obj;
  }

  /**
   * Convert to an ExpressionContext compatible object.
   *
   * This allows the ExpressionEvaluator to access task outputs via
   * dot notation through the 'tasks' property, enabling conditions like:
   * - success() && tasks.build.outputs.version != ''
   *
   * Note: ExpressionEvaluator blocks dot notation by default for security.
   * This method provides a safe way to expose task outputs as context values.
   */
  toExpressionContext(): ExpressionContext & {
    tasks: Record<string, { outputs: Record<string, string> }>;
    [key: string]: unknown;
  } {
    const tasksObj: Record<string, { outputs: Record<string, string> }> = {};

    for (const [taskName, outputs] of Object.entries(this.taskOutputs)) {
      tasksObj[taskName] = { outputs: { ...outputs } };
    }

    // Merge pipeline variables into the context
    const context: Record<string, unknown> = { ...this.variables };
    context.tasks = tasksObj;

    return context as ExpressionContext & {
      tasks: Record<string, { outputs: Record<string, string> }>;
      [key: string]: unknown;
    };
  }

  /**
   * Resolve a dot-path to a value.
   *
   * Handles:
   * - tasks.<taskName>.outputs.<key> -> task output value
   * - <variableName> -> pipeline variable
   */
  private resolvePath(path: string): string {
    const parts = path.split('.');

    // Check for tasks.<taskName>.outputs.<key> pattern
    if (parts[0] === 'tasks' && parts.length >= 4 && parts[2] === 'outputs') {
      const taskName = parts[1];
      const key = parts.slice(3).join('.'); // Support keys with dots
      return this.taskOutputs[taskName]?.[key] ?? '';
    }

    // Check for pipeline-level variable
    if (this.variables[path] !== undefined) {
      return this.variables[path];
    }

    // Unresolved - return empty string
    return '';
  }
}
