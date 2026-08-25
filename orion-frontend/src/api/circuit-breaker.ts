/**
 * Circuit Breaker API Client
 *
 * Note: Backend API not yet implemented. This module defines
 * the expected interface for when the backend is available.
 *
 * Expected backend routes:
 * - GET /circuit-breakers - list all circuit breakers
 * - GET /circuit-breakers/:id - get circuit breaker detail
 * - GET /circuit-breakers/:id/status - get current status
 * - POST /circuit-breakers - create circuit breaker
 * - PUT /circuit-breakers/:id - update circuit breaker
 * - DELETE /circuit-breakers/:id - delete circuit breaker
 * - POST /circuit-breakers/:id/reset - reset to closed state
 */

import { api } from './client';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  id: string;
  name: string;
  service: string;
  endpoint?: string;
  failureThreshold: number;
  successThreshold: number;
  timeoutSeconds: number;
  halfOpenMaxRequests: number;
  state: CircuitState;
  enabled: boolean;
  lastStateChange?: string;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  totalFailures: number;
  createdAt: string;
  updatedAt: string;
}

export interface CircuitBreakerStats {
  totalBreakers: number;
  closedCount: number;
  openCount: number;
  halfOpenCount: number;
  totalRequests: number;
  totalFailures: number;
}

export async function getCircuitBreakers() {
  return api.get<CircuitBreakerConfig[]>('/circuit-breakers');
}

export async function getCircuitBreaker(id: string) {
  return api.get<CircuitBreakerConfig>(`/circuit-breakers/${id}`);
}

export async function getCircuitBreakerStatus(id: string) {
  return api.get<{ state: CircuitState; failureCount: number; successCount: number }>(
    `/circuit-breakers/${id}/status`
  );
}

export async function createCircuitBreaker(
  data: Omit<
    CircuitBreakerConfig,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'failureCount'
    | 'successCount'
    | 'totalRequests'
    | 'totalFailures'
  >
) {
  return api.post<CircuitBreakerConfig>('/circuit-breakers', data);
}

export async function updateCircuitBreaker(id: string, data: Partial<CircuitBreakerConfig>) {
  return api.put<CircuitBreakerConfig>(`/circuit-breakers/${id}`, data);
}

export async function deleteCircuitBreaker(id: string) {
  return api.delete<void>(`/circuit-breakers/${id}`);
}

export async function resetCircuitBreaker(id: string) {
  return api.post<CircuitBreakerConfig>(`/circuit-breakers/${id}/reset`);
}

export async function getCircuitBreakerStats() {
  return api.get<CircuitBreakerStats>('/circuit-breakers/stats');
}
