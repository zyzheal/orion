/**
 * Pipeline 数据模型
 */

import { v4 as uuidv4 } from 'uuid';

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
    throw new Error('Invalid Pipeline YAML format');
  }

  if (parsed.kind !== 'Pipeline') {
    throw new Error(`Expected kind 'Pipeline', got '${parsed.kind}'`);
  }

  return {
    metadata: parsed.metadata,
    spec: parsed.spec,
  };
}
