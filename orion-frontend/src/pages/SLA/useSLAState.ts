/**
 * useSLAState.ts - SLA Management 页面状态管理
 * 抽取自 SLA/index.tsx (P2-9 Phase 55)
 * 全部 state + 4 loaders + 7 handlers + definitionMap memo
 * 表单 validateFields 由主页面 wrapper 负责，本 hook handler 接收 values/ID
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import {
  getSLADefinitions,
  createSLADefinition,
  updateSLADefinition,
  deleteSLADefinition,
  getSLATrackings,
  createSLATracking,
  updateSLATrackingStatus,
  markSLABreach,
  getSLABreaches,
  getSLAStats,
} from '@/api/sla';
import type {
  SLADefinition,
  SLATracking,
  SLABreachEvent,
  SLAStats,
} from '@/api/sla';
import { TRACKING_STATUS_LABEL_MAP } from './config';

// ============================================================================
// Types
// ============================================================================

export interface SaveDefInput {
  name: string;
  description?: string;
  type: string;
  target_value: number;
  target_unit: string;
  business_hours_only: boolean;
  priority?: string;
  category?: string;
}

export interface CreateTrackingInput {
  sla_definition_id: string;
  entity_type: string;
  entity_id: string;
  target_time: string;
  notes?: string;
}

// ============================================================================
// Hook
// ============================================================================

export const useSLAState = () => {
  // --- State ---
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('definitions');

  // Definitions state
  const [definitions, setDefinitions] = useState<SLADefinition[]>([]);
  const [defTotal, setDefTotal] = useState(0);
  const [defTypeFilter, setDefTypeFilter] = useState<string | undefined>(undefined);
  const [defStatusFilter, setDefStatusFilter] = useState<string | undefined>(undefined);
  const [defModalVisible, setDefModalVisible] = useState(false);
  const [editingDef, setEditingDef] = useState<SLADefinition | null>(null);

  // Tracking state
  const [trackings, setTrackings] = useState<SLATracking[]>([]);
  const [trackingTotal, setTrackingTotal] = useState(0);
  const [trackingStatusFilter, setTrackingStatusFilter] = useState<string | undefined>(undefined);
  const [trackingEntityFilter, setTrackingEntityFilter] = useState<string | undefined>(undefined);
  const [trackingModalVisible, setTrackingModalVisible] = useState(false);

  // Breach events state
  const [breaches, setBreaches] = useState<SLABreachEvent[]>([]);
  const [breachTotal, setBreachTotal] = useState(0);
  const [breachTrackingFilter, setBreachTrackingFilter] = useState<string | undefined>(undefined);

  // Stats
  const [stats, setStats] = useState<SLAStats | null>(null);

  // --- Loaders ---

  const loadStats = useCallback(async () => {
    try {
      const data = await getSLAStats();
      setStats(data);
    } catch {
      // Stats load failure is non-critical
    }
  }, []);

  const loadDefinitions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 100, offset: 0 };
      if (defTypeFilter) params.type = defTypeFilter;
      if (defStatusFilter) params.status = defStatusFilter;
      const res = await getSLADefinitions(params);
      setDefinitions(Array.isArray(res.data) ? res.data : []);
      setDefTotal(res.total || 0);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载 SLA 定义失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [defTypeFilter, defStatusFilter]);

  const loadTrackings = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 100, offset: 0 };
      if (trackingStatusFilter) params.status = trackingStatusFilter;
      if (trackingEntityFilter) params.entityType = trackingEntityFilter;
      const res = await getSLATrackings(params);
      setTrackings(Array.isArray(res.data) ? res.data : []);
      setTrackingTotal(res.total || 0);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载追踪记录失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [trackingStatusFilter, trackingEntityFilter]);

  const loadBreaches = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 100, offset: 0 };
      if (breachTrackingFilter) params.trackingId = breachTrackingFilter;
      const res = await getSLABreaches(params);
      setBreaches(Array.isArray(res.data) ? res.data : []);
      setBreachTotal(res.total || 0);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载违约事件失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [breachTrackingFilter]);

  const loadData = useCallback(() => {
    loadStats();
    if (activeTab === 'definitions') loadDefinitions();
    else if (activeTab === 'tracking') loadTrackings();
    else if (activeTab === 'breaches') loadBreaches();
  }, [activeTab, loadStats, loadDefinitions, loadTrackings, loadBreaches]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeTab === 'definitions') loadDefinitions();
  }, [defTypeFilter, defStatusFilter, activeTab, loadDefinitions]);

  useEffect(() => {
    if (activeTab === 'tracking') loadTrackings();
  }, [trackingStatusFilter, trackingEntityFilter, activeTab, loadTrackings]);

  useEffect(() => {
    if (activeTab === 'breaches') loadBreaches();
  }, [breachTrackingFilter, activeTab, loadBreaches]);

  // --- Memo ---

  const definitionMap = useMemo(() => {
    const map: Record<string, SLADefinition> = {};
    definitions.forEach((d) => {
      map[d.id] = d;
    });
    return map;
  }, [definitions]);

  // --- Handlers: Definitions ---

  const handleSaveDefinition = async (values: SaveDefInput) => {
    try {
      const payload = {
        name: String(values.name),
        description: values.description ? String(values.description) : undefined,
        type: String(values.type),
        target_value: Number(values.target_value),
        target_unit: String(values.target_unit),
        business_hours_only: !!values.business_hours_only,
        priority: values.priority ? String(values.priority) : undefined,
        category: values.category ? String(values.category) : undefined,
      };
      if (editingDef) {
        await updateSLADefinition(editingDef.id, payload as Partial<SLADefinition>);
        message.success('SLA 定义已更新');
      } else {
        await createSLADefinition(payload);
        message.success('SLA 定义已创建');
      }
      setDefModalVisible(false);
      setEditingDef(null);
      loadDefinitions();
      loadStats();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '保存 SLA 定义失败';
      message.error(msg);
    }
  };

  const handleDeleteDefinition = async (id: string) => {
    try {
      await deleteSLADefinition(id);
      message.success('SLA 定义已删除');
      loadDefinitions();
      loadStats();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '删除 SLA 定义失败';
      message.error(msg);
    }
  };

  const handleOpenEditDefModal = (record: SLADefinition) => {
    setEditingDef(record);
    setDefModalVisible(true);
  };

  const handleOpenCreateDefModal = () => {
    setEditingDef(null);
    setDefModalVisible(true);
  };

  // --- Handlers: Tracking ---

  const handleCreateTracking = async (values: CreateTrackingInput) => {
    try {
      await createSLATracking({
        sla_definition_id: String(values.sla_definition_id),
        entity_type: String(values.entity_type),
        entity_id: String(values.entity_id),
        target_time: String(values.target_time),
        notes: values.notes ? String(values.notes) : undefined,
      });
      message.success('追踪记录已创建');
      setTrackingModalVisible(false);
      loadTrackings();
      loadStats();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '创建追踪记录失败';
      message.error(msg);
    }
  };

  const handleUpdateTrackingStatus = async (id: string, status: string) => {
    try {
      await updateSLATrackingStatus(id, status);
      message.success(`追踪状态已更新为 ${TRACKING_STATUS_LABEL_MAP[status] || status}`);
      loadTrackings();
      loadStats();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '更新追踪状态失败';
      message.error(msg);
    }
  };

  const handleMarkBreach = async (id: string) => {
    try {
      await markSLABreach(id);
      message.success('已标记违约');
      loadTrackings();
      loadStats();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '标记违约失败';
      message.error(msg);
    }
  };

  // --- Returns ---

  return {
    // State
    loading,
    activeTab, setActiveTab,
    definitions, defTotal,
    defTypeFilter, setDefTypeFilter,
    defStatusFilter, setDefStatusFilter,
    defModalVisible, setDefModalVisible,
    editingDef, setEditingDef,
    trackings, trackingTotal,
    trackingStatusFilter, setTrackingStatusFilter,
    trackingEntityFilter, setTrackingEntityFilter,
    trackingModalVisible, setTrackingModalVisible,
    breaches, breachTotal,
    breachTrackingFilter, setBreachTrackingFilter,
    stats,
    // Memo
    definitionMap,
    // Loaders
    loadData,
    loadDefinitions,
    loadTrackings,
    loadBreaches,
    loadStats,
    // Handlers
    handleSaveDefinition,
    handleDeleteDefinition,
    handleOpenEditDefModal,
    handleOpenCreateDefModal,
    handleCreateTracking,
    handleUpdateTrackingStatus,
    handleMarkBreach,
  };
};
