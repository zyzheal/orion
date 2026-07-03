/**
 * Gateway Routes API Client
 *
 * Backend routes: /api/v1/gateway/routes
 *
 * Provides CRUD operations for API Gateway route management:
 * - List all routes
 * - Create a new route
 * - Update an existing route
 * - Delete a route
 * - Toggle route enabled/disabled status
 */

import { api } from './client';

export interface GatewayRoute {
  id: string;
  path: string;
  method: string;
  targetService: string;
  targetUrl?: string;
  description?: string;
  enabled: boolean;
  authRequired: boolean;
  allowedRoles?: string[];
  allowedTenants?: string[];
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
  timeoutMs?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  lastRequestAt?: string;
  requestCount?: number;
  errorRate?: number;
}

export interface GatewayRouteInput {
  path: string;
  method: string;
  targetService: string;
  targetUrl?: string;
  description?: string;
  enabled?: boolean;
  authRequired?: boolean;
  allowedRoles?: string[];
  allowedTenants?: string[];
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
  timeoutMs?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
}

export interface GatewayRouteStats {
  total: number;
  enabled: number;
  disabled: number;
  byMethod: Record<string, number>;
  byService: Record<string, number>;
  totalRequests: number;
  avgErrorRate: number;
}

export async function getGatewayRoutes(): Promise<GatewayRoute[]> {
  const response = await api.get<GatewayRoute[]>('/v1/gateway/routes');
  return response.data;
}

export async function getGatewayRoute(id: string): Promise<GatewayRoute> {
  const response = await api.get<GatewayRoute>(`/v1/gateway/routes/${id}`);
  return response.data;
}

export async function createGatewayRoute(data: GatewayRouteInput): Promise<GatewayRoute> {
  const response = await api.post<GatewayRoute>('/v1/gateway/routes', data);
  return response.data;
}

export async function updateGatewayRoute(id: string, data: Partial<GatewayRouteInput>): Promise<GatewayRoute> {
  const response = await api.put<GatewayRoute>(`/v1/gateway/routes/${id}`, data);
  return response.data;
}

export async function deleteGatewayRoute(id: string): Promise<void> {
  await api.delete<void>(`/v1/gateway/routes/${id}`);
}

export async function toggleGatewayRoute(id: string, enabled: boolean): Promise<GatewayRoute> {
  const response = await api.patch<GatewayRoute>(`/v1/gateway/routes/${id}/toggle`, { enabled });
  return response.data;
}

export async function getGatewayRouteStats(): Promise<GatewayRouteStats> {
  const response = await api.get<GatewayRouteStats>('/v1/gateway/routes/stats');
  return response.data;
}
