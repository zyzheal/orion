/**
 * Service Registry API Service
 * Prefix: /api/v1/service-registry
 */

import { api } from './client';

// ==================== Types ====================

export interface ServiceInfo {
  id: string;
  serviceId: string;
  name: string;
  address: string;
  port: number;
  protocol?: string;
  version?: string;
  health: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  registeredAt: string;
  lastHeartbeat?: string;
  metadata?: Record<string, unknown>;
}

export interface RegisterServicePayload {
  serviceId: string;
  serviceName: string;
  serviceUrl: string;
  protocol?: 'http' | 'grpc' | 'tcp' | 'custom';
  version?: string;
  metadata?: Record<string, unknown>;
}

export interface ServiceHealth {
  serviceId: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  latencyMs: number;
  lastChecked: string;
  errorRate: number;
}

export interface GetServicesParams {
  serviceName?: string;
  health?: string;
}

// ==================== Service Registry CRUD ====================

export function getServices(params?: GetServicesParams): Promise<ServiceInfo[]> {
  return api.get<ServiceInfo[]>('/api/v1/service-registry/services', { params }).then((res) => res.data);
}

export function registerService(payload: RegisterServicePayload): Promise<ServiceInfo> {
  return api.post<ServiceInfo>('/api/v1/service-registry/register', payload).then((res) => res.data);
}

export function deregisterService(serviceId: string): Promise<void> {
  return api.delete(`/api/v1/service-registry/services/${serviceId}`).then((res) => res.data) as Promise<void>;
}

export function getServiceHealth(serviceId: string): Promise<ServiceHealth> {
  return api.get<ServiceHealth>(`/api/v1/service-registry/services/${serviceId}/health`).then((res) => res.data);
}
