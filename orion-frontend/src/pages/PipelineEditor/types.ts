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

export interface StageConfig {
  id: string;
  name: string;
  type: string;
  timeout?: number;
  retryCount?: number;
  dependsOn?: string[];
  config?: Record<string, any>;
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
