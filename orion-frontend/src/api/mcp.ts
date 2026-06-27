/**
 * Mcp API Service
 * Auto-generated from backend mcp-routes.ts
 * Prefix: /v1/mcp
 */
import { api } from './client';

export interface Mcp {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createMcpMcp = async (data?: Partial<Mcp>): Promise<Mcp> => {
  const response = await api.post<Mcp>('/v1/mcp/mcp', data);
  return response.data;
};

export const listMcp = async (params?: Record<string, unknown>): Promise<{ data: Mcp[]; total: number }> => {
  const response = await api.get<{ data: Mcp[]; total: number }>('/v1/mcp/mcp/sse', { params });
  return { data: response.data.data, total: response.data.total };
};
