/**
 * Dual Engine (AI Training) API Client
 *
 * Aligned with backend /api/dual-engines/* routes (dual-engine-routes.ts)
 * Covers: dual engine CRUD, status, analysis
 */
import { api } from './client';

export interface AstConfig {
  supportedLanguages: string[];
  parseTimeout: number;
  incrementalParsing: boolean;
  maxDepth: number;
}

export interface LlmConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  contextLearning: boolean;
  contextWindowSize: number;
}

export interface DualEngine {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  ast_config: AstConfig;
  llm_config: LlmConfig;
  status?: string;
  created_at: string;
  updated_at: string;
}

export interface DualEngineStatus {
  id: string;
  engine_id: string;
  status: 'active' | 'inactive' | 'error';
  last_analysis_at?: string;
  total_analyses?: number;
  error_message?: string;
}

export interface AnalysisResult {
  engine_id: string;
  file_paths: string[];
  ast_results?: Record<string, unknown>;
  llm_results?: Record<string, unknown>;
  combined_results?: Record<string, unknown>;
  analyzed_at: string;
}

// ==================== Dual Engine CRUD ====================

export const createDualEngine = async (data: {
  name: string;
  description: string;
  astConfig: AstConfig;
  llmConfig: LlmConfig;
}): Promise<DualEngine> => {
  const response = await api.post<DualEngine>('/dual-engines', data);
  return response.data;
};

export const listDualEngines = async (): Promise<DualEngine[]> => {
  const response = await api.get<DualEngine[]>('/dual-engines');
  return Array.isArray(response.data) ? response.data : [];
};

export const getDualEngine = async (id: string): Promise<DualEngine> => {
  const response = await api.get<DualEngine>('/dual-engines/' + id);
  return response.data;
};

export const updateDualEngine = async (id: string, data: Partial<{
  name: string;
  description: string;
  astConfig: AstConfig;
  llmConfig: LlmConfig;
}>): Promise<DualEngine> => {
  const response = await api.put<DualEngine>('/dual-engines/' + id, data);
  return response.data;
};

export const deleteDualEngine = async (id: string): Promise<void> => {
  await api.delete('/dual-engines/' + id);
};

// ==================== Status & Analysis ====================

export const getDualEngineStatus = async (id: string): Promise<DualEngineStatus> => {
  const response = await api.get<DualEngineStatus>('/dual-engines/' + id + '/status');
  return response.data;
};

export const startAnalysis = async (id: string, filePaths: string[]): Promise<AnalysisResult> => {
  const response = await api.post<AnalysisResult>('/dual-engines/' + id + '/analyze', { filePaths });
  return response.data;
};
