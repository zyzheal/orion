/**
 * Pipeline 数据模型
 */

import { v4 as uuidv4 } from 'uuid';
import { OrionError, ErrorCode } from '../errors';

export enum PipelineStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DELETED = 'deleted',
}

export interface PipelineMetadata {
  name: string;
  version: string;
  description?: string;
}

export interface PipelineTrigger {
  type: 'git' | 'api' | 'event' | 'schedule';
  events?: string[];
  branches?: string[];
  schedule?: string;
}

export interface PipelineStep {
  name: string;
  uses: string;
  with?: Record<string, unknown>;
}

export interface PipelineStage {
  name: string;
  runsOn: string;
  steps: PipelineStep[];
  dependsOn?: string[];
  if?: string;
  timeout?: number;
  retries?: number;
  // Matrix build configuration (GAP-02)
  matrix?: {
    [key: string]: string[] | Array<Record<string, string>> | undefined;
    exclude?: Array<Record<string, string>>;
  };
  // Environment variables injected into stage runtime
  env?: Record<string, string>;
  // 缓存配置
  cache?: {
    enabled: boolean;
    key: string;
    paths: string[];
    restoreKeys?: string[];
  };
  // Artifact 配置
  artifacts?: {
    upload?: string[];
    expiry?: number;  // 天数
  };
  /**
   * Stage outputs — declares what output variables this stage produces.
   * Maps output key to a value reference, typically from upstream task outputs.
   * e.g., { version: '${tasks.build.outputs.version}' }
   */
  outputs?: { [key: string]: string };
  /**
   * Quality gate configuration (GAP-CN-04)
   * Evaluates code quality metrics after stage execution.
   * - qualityGateId: Direct reference to a quality gate definition
   * - qualityGateName: Lookup by name within tenant
   * - metrics: Default metric values if not produced by tasks
   */
  qualityGate?: {
    gateId?: string;
    gateName?: string;
    defaultMetrics?: Record<string, number>;
  };
  /**
   * Deployment strategy configuration (GAP-CN-03)
   * When type is 'deploy', this configures progressive release:
   * - strategyId: Reference to a DeploymentStrategy definition
   * - strategyName: Lookup by name within tenant
   * - inline: Inline strategy config (overrides referenced strategy)
   * - healthCheckEndpoint: HTTP endpoint for health verification between steps
   */
  deploymentStrategy?: {
    strategyId?: string;
    strategyName?: string;
    healthCheckEndpoint?: string;
    inline?: {
      type: 'canary' | 'bluegreen' | 'rolling';
      config: Record<string, unknown>;
    };
  };
  /**
   * Multi-target execution configuration.
   * When present, the stage runs across multiple nodes instead of a single container.
   * Each target is a logical node identity (e.g., server hostname, runner label, IP).
   */
  targets?: string[];
  /**
   * Execution mode for multi-target stages.
   * - oneshot: all targets execute the stage simultaneously (parallel)
   * - grayScale: targets are split into batches, each batch runs sequentially
   *              after the previous batch completes
   * Ignored when targets is absent or empty.
   */
  executionMode?: 'oneshot' | 'grayScale';
  /**
   * Batch size for grayScale mode.
   * Number of targets per batch. Defaults to 1 (one target at a time).
   * Ignored when executionMode is not 'grayScale'.
   */
  batchSize?: number;
}

export interface PipelineSpec {
  triggers?: PipelineTrigger[];
  stages: PipelineStage[];
}

export interface Pipeline {
  id: string;
  name: string;
  version: string;
  description?: string;
  yamlDefinition: string;
  status: PipelineStatus;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  // 解析后的 spec
  spec?: PipelineSpec;
}

export interface PipelineCreateInput {
  name: string;
  version: string;
  description?: string;
  yamlDefinition: string;
  createdBy?: string;
}

export interface PipelineUpdateInput {
  description?: string;
  yamlDefinition?: string;
  status?: PipelineStatus;
  spec?: Record<string, unknown> | null;
}

export function createPipeline(input: PipelineCreateInput): Pipeline {
  const now = new Date();
  return {
    id: uuidv4(),
    name: input.name,
    version: input.version,
    description: input.description,
    yamlDefinition: input.yamlDefinition,
    status: PipelineStatus.ACTIVE,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
}

export function parsePipelineYaml(yaml: string): { spec: PipelineSpec; metadata: PipelineMetadata } {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const yamlModule = require('js-yaml');
  const parsed = yamlModule.load(yaml) as {
    apiVersion: string;
    kind: string;
    metadata: PipelineMetadata;
    spec: PipelineSpec;
  };

  if (!parsed.apiVersion || !parsed.kind || !parsed.metadata || !parsed.spec) {
    throw new OrionError('Invalid Pipeline YAML format', ErrorCode.VALIDATION_ERROR);
  }

  if (parsed.kind !== 'Pipeline') {
    throw new OrionError(`Expected kind 'Pipeline', got '${parsed.kind}'`, 'OPERATION_FAILED')
  }

  return {
    metadata: parsed.metadata,
    spec: parsed.spec,
  };
}
