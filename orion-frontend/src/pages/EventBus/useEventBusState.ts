/**
 * EventBus Monitoring state hook
 * 抽取自 index.tsx (P2-9 Phase 164)
 */
import { useState, useMemo, useEffect } from 'react';
import { message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import { getEvents, getStats } from '@/api/eventbus';
import type { EventBusEvent as ApiEventBusEvent } from '@/api/eventbus';
import type { EventBusEvent, EventBusStats } from './types';

const mapApiEvent = (apiEvent: ApiEventBusEvent): EventBusEvent => ({
  id: apiEvent.id,
  eventType: apiEvent.subject,
  source: apiEvent.source || apiEvent.publishedBy || 'unknown',
  timestamp: apiEvent.publishedAt || apiEvent.createdAt,
  status: (apiEvent.status as EventBusEvent['status']) || 'pending',
  payloadSize: JSON.stringify(apiEvent.payload || {}).length,
  subscriberCount: 0,
  topic: apiEvent.subject,
  traceId: apiEvent.id.substring(0, 12),
});

const mapApiStats = (rawStats: Record<string, number>): EventBusStats => ({
  totalEvents: rawStats.total || 0,
  activeSubscribers: rawStats.activeSubscribers || 0,
  failedEvents: rawStats.failed || rawStats.failedEvents || 0,
  eventRate: rawStats.eventRate || 0,
});

export function useEventBusState() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventBusEvent | null>(null);

  const { data: rawData, isLoading: loading, isError, error, refetch } = useQuery<{
    events: EventBusEvent[];
    stats: EventBusStats | null;
  }>({
    queryKey: ['event-bus'],
    queryFn: async () => {
      const [eventsRes, statsRes] = await Promise.all([getEvents({ limit: 100 }), getStats()]);
      const eventsData = (eventsRes.data as any)?.events || [];
      const statsData = (statsRes.data as any)?.stats || {};
      return {
        events: eventsData.map(mapApiEvent),
        stats: mapApiStats(statsData),
      };
    },
    retry: 0,
    staleTime: 30_000,
  });

  // 加载失败反馈：本项目锁定的 @tanstack/react-query 5.101.4 构建不会调用
  // useQuery 的 onError 选项（QueryObserver 未实现 observer 级回调），
  // 故统一改用 isError + useEffect 呈现错误，保证用户可见性。
  useEffect(() => {
    if (isError) {
      message.error(
        `加载 EventBus 数据失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }, [isError, error]);

  const events = rawData?.events ?? [];
  const stats = rawData?.stats ?? null;

  const eventTypes = useMemo(
    () => Array.from(new Set(events.map((e) => e.eventType))).sort(),
    [events]
  );

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (typeFilter !== 'all' && e.eventType !== typeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !e.eventType.toLowerCase().includes(q) &&
          !e.source.toLowerCase().includes(q) &&
          !e.traceId.toLowerCase().includes(q) &&
          !e.topic.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [events, statusFilter, typeFilter, searchQuery]);

  const openDetail = (event: EventBusEvent) => {
    setSelectedEvent(event);
    setDetailDrawerVisible(true);
  };

  return {
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    searchQuery,
    setSearchQuery,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedEvent,
    setSelectedEvent,
    loading,
    refetch,
    events,
    stats,
    eventTypes,
    filteredEvents,
    openDetail,
  };
}
