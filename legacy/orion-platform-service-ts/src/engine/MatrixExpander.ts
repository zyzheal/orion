/**
 * MatrixExpander - Pipeline Matrix Build Support (GAP-02)
 *
 * Handles matrix expansion for pipeline stages, similar to GitHub Actions'
 * strategy.matrix and GitLab CI's parallel:matrix.
 *
 * Responsibilities:
 * - Generate cartesian product of matrix dimensions
 * - Apply exclusions to remove unwanted combinations
 * - Name expanded stages: "stage-name (os=linux, node=18)"
 * - Inject matrix variables into stage environment (MATRIX_ prefix)
 * - Rewrite dependencies to reference expanded stage names
 */

import type { PipelineStage } from '../models/Pipeline';

/**
 * Matrix configuration within a PipelineStage.
 */
export interface MatrixConfig {
  [key: string]: string[];
}

/**
 * A single expanded stage from a matrix.
 */
export interface ExpandedStage {
  /** The expanded stage config (with env injected) */
  stage: PipelineStage;
  /** The display name including matrix variables */
  name: string;
  /** The original stage name before expansion */
  originalName: string;
  /** The matrix variable values for this combination */
  variables: Record<string, string>;
}

/**
 * Utility class for expanding pipeline matrix configurations.
 */
export class MatrixExpander {
  /**
   * Check if a stage has a matrix configuration to expand.
   */
  static hasMatrix(stage: PipelineStage): boolean {
    if (!stage.matrix) return false;
    // Exclude-only config (no dimensions) is not expandable
    const dimensions = Object.keys(stage.matrix).filter((key) => key !== 'exclude');
    return dimensions.length > 0;
  }

  /**
   * Calculate total dimensions (cartesian product size) for a matrix config.
   */
  static getMatrixDimensions(matrix: MatrixConfig): number {
    const keys = Object.keys(matrix);
    if (keys.length === 0) return 0;
    return keys.reduce((product, key) => product * matrix[key].length, 1);
  }

  /**
   * Expand a single stage with matrix configuration into multiple stages.
   *
   * Returns an array of ExpandedStage, one for each valid combination
   * (cartesian product minus exclusions).
   */
  static expandMatrix(stage: PipelineStage): ExpandedStage[] {
    if (!stage.matrix) {
      return [this.wrapStage(stage, stage.name, stage.name, {})];
    }

    // Extract matrix dimensions (exclude is not a dimension)
    const dimensions: Record<string, string[]> = {};
    for (const key of Object.keys(stage.matrix)) {
      if (key !== 'exclude' && Array.isArray(stage.matrix[key])) {
        dimensions[key] = stage.matrix[key] as string[];
      }
    }

    if (Object.keys(dimensions).length === 0) {
      return [this.wrapStage(stage, stage.name, stage.name, {})];
    }

    // Generate cartesian product
    const keys = Object.keys(dimensions);
    const combinations = this.cartesianProduct(keys, dimensions);

    // Filter out excluded combinations and build expanded stages
    const expanded: ExpandedStage[] = [];
    for (const combo of combinations) {
      // Check if this combination should be excluded (partial matching supported)
      if (stage.matrix.exclude && this.isExcluded(combo, stage.matrix.exclude)) {
        continue;
      }

      // Build the expanded stage name
      const displayName = this.buildStageName(stage.name, combo);

      // Create expanded stage with environment injection
      const expandedStage = this.wrapStage(stage, stage.name, displayName, combo);
      expanded.push(expandedStage);
    }

    return expanded;
  }

