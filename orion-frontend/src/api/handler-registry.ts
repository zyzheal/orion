/**
 * Handler Registry API
 * Phase 1 - SPI handler registration and resolution
 */
import apiClient from './client';

export interface HandlerEntry {
  domain: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterHandlerInput {
  domain: string;
  name: string;
  version: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export const listHandlers = (params?: { domain?: string }) =>
  apiClient.get<HandlerEntry[]>('/handlers', { params });

export const getHandler = (domain: string, name: string) =>
  apiClient.get<HandlerEntry>(`/handlers/${domain}/${name}`);

export const registerHandler = (data: RegisterHandlerInput) =>
  apiClient.post<HandlerEntry>('/handlers/register', data);

export const enableHandler = (domain: string, name: string) =>
  apiClient.post(`/handlers/${domain}/${name}/enable`);

export const disableHandler = (domain: string, name: string) =>
  apiClient.post(`/handlers/${domain}/${name}/disable`);

export const unregisterHandler = (domain: string, name: string) =>
  apiClient.delete(`/handlers/${domain}/${name}`);

export const listDomains = () =>
  apiClient.get<string[]>('/handlers/domains');

export const getHandlerHealth = () =>
  apiClient.get<HandlerEntry[]>('/handlers/health');
