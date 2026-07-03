/**
 * Service Registry API Service
 * Prefix: /v1/service-registry
 */

import { api } from './client';

// ==================== Types ====================

export interface ServiceInfo {
  id: string;
  name: string;
  address: string;
  port: number;
  health: 'healthy' | 'unhealthy' | 'unknown';
  registeredAt: string;
  lastHeartbeat?: string;
  metadata?: Record<string, unknown>;
}

export interface RegisterServicePayload {
  name: string;
  address: string;
  port: number;
  metadata?: Record<string, unknown>;
}

export interface ServiceHealth {
  serviceId: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  latencyMs: number;
  lastChecked: string;
  errorRate: number;
}

// ==================== Service Registry CRUD ====================

export function getServices(): Promise<ServiceInfo[]> {
  return api.get<ServiceInfo[]>('/v1/service-registry/services').then((res) => res.data);
}

export function registerService(payload: RegisterServicePayload): Promise<ServiceInfo> {
  return api.post<ServiceInfo>('/v1/service-registry/register', payload).then((res) => res.data);
}

export function deregisterService(serviceId: string): Promise<void> {
  return api.delete(`/v1/service-registry/services/${serviceId}`).then((res) => res.data);
}

export function getServiceHealth(serviceId: string): Promise<ServiceHealth> {
  return api.get<ServiceHealth>(`/v1/service-registry/services/${serviceId}/health`).then((res) => res.data);
}
