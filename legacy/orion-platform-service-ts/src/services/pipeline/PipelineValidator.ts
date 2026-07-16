/**
 * PipelineValidator - Validates pipeline YAML specs.
 *
 * Checks for:
 * - Cyclic dependencies
 * - Missing dependsOn targets
 * - Duplicate stage names
 * - Invalid stage types
 * - Invalid conditions
 * - Required fields
 */

import * as yaml from 'js-yaml';

export interface ValidationError {
  type: 'error';
  code: string;
  message: string;
  stage?: string;
}

export interface ValidationWarning {
  type: 'warning';
  code: string;
  message: string;
  stage?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface RawStage {
  name?: string;
  type?: string;
  runsOn?: string;
  dependsOn?: string[] | string;
  if?: string;
  steps?: any[];
  timeout?: number;
  retries?: number;
  parallel?: boolean;
  config?: Record<string, any>;
  [key: string]: any;
}

const VALID_STAGE_TYPES = [
  'build', 'test', 'deploy', 'lint', 'analyze', 'publish',
  'notify', 'cleanup', 'security', 'integration-test',
  'e2e-test', 'performance-test', 'approval', 'manual',
  'script', 'container', 'shell',
];

export class PipelineValidator {

  /**
   * Validate a pipeline YAML string.
   */
  validate(yamlString: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 1. Parse YAML
    let parsed: any;
    try {
      parsed = yaml.load(yamlString);
    } catch (e: any) {
      return {
        valid: false,
        errors: [{
          type: 'error',
          code: 'YAML_PARSE_ERROR',
          message: `Failed to parse YAML: ${e.message}`,
        }],
        warnings: [],
      };
    }

    if (!parsed || typeof parsed !== 'object') {
      return {
        valid: false,
        errors: [{
          type: 'error',
          code: 'INVALID_FORMAT',
          message: 'YAML must be a mapping/object',
        }],
        warnings: [],
      };
    }

    // Support both wrapped and flat formats
    const stages = this.extractStages(parsed);

    // 2. Check required fields
    this.validateRequiredFields(parsed, errors);

    // 3. Validate stages
    if (!stages || !Array.isArray(stages)) {
      errors.push({
        type: 'error',
        code: 'MISSING_STAGES',
        message: 'spec.stages is required and must be an array',
      });
      return { valid: false, errors, warnings };
    }

    if (stages.length === 0) {
      warnings.push({
        type: 'warning',
        code: 'EMPTY_STAGES',
        message: 'Pipeline has no stages',
      });
      return { valid: true, errors, warnings };
    }

    // 4. Validate individual stages
    for (const stage of stages) {
      this.validateStage(stage, errors, warnings);
    }

    // 5. Check for duplicate stage names
    this.validateDuplicateStageNames(stages, errors);

    // 6. Check for missing dependsOn targets
    this.validateDependencies(stages, errors);

    // 7. Check for cyclic dependencies
    this.validateCycles(stages, errors);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Extract stages array from parsed YAML (supports wrapped and flat formats).
   */
  private extractStages(parsed: any): RawStage[] | null {
    if (parsed.spec?.stages && Array.isArray(parsed.spec.stages)) {
      return parsed.spec.stages;
    }
    if (parsed.stages && Array.isArray(parsed.stages)) {
      return parsed.stages;
    }
    return null;
  }

  /**
   * Validate required top-level fields.
   */
  private validateRequiredFields(parsed: any, errors: ValidationError[]): void {
    // Check apiVersion (optional but recommended)
    if (!parsed.apiVersion) {
      errors.push({
        type: 'error',
        code: 'MISSING_API_VERSION',
        message: 'Missing apiVersion field',
      });
    }

    // Check kind
    if (!parsed.kind) {
      errors.push({
        type: 'error',
        code: 'MISSING_KIND',
        message: "Missing kind field (expected 'Pipeline')",
      });
    } else if (parsed.kind !== 'Pipeline') {
      errors.push({
        type: 'error',
        code: 'INVALID_KIND',
        message: `Expected kind 'Pipeline', got '${parsed.kind}'`,
      });
    }

    // Check metadata.name
    if (!parsed.metadata?.name) {
      errors.push({
        type: 'error',
        code: 'MISSING_NAME',
        message: 'Missing metadata.name',
      });
    }
  }

  /**
   * Validate a single stage.
   */
  private validateStage(
    stage: RawStage,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const stageName = stage.name || '<unnamed>';

    // Name is required
    if (!stage.name || typeof stage.name !== 'string' || stage.name.trim().length === 0) {
      errors.push({
        type: 'error',
        code: 'MISSING_STAGE_NAME',
        message: 'Stage name is required',
        stage: stageName,
      });
    }

    // Validate stage type if provided
    if (stage.type && !VALID_STAGE_TYPES.includes(stage.type)) {
      warnings.push({
        type: 'warning',
        code: 'UNKNOWN_STAGE_TYPE',
        message: `Unknown stage type '${stage.type}'. Valid types: ${VALID_STAGE_TYPES.join(', ')}`,
        stage: stageName,
      });
    }

    // Validate timeout
    if (stage.timeout !== undefined) {
      if (typeof stage.timeout !== 'number' || stage.timeout <= 0) {
        errors.push({
          type: 'error',
          code: 'INVALID_TIMEOUT',
          message: `Stage "${stageName}" has invalid timeout: must be a positive number`,
          stage: stageName,
        });
      }
    }

    // Validate retries
    if (stage.retries !== undefined) {
      if (!Number.isInteger(stage.retries) || stage.retries < 0) {
        errors.push({
          type: 'error',
          code: 'INVALID_RETRIES',
          message: `Stage "${stageName}" has invalid retries: must be a non-negative integer`,
          stage: stageName,
        });
      }
    }

    // Validate condition expression (basic check)
    if (stage.if && typeof stage.if === 'string') {
      this.validateCondition(stage.if, stageName, errors, warnings);
    }

    // Validate dependsOn format
    if (stage.dependsOn !== undefined) {
      if (typeof stage.dependsOn === 'string') {
        warnings.push({
          type: 'warning',
          code: 'DEPENDSON_STRING',
          message: `Stage "${stageName}" dependsOn should be an array, not a string`,
          stage: stageName,
        });
      } else if (!Array.isArray(stage.dependsOn)) {
        errors.push({
          type: 'error',
          code: 'INVALID_DEPENDSON',
          message: `Stage "${stageName}" dependsOn must be an array`,
          stage: stageName,
        });
      }
    }

    // Warning for stages with no steps or config
    if (!stage.steps || stage.steps.length === 0) {
      warnings.push({
        type: 'warning',
        code: 'EMPTY_STAGE_STEPS',
        message: `Stage "${stageName}" has no steps defined`,
        stage: stageName,
      });
    }
  }

  /**
   * Basic validation of condition expressions.
   */
  private validateCondition(
    condition: string,
    stageName: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check for obviously invalid expressions
    if (condition.trim().length === 0) {
      errors.push({
        type: 'error',
        code: 'EMPTY_CONDITION',
        message: `Stage "${stageName}" has an empty condition expression`,
        stage: stageName,
      });
      return;
    }

    // Check for dangerous patterns
    const dangerousPatterns = ['eval(', 'Function(', 'require(', 'process.', '__proto__', 'constructor('];
    for (const pattern of dangerousPatterns) {
      if (condition.includes(pattern)) {
        errors.push({
          type: 'error',
          code: 'UNSAFE_CONDITION',
          message: `Stage "${stageName}" contains unsafe condition: "${pattern}"`,
          stage: stageName,
        });
      }
    }
  }

  /**
   * Check for duplicate stage names.
   */
  private validateDuplicateStageNames(stages: RawStage[], errors: ValidationError[]): void {
    const seen = new Map<string, number>();

    for (const stage of stages) {
      const name = stage.name || '<unnamed>';
      if (seen.has(name)) {
        seen.set(name, (seen.get(name) || 0) + 1);
      } else {
        seen.set(name, 1);
      }
    }

    for (const [name, count] of seen.entries()) {
      if (count > 1) {
        errors.push({
          type: 'error',
          code: 'DUPLICATE_STAGE_NAME',
          message: `Duplicate stage name: "${name}" (appears ${count} times)`,
          stage: name,
        });
      }
    }
  }

  /**
   * Check that all dependsOn targets reference existing stage names.
   */
  private validateDependencies(stages: RawStage[], errors: ValidationError[]): void {
    const stageNames = new Set(stages.map(s => s.name).filter(Boolean));

    for (const stage of stages) {
      if (!stage.name) continue;

      const deps = Array.isArray(stage.dependsOn) ? stage.dependsOn :
        typeof stage.dependsOn === 'string' ? [stage.dependsOn] : [];

      for (const dep of deps) {
        if (!stageNames.has(dep)) {
          errors.push({
            type: 'error',
            code: 'MISSING_DEPENDENCY',
            message: `Stage "${stage.name}" depends on unknown stage "${dep}"`,
            stage: stage.name,
          });
        }
      }
    }
  }

  /**
   * Check for cyclic dependencies using DFS.
   */
  private validateCycles(stages: RawStage[], errors: ValidationError[]): void {
    // Build adjacency list
    const adj = new Map<string, string[]>();
    for (const stage of stages) {
      if (!stage.name) continue;
      const deps = Array.isArray(stage.dependsOn) ? stage.dependsOn :
        typeof stage.dependsOn === 'string' ? [stage.dependsOn] : [];
      adj.set(stage.name, deps.filter(Boolean));
    }

    // DFS cycle detection
    const WHITE = 0; // unvisited
    const GRAY = 1;  // currently visiting
    const BLACK = 2; // fully processed
    const color = new Map<string, number>();
    const cyclePath: string[] = [];

    for (const stage of stages) {
      if (!stage.name) continue;
      color.set(stage.name, WHITE);
    }

    const dfs = (node: string): boolean => {
      color.set(node, GRAY);
      cyclePath.push(node);

      for (const neighbor of adj.get(node) || []) {
        if (!color.has(neighbor)) continue; // unknown dependency, handled elsewhere

        if (color.get(neighbor) === GRAY) {
          // Found a cycle - extract the cycle from path
          const cycleStart = cyclePath.indexOf(neighbor);
          const cycle = cyclePath.slice(cycleStart).concat(neighbor);
          errors.push({
            type: 'error',
            code: 'CYCLIC_DEPENDENCY',
            message: `Cyclic dependency detected: ${cycle.join(' -> ')}`,
          });
          return true;
        }

        if (color.get(neighbor) === WHITE) {
          if (dfs(neighbor)) return true;
        }
      }

      color.set(node, BLACK);
      cyclePath.pop();
      return false;
    };

    for (const stage of stages) {
      if (!stage.name) continue;
      if (color.get(stage.name) === WHITE) {
        dfs(stage.name);
      }
    }
  }
}