  /**
   * Expand all stages in a pipeline, rewriting dependencies accordingly.
   *
   * When a stage depends on a matrix stage, its dependsOn is rewritten
   * to reference all expanded instances of that matrix stage.
   */
  static expandAll(stages: PipelineStage[]): ExpandedStage[] {
    const allExpanded: ExpandedStage[] = [];

    // First pass: expand all stages and build a mapping of original -> expanded names
    const nameMapping = new Map<string, string[]>();
    for (const stage of stages) {
      const expanded = this.expandMatrix(stage);
      nameMapping.set(stage.name, expanded.map((e) => e.name));
      allExpanded.push(...expanded);
    }

    // Second pass: rewrite dependencies
    for (const expanded of allExpanded) {
      if (!expanded.stage.dependsOn || expanded.stage.dependsOn.length === 0) {
        continue;
      }

      const newDependsOn: string[] = [];
      for (const dep of expanded.stage.dependsOn) {
        const expandedNames = nameMapping.get(dep);
        if (expandedNames && expandedNames.length > 1) {
          // This dependency was expanded; depend on ALL expanded instances
          newDependsOn.push(...expandedNames);
        } else {
          // Either not expanded or single instance; use the mapped name
          newDependsOn.push(expandedNames ? expandedNames[0] : dep);
        }
      }

      expanded.stage.dependsOn = newDependsOn;
    }

    return allExpanded;
  }

  /**
   * Check if a combination matches any exclusion rule.
   * Supports partial matching: if exclude only specifies { os: 'macos' },
   * any combination with os=macos will be excluded regardless of other variables.
   */
  private static isExcluded(
    combo: Record<string, string>,
    exclusions: Array<Record<string, string>>
  ): boolean {
    for (const exclude of exclusions) {
      let matches = true;
      for (const key of Object.keys(exclude)) {
        if (combo[key] !== exclude[key]) {
          matches = false;
          break;
        }
      }
      if (matches) return true;
    }
    return false;
  }

  /**
   * Generate cartesian product of matrix dimensions.
   * Returns an array of Record<string, string>, each representing one combination.
   */
  private static cartesianProduct(
    keys: string[],
    dimensions: Record<string, string[]>
  ): Array<Record<string, string>> {
    if (keys.length === 0) return [{}];

    const result: Array<Record<string, string>> = [];
    this.buildCombinations(keys, dimensions, 0, {}, result);
    return result;
  }

  /**
   * Recursively build all combinations.
   */
  private static buildCombinations(
    keys: string[],
    dimensions: Record<string, string[]>,
    index: number,
    current: Record<string, string>,
    result: Array<Record<string, string>>
  ): void {
    if (index === keys.length) {
      result.push({ ...current });
      return;
    }

    const key = keys[index];
    for (const value of dimensions[key]) {
      current[key] = value;
      this.buildCombinations(keys, dimensions, index + 1, current, result);
    }
  }

  /**
   * Build the display name for an expanded stage.
   * Format: "original-name (key1=value1, key2=value2, ...)"
   * Keys are sorted alphabetically for consistent ordering.
   */
  private static buildStageName(
    originalName: string,
    variables: Record<string, string>
  ): string {
    const parts = Object.keys(variables)
      .sort()
      .map((key) => `${key}=${variables[key]}`);

    if (parts.length === 0) return originalName;
    return `${originalName} (${parts.join(', ')})`;
  }

  /**
   * Wrap a stage with matrix variables injected into the environment.
   * Also adds originalName tracking for dependency resolution.
   */
  private static wrapStage(
    original: PipelineStage,
    originalName: string,
    displayName: string,
    variables: Record<string, string>
  ): ExpandedStage {
    // Build environment with MATRIX_ prefix for each variable
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(variables)) {
      env[`MATRIX_${key.toUpperCase()}`] = value;
    }

    // Merge with any existing environment
    const expandedStage: PipelineStage = {
      ...original,
      name: displayName,
      // We store matrix variables in a metadata field for runtime access
      env: Object.keys(env).length > 0 ? env : original.env,
      // Clear matrix from expanded stages to prevent double-expansion
      matrix: undefined,
    };

    return {
      stage: expandedStage,
      name: displayName,
      originalName,
      variables,
    };
  }
}
