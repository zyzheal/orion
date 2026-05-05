/**
 * DynamicParamsResolver - Runtime parameter injection and resolution
 *
 * Handles:
 * - Runtime parameter injection (string/number/boolean/array)
 * - Parameter reference resolution (${params.name} substitution)
 * - Dynamic Stage generation (conditional Stage creation based on params)
 * - Environment variable auto-injection (git.sha, git.branch, trigger.type, etc.)
 */

export interface ResolvedParams {
  injectedParams: Record<string, unknown>;
  dynamicStages: string[];
  resolvedYamlDefinition: string;
}

export interface TriggerContext {
  triggerType: string;
  triggerBy?: string;
  branch?: string;
  commitSha?: string;
}

export interface PipelineSpec {
  stages: PipelineStageSpec[];
  [key: string]: any;
}

export interface PipelineStageSpec {
  name: string;
  type: string;
  if?: string;
  [key: string]: any;
}

/**
 * Validates and normalizes runtime parameter values
 */
function validateAndNormalizeParam(
  name: string,
  value: unknown
): { value: unknown; errors: string[] } {
  const errors: string[] = [];

  if (value === null || value === undefined) {
    return { value: null, errors: [`Parameter '${name}' has null/undefined value`] };
  }

  // Allow string, number, boolean, and string array
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return { value, errors: [] };
  }

  if (Array.isArray(value)) {
    // Validate all items are strings
    const nonStrings = value.filter((item) => typeof item !== 'string');
    if (nonStrings.length > 0) {
      errors.push(`Parameter '${name}' array contains non-string values`);
    }
    return { value, errors };
  }

  errors.push(`Parameter '${name}' has unsupported type: ${typeof value}`);
  return { value, errors: [] };
}

export class DynamicParamsResolver {
  /**
   * Resolve runtime parameters for a pipeline run.
   *
   * @param pipelineId - The pipeline being executed
   * @param runtimeParams - User-supplied runtime parameters
   * @param defaultParams - Pipeline's default parameters
   * @param yamlDefinition - The pipeline's YAML definition
   * @param context - Trigger context (branch, commit, etc.)
   * @returns Resolved parameters, dynamic stages, and resolved YAML
   */
  async resolve(
    pipelineId: string,
    runtimeParams: Record<string, unknown> = {},
    defaultParams: Record<string, unknown> = {},
    yamlDefinition: string,
    context: TriggerContext
  ): Promise<ResolvedParams> {
    // Step 1: Merge default params with runtime params (runtime overrides defaults)
    const mergedParams: Record<string, unknown> = { ...defaultParams };
    const validationErrors: string[] = [];

    for (const [key, value] of Object.entries(runtimeParams)) {
      const { value: normalizedValue, errors } = validateAndNormalizeParam(key, value);
      validationErrors.push(...errors);
      mergedParams[key] = normalizedValue;
    }

    if (validationErrors.length > 0) {
      throw new Error(`Parameter validation failed: ${validationErrors.join('; ')}`);
    }

    // Step 2: Inject environment variables
    const envParams = this.injectEnvironmentVariables(context);
    const finalParams: Record<string, unknown> = { ...mergedParams, ...envParams };

    // Step 3: Resolve ${params.*} references in YAML
    const resolvedYaml = this.resolveReferences(yamlDefinition, finalParams);

    // Step 4: Generate dynamic stages
    const dynamicStages = this.resolveDynamicStages(resolvedYaml, finalParams);

    return {
      injectedParams: finalParams,
      dynamicStages,
      resolvedYamlDefinition: resolvedYaml,
    };
  }

  /**
   * Resolve ${params.*} references in a string
   */
  resolveReferences(text: string, params: Record<string, unknown>): string {
    const paramPattern = /\$\{params\.([a-zA-Z0-9_.]+)\}/g;

    return text.replace(paramPattern, (_match: string, paramName: string) => {
      const value = params[paramName];
      if (value === undefined) {
        // Keep unresolved references as-is for non-required params
        return `\${params.${paramName}}`;
      }
      return String(value);
    });
  }

  /**
   * Parse YAML spec and resolve dynamic stages based on parameter conditions
   */
  resolveDynamicStages(yamlDefinition: string, params: Record<string, unknown>): string[] {
    const dynamicStages: string[] = [];

    // Simple YAML parsing to find stages with 'if' conditions
    // In production, this would use a proper YAML parser
    const lines = yamlDefinition.split('\n');
    let currentStage: string | null = null;
    let inStages = false;
    let indent = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('stages:')) {
        inStages = true;
        continue;
      }

