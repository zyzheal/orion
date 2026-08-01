/**
 * Session API Client
 *
 * Backend routes: orion-platform-service/src/api/session-routes.ts
 */

import { api } from './client';

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  lastAccessedAt: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface SessionStats {
  total: number;
  active: number;
  expired: number;
}

export async function getSessions(tenantId?: string) {
  const qs = tenantId ? `?tenantId=${tenantId}` : '';
  return api.get<Session[]>(`/api/v1/sessions${qs}`);
}

export async function getSession(id: string) {
  return api.get<Session>(`/api/v1/sessions/${id}`);
}

export async function deleteSession(id: string) {
  return api.delete<void>(`/api/v1/sessions/${id}`);
}

export async function getSessionStats() {
  return api.get<SessionStats>('/api/v1/sessions/stats');
}
