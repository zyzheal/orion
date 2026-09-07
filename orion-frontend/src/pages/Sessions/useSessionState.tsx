/**
 * Sessions state hook
 * 抽取自 index.tsx (P2-9 Phase 130)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import { getSessions, getSessionStats, deleteSession as apiDeleteSession } from '@/api/session';
import type { SessionStats as ApiSessionStats } from '@/api/session';
import type { UserSession, SessionStats } from './types';
import { mapApiSession, mapApiStats } from './helpers';

export const useSessionState = () => {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedSession, setSelectedSession] = useState<UserSession | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionsRes, statsRes] = await Promise.all([getSessions(), getSessionStats()]);
      const sessionsData = (sessionsRes.data as any)?.sessions || sessionsRes.data || [];
      const statsData = (statsRes.data as any)?.stats || statsRes.data || {};
      setSessions(Array.isArray(sessionsData) ? sessionsData.map(mapApiSession) : []);
      setStats(mapApiStats(statsData as ApiSessionStats));
    } catch (error: unknown) {
      message.error(`加载 Session 数据失败: ${(error as Error).message}`);
      setSessions([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !s.userId.toLowerCase().includes(q) &&
          !s.sessionId.toLowerCase().includes(q) &&
          !s.ipAddress.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [sessions, statusFilter, searchQuery]);

  const openDetail = useCallback((session: UserSession) => {
    setSelectedSession(session);
    setDetailDrawerVisible(true);
  }, []);

  const handleRevoke = useCallback(
    async (id: string) => {
      try {
        await apiDeleteSession(id);
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status: 'revoked' as const } : s))
        );
        message.success('会话已撤销');
        if (selectedSession?.id === id) {
          setSelectedSession((prev) => (prev ? { ...prev, status: 'revoked' as const } : prev));
        }
      } catch (error: unknown) {
        message.error(`撤销失败: ${(error as Error).message}`);
      }
    },
    [selectedSession?.id]
  );

  return {
    loading,
    sessions,
    stats,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedSession,
    setSelectedSession,
    loadData,
    filteredSessions,
    openDetail,
    handleRevoke,
  };
};

export type SessionState = ReturnType<typeof useSessionState>;
