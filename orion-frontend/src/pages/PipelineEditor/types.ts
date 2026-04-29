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
}

export interface PipelineFormData {
  name: string;
  description: string;
  repository: string;
  branch: string;
  trigger: string;
  stages: StageConfig[];
}
