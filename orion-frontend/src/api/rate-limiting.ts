/**
 * Rate Limiting API Client
 *
 * Note: Backend API not yet implemented. This module defines
 * the expected interface for when the backend is available.
 *
 * Expected backend routes:
 * - GET /rate-limits - list all rate limit configs
 * - POST /rate-limits - create rate limit
 * - PUT /rate-limits/:id - update rate limit
 * - DELETE /rate-limits/:id - delete rate limit
 * - POST /rate-limits/:id/toggle - enable/disable
 */

import { api } from './client';

export interface RateLimitRule {
  id: string;
  name: string;
  endpoint: string;
  method: string;
  maxRequests: number;
  windowSeconds: number;
  strategy: 'fixed' | 'sliding' | 'token-bucket';
  enabled: boolean;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RateLimitStats {
  totalRules: number;
  activeRules: number;
  totalRequests: number;
  rejectedRequests: number;
  rejectionRate: number;
}

export async function getRateLimits(params?: { tenantId?: string; enabled?: boolean }) {
  return api.get<RateLimitRule[]>('/rate-limits', { params });
}

export async function createRateLimit(data: Omit<RateLimitRule, 'id' | 'createdAt' | 'updatedAt'>) {
  return api.post<RateLimitRule>('/rate-limits', data);
}

export async function updateRateLimit(id: string, data: Partial<RateLimitRule>) {
  return api.put<RateLimitRule>(`/rate-limits/${id}`, data);
}

export async function deleteRateLimit(id: string) {
  return api.delete<void>(`/rate-limits/${id}`);
}

export async function toggleRateLimit(id: string, enabled: boolean) {
  return api.post<RateLimitRule>(`/rate-limits/${id}/toggle`, { enabled });
}

export async function getRateLimitStats() {
  return api.get<RateLimitStats>('/rate-limits/stats');
}
