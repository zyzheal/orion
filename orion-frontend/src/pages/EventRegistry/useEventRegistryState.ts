/**
 * useEventRegistryState.ts - EventRegistry 状态 Hook
 * 抽取自 EventRegistry/index.tsx (P2-9 Phase 63)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { message } from 'antd';
import {
  getEventTypes,
  getSubscriptions,
  testMatch,
  getStatistics,
  type EventTypeInfo,
  type Subscription,
  type TestMatchResult,
} from '@/api/event-registry';
import type { StatisticsData } from './types';

export const useEventRegistryState = () => {
  // Loading states
  const [loadingEventTypes, setLoadingEventTypes] = useState(false);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [loadingStatistics, setLoadingStatistics] = useState(false);
  const [loadingTestMatch, setLoadingTestMatch] = useState(false);

  // Data states
  const [eventTypes, setEventTypes] = useState<EventTypeInfo[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);

  // Test match modal state
  const [testMatchModalVisible, setTestMatchModalVisible] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState<string>('');
  const [testPayload, setTestPayload] = useState<string>('{}');
  const [testResults, setTestResults] = useState<TestMatchResult[]>([]);

  // Load event types
  const loadEventTypes = useCallback(async () => {
    setLoadingEventTypes(true);
    try {
      const data = await getEventTypes();
      setEventTypes(data.eventTypes || []);
      setCategories(data.categories || []);
    } catch (error: unknown) {
      message.error(`加载事件类型失败: ${(error as Error).message}`);
    } finally {
      setLoadingEventTypes(false);
    }
  }, []);

  // Load subscriptions
  const loadSubscriptions = useCallback(async () => {
    setLoadingSubscriptions(true);
    try {
      const data = await getSubscriptions();
      setSubscriptions(data.subscriptions || []);
    } catch (error: unknown) {
      message.error(`加载订阅状态失败: ${(error as Error).message}`);
    } finally {
      setLoadingSubscriptions(false);
    }
  }, []);

  // Load statistics
  const loadStatistics = useCallback(async () => {
    setLoadingStatistics(true);
    try {
      const data = await getStatistics();
      setStatistics(data);
    } catch (error: unknown) {
      message.error(`加载统计信息失败: ${(error as Error).message}`);
    } finally {
      setLoadingStatistics(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadEventTypes();
    loadSubscriptions();
    loadStatistics();
  }, [loadEventTypes, loadSubscriptions, loadStatistics]);

  // Group event types by category
  const eventTypesByCategory = useMemo(() => {
    const grouped: Record<string, EventTypeInfo[]> = {};
    for (const et of eventTypes) {
      if (!grouped[et.category]) {
        grouped[et.category] = [];
      }
      grouped[et.category].push(et);
    }
    return grouped;
  }, [eventTypes]);

  // Run test match
  const runTestMatch = useCallback(async () => {
    if (!selectedEventType) {
      message.warning('请选择事件类型');
      return;
    }

    let parsedPayload: Record<string, unknown>;
    try {
      parsedPayload = JSON.parse(testPayload);
    } catch {
      message.error('JSON 格式错误');
      return;
    }

    setLoadingTestMatch(true);
    try {
      const data = await testMatch({
        eventType: selectedEventType,
        eventPayload: parsedPayload,
      });
      setTestResults(data.results || []);
      const matchedCount = data.results.filter((r) => r.matched).length;
      const totalCount = data.results.length;
      if (totalCount === 0) {
        message.info('当前事件类型没有已注册的触发器');
      } else if (matchedCount > 0) {
        message.success(`匹配完成: ${matchedCount}/${totalCount} 个触发器匹配`);
      } else {
        message.warning(`匹配完成: ${totalCount} 个触发器均不匹配`);
      }
    } catch (error: unknown) {
      message.error(`测试匹配失败: ${(error as Error).message}`);
    } finally {
      setLoadingTestMatch(false);
    }
  }, [selectedEventType, testPayload]);

  // Copy payload sample
  const copySamplePayload = useCallback((sample: Record<string, unknown>) => {
    navigator.clipboard.writeText(JSON.stringify(sample, null, 2));
    message.success('已复制到剪贴板');
  }, []);

  return {
    loadingEventTypes,
    loadingSubscriptions,
    loadingStatistics,
    loadingTestMatch,
    eventTypes,
    categories,
    subscriptions,
    statistics,
    testMatchModalVisible,
    setTestMatchModalVisible,
    selectedEventType,
    setSelectedEventType,
    testPayload,
    setTestPayload,
    testResults,
    eventTypesByCategory,
    loadEventTypes,
    loadSubscriptions,
    loadStatistics,
    runTestMatch,
    copySamplePayload,
  };
};