      if (inStages) {
        // Detect new stage (name at stage indent level)
        const stageMatch = trimmed.match(/^- name:\s*(.+)$/);
        if (stageMatch && !line.startsWith('  ')) {
          currentStage = stageMatch[1].trim();
          indent = line.length - line.trimStart().length;
          continue;
        }

        // Check for 'if' condition within a stage
        if (currentStage) {
          const ifMatch = trimmed.match(/^if:\s*(.+)$/);
          if (ifMatch) {
            const condition = ifMatch[1].trim();
            const shouldInclude = this.evaluateCondition(condition, params);
            if (!shouldInclude) {
              // This stage should be excluded - mark it
              dynamicStages.push(`exclude:${currentStage}`);
            } else {
              dynamicStages.push(`include:${currentStage}`);
            }
          } else if (trimmed.startsWith('- name:') || (line.length - line.trimStart().length < indent && trimmed !== '' && !trimmed.startsWith('#'))) {
            // End of current stage block, check if it had no condition
            if (!dynamicStages.some((d) => d.endsWith(`:${currentStage}`))) {
              dynamicStages.push(`include:${currentStage}`);
            }
            if (trimmed.startsWith('- name:')) {
              currentStage = trimmed.replace(/^- name:\s*/, '').trim();
              indent = line.length - line.trimStart().length;
            }
          }
        }
      }
    }

    return dynamicStages;
  }

  /**
   * Evaluate a simple condition expression against params
   * Supports: params.name == value, params.name != value, params.name, !params.name
   */
  private evaluateCondition(condition: string, params: Record<string, unknown>): boolean {
    // Simple variable reference: ${params.name}
    const paramRefPattern = /\$\{params\.([a-zA-Z0-9_.]+)\}/g;
    let evalCondition = condition;

    // Replace param references with their values
    evalCondition = evalCondition.replace(paramRefPattern, (_match, paramName) => {
      const value = params[paramName];
      if (value === undefined) return 'undefined';
      if (typeof value === 'boolean') return String(value);
      if (typeof value === 'number') return String(value);
      if (typeof value === 'string') return `"${value}"`;
      return String(value);
    });

    try {
      // Evaluate simple expressions: "true", "false", "value == value", "value != value"
      // Using Function constructor for controlled eval (only literal expressions)
      if (evalCondition === 'true') return true;
      if (evalCondition === 'false') return false;
      if (evalCondition === 'undefined') return false;

      // Support == and != comparisons
      const eqMatch = evalCondition.match(/^(.+?)\s*==\s*(.+)$/);
      if (eqMatch) {
        const left = eqMatch[1].trim().replace(/^["']|["']$/g, '');
        const right = eqMatch[2].trim().replace(/^["']|["']$/g, '');
        return left === right;
      }

      const neqMatch = evalCondition.match(/^(.+?)\s*!=\s*(.+)$/);
      if (neqMatch) {
        const left = neqMatch[1].trim().replace(/^["']|["']$/g, '');
        const right = neqMatch[2].trim().replace(/^["']|["']$/g, '');
        return left !== right;
      }

      // If it's just a param value, treat as truthy
      return evalCondition !== 'undefined' && evalCondition !== '""' && evalCondition !== "''";
    } catch {
      // If evaluation fails, default to including the stage
      return true;
    }
  }

  /**
   * Inject standard environment variables into params
   */
  private injectEnvironmentVariables(context: TriggerContext): Record<string, string> {
    const env: Record<string, string> = {
      'trigger.type': context.triggerType,
      'trigger.by': context.triggerBy || '',
      'trigger.timestamp': new Date().toISOString(),
    };

    if (context.branch) {
      env['git.branch'] = context.branch;
    }

    if (context.commitSha) {
      env['git.sha'] = context.commitSha;
    }

    // Try to extract branch and SHA from trigger type context
    if (context.triggerType === 'push' || context.triggerType === 'api') {
      if (!env['git.branch']) {
        env['git.branch'] = 'main'; // default
      }
      if (!env['git.sha']) {
        env['git.sha'] = 'unknown'; // would be set by SCM integration
      }
    }

    return env;
  }

  /**
   * Filter stages based on dynamic stage resolution results
   * Returns the list of stages that should be included
   */
  static filterIncludedStages(
    stages: PipelineStageSpec[],
    dynamicStages: string[]
  ): PipelineStageSpec[] {
    const stageDecisions = new Map<string, boolean>();

    for (const decision of dynamicStages) {
      const [action, stageName] = decision.split(':');
      stageDecisions.set(stageName, action === 'include');
    }

    return stages.filter((stage) => {
      const include = stageDecisions.get(stage.name);
      return include !== false; // Include by default if no decision
    });
  }
}
