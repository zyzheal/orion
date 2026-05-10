/**
 * Pipeline Editor 共享类型定义
 */

export interface CacheConfig {
  enabled: boolean;
  key: string;
  paths: string[];
  restoreKeys?: string[];
}

export interface ArtifactConfig {
  upload?: string[];
  expiry?: number;
}

/** 矩阵维度：key (如 "os", "node") + values (值数组) */
export interface MatrixDimension {
  key: string;
  values: string[];
}

/** 排除规则：匹配一组维度值则排除该组合 */
export interface ExclusionRule {
  match: Record<string, string>;
  reason?: string;
}

/** 矩阵构建配置 */
export interface MatrixBuildConfig {
  enabled: boolean;
  dimensions: MatrixDimension[];
  exclusions: ExclusionRule[];
}

/** 子流水线配置：调用另一条流水线 */
export interface SubPipelineConfig {
  pipelineId: string;
  branch?: string;
  params?: Record<string, string>;
}

/** Buildx 多架构构建配置 */
export interface BuildxConfig {
  imageName: string;
  tags: string[];
  platforms: string[];
  dockerfilePath?: string;
  context?: string;
  push?: boolean;
}

/** Container 容器运行配置 */
export interface ContainerConfig {
  image: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  volumes?: Array<{ hostPath: string; containerPath: string; readOnly?: boolean }>;
  resources?: {
    cpu?: string;
    memory?: string;
    gpu?: { devices?: string; capabilities?: string[] };
  };
  network?: 'host' | 'bridge' | 'none';
}

export interface StageConfig {
  id: string;
  name: string;
  type: string;
  timeout?: number;
  retryCount?: number;
  dependsOn?: string[];
  config?: Record<string, any>;
  subPipeline?: SubPipelineConfig;
  cache?: CacheConfig;
  artifacts?: ArtifactConfig;
  matrix?: MatrixBuildConfig;
}

export interface PipelineFormData {
  name: string;
  description: string;
  repository: string;
  branch: string;
  trigger: string;
  stages: StageConfig[];
}
