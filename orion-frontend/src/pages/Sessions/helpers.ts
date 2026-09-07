/**
 * Sessions API mapping helpers
 * 抽取自 index.tsx (P2-9 Phase 130)
 */
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import type { Session as ApiSession, SessionStats as ApiSessionStats } from '@/api/session';
import type { UserSession, SessionStats } from './types';

dayjs.extend(duration);

export const deriveStatus = (session: ApiSession): 'active' | 'expired' | 'revoked' => {
  if (session.expiresAt && dayjs(session.expiresAt).isBefore(dayjs())) {
    return 'expired';
  }
  return 'active';
};

export const mapApiSession = (apiSession: ApiSession): UserSession => ({
  id: apiSession.id,
  userId: apiSession.userId,
  sessionId: apiSession.token?.substring(0, 12) || apiSession.id,
  ipAddress: apiSession.ipAddress || 'unknown',
  userAgent: apiSession.userAgent || 'unknown',
  startedAt: apiSession.createdAt,
  lastActive: apiSession.lastAccessedAt,
  status: deriveStatus(apiSession),
  duration: dayjs(apiSession.lastAccessedAt).diff(dayjs(apiSession.createdAt), 'second'),
});

export const mapApiStats = (apiStats: ApiSessionStats): SessionStats => ({
  activeSessions: apiStats.active || 0,
  totalUsers: apiStats.total || 0,
  expiredSessions: apiStats.expired || 0,
  avgDuration: 0,
});

export const formatDuration = (seconds: number): string => {
  const dur = dayjs.duration(seconds * 1000);
  const hours = dur.hours();
  const minutes = dur.minutes();
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};
