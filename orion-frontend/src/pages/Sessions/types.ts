/**
 * Sessions types
 * 抽取自 index.tsx (P2-9 Phase 130)
 */

export interface UserSession {
  id: string;
  userId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  startedAt: string;
  lastActive: string;
  status: 'active' | 'expired' | 'revoked';
  duration: number; // in seconds
}

export interface SessionStats {
  activeSessions: number;
  totalUsers: number;
  expiredSessions: number;
  avgDuration: number; // in seconds
}

export type SessionStatus = UserSession['status'];
