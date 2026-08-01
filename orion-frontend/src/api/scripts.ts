/**
 * Script Execution API Service
 *
 * Backend routes: orion-platform-service/src/api/script-routes.ts
 */
import { api } from './client';

export type ScriptLanguage = 'javascript' | 'typescript' | 'python' | 'shell';
export type ScriptLevel = 'safe' | 'standard' | 'advanced';

export interface ScriptScanResult {
  passed: boolean;
  warnings: string[];
  errors: string[];
  riskScore: number;
}

export interface ScriptExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
  exitCode: number;
}

export interface ScriptConfig {
  code: string;
  language: ScriptLanguage;
  level: ScriptLevel;
  permissions?: Record<string, unknown>;
  approvalId?: string;
}

/**
 * Scan script for security issues (dry-run)
 */
export function scanScript(config: ScriptConfig) {
  return api.post<ScriptScanResult>('/api/script/scan', { config });
}

/**
 * Execute a script
 */
export function executeScript(
  taskId: string,
  pipelineRunId: string,
  stageId: string,
  config: ScriptConfig,
  options?: { workspace?: Record<string, unknown>; env?: Record<string, unknown>; timeout?: number }
) {
  return api.post<ScriptExecutionResult>('/api/script/execute', {
    taskId,
    pipelineRunId,
    stageId,
    config,
    ...options,
  });
}
