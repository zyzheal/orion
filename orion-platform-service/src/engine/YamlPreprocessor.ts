/**
 * YamlPreprocessor — YAML 预处理器
 *
 * 在 parsePipelineYaml 之前执行，将共享 Action 引用展开为具体步骤。
 * 支持本地、远程、内置、注册表四种 Action 类型。
 */

import * as yaml from 'js-yaml';
import { SharedActionService } from '../services/pipeline/SharedActionService';
import pino from 'pino';

const logger = pino({ name: 'yaml-preprocessor' });

export interface PipelineYaml {
  apiVersion: string;
  kind: string;
  metadata: Record<string, unknown>;
  spec: {
    stages: Array<{
      name: string;
      steps: Array<{ name: string; uses: string; with?: Record<string, unknown> }>;
      [key: string]: unknown;
    }>;
  };
}

export interface PipelineStep {
  name: string;
  uses: string;
  with?: Record<string, unknown>;
}

export class YamlPreprocessor {
  private sharedActionService: SharedActionService;

  constructor(sharedActionService: SharedActionService) {
    this.sharedActionService = sharedActionService;
  }

  /**
   * 预处理 YAML，展开所有共享 Action 引用为具体步骤。
   */
  async preprocess(yamlString: string): Promise<string> {
    const parsed = yaml.load(yamlString) as PipelineYaml;

    if (!parsed?.spec?.stages) {
      return yamlString;
    }

    for (const stage of parsed.spec.stages) {
      if (!stage.steps) continue;

      const expandedSteps: PipelineStep[] = [];

      for (const step of stage.steps) {
        if (this.isActionRef(step.uses)) {
          try {
            const resolvedSteps = await this.sharedActionService.resolveActionRef(
              step.uses,
              step.with || {},
            );
            expandedSteps.push(...resolvedSteps);
          } catch (error) {
            logger.warn({ action: step.uses, error }, 'Failed to resolve action, keeping as-is');
            expandedSteps.push(step);
          }
        } else {
          expandedSteps.push(step);
        }
      }

      stage.steps = expandedSteps;
    }

    return yaml.dump(parsed);
  }

  private isActionRef(uses: string): boolean {
    // Local: ./.orion/actions/xxx
    // Remote: org/repo@v1 (with @version)
    // Registry: registry.actions/name@v1
    // Skip builtin: prefix (handled internally)
    if (uses.startsWith('builtin:')) return false;
    if (uses.startsWith('./')) return true;
    // Only match remote action refs with @version (e.g., org/repo@v1)
    return /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+@/.test(uses);
  }
}
