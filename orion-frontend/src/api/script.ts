/**
 * Script API Service
 * Auto-generated from backend script-routes.ts
 * Prefix: /api/v1/scripts
 */
import { api } from './client';

export interface Script {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createScriptScan = async (data?: Partial<Script>): Promise<Script> => {
  const response = await api.post<Script>('/api/v1/scripts/scan', data);
  return response.data;
};

export const createScriptDryRun = async (data?: Partial<Script>): Promise<Script> => {
  const response = await api.post<Script>('/api/v1/scripts/dry-run', data);
  return response.data;
};

export const createScriptExecute = async (data?: Partial<Script>): Promise<Script> => {
  const response = await api.post<Script>('/api/v1/scripts/execute', data);
  return response.data;
};

export const createScriptApproval = async (data?: Partial<Script>): Promise<Script> => {
  const response = await api.post<Script>('/api/v1/scripts/approval', data);
  return response.data;
};

export const getScript = async (approvalId: string): Promise<Script> => {
  const response = await api.get<Script>('/api/v1/scripts/approval/' + approvalId);
  return response.data;
};

export const createScriptApprovalDecide = async (approvalId: string, data?: Partial<Script>): Promise<Script> => {
  const response = await api.post<Script>('/api/v1/scripts/approval/' + approvalId + '/decide', data);
  return response.data;
};

export const createScriptAiGenerate = async (data?: Partial<Script>): Promise<Script> => {
  const response = await api.post<Script>('/api/v1/scripts/ai-generate', data);
  return response.data;
};
