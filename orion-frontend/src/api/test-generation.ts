/**
 * TestGeneration API Service
 * Auto-generated from backend test-generation-routes.ts
 * Prefix: /api/v1/test-generation
 */
import { api } from './client';

export interface TestGeneration {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createTestGenerationGenerate = async (data?: Partial<TestGeneration>): Promise<TestGeneration> => {
  const response = await api.post<TestGeneration>('/api/v1/test-generation/generate', data);
  return response.data;
};

export const createTestGenerationAnalyzeChange = async (data?: Partial<TestGeneration>): Promise<TestGeneration> => {
  const response = await api.post<TestGeneration>('/api/v1/test-generation/analyze-change', data);
  return response.data;
};

export const createTestGenerationSuggestCoverage = async (data?: Partial<TestGeneration>): Promise<TestGeneration> => {
  const response = await api.post<TestGeneration>('/api/v1/test-generation/suggest-coverage', data);
  return response.data;
};

export const listTestGeneration = async (params?: Record<string, unknown>): Promise<{ data: TestGeneration[]; total: number }> => {
  const response = await api.get<{ data: TestGeneration[]; total: number }>('/api/v1/test-generation/templates', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getTestGeneration = async (language: string, framework: string): Promise<TestGeneration> => {
  const response = await api.get<TestGeneration>('/api/v1/test-generation/templates/' + language + '/' + framework);
  return response.data;
};

export const createTestGenerationHistoryAdopt = async (generationId: string, data?: Partial<TestGeneration>): Promise<TestGeneration> => {
  const response = await api.post<TestGeneration>('/api/v1/test-generation/history/' + generationId + '/adopt', data);
  return response.data;
};
