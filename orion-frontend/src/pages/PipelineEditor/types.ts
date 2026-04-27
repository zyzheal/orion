/**
 * Pipeline Editor 共享类型定义
 */

export interface StageConfig {
  id: string;
  name: string;
  type: string;
  timeout?: number;
  retryCount?: number;
  onFailure?: boolean;
  parallel?: boolean;
  condition?: string;
  env?: Record<string, string>;
  script?: string;
  scripts?: string[];
  inputs?: string[];
  outputs?: string[];
  agents?: Record<string, string>;
  when?: {
    branch?: string[];
    event?: string[];
  };
}

export interface PipelineFormData {
  name: string;
  description: string;
  repository: string;
  branch: string;
  trigger: string;
  stages: StageConfig[];
}
