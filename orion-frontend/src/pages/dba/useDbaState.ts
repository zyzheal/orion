/**
 * useDbaState - DBA 页面状态容器
 * 抽取自 DbaPage.tsx (P2-9 Phase 42)
 *
 * 管理: 初始 loading + 各 tab 的 orders/dataSources/auditRules 数据 + 加载器
 * 各 tab 内 Form + Modal 逻辑保留在对应 tab 组件（含 form owner）
 */
import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import {
  listOrders,
  listDataSources,
  listAuditRules,
  type SqlOrder,
  type DataSource,
  type AuditRule,
} from '@/api/dba';

export interface UseDbaStateReturn {
  loading: boolean;
  orders: SqlOrder[];
  orderLoading: boolean;
  dataSources: DataSource[];
  dsLoading: boolean;
  auditRules: AuditRule[];
  ruleLoading: boolean;
  loadOrders: () => Promise<void>;
  loadDataSources: () => Promise<void>;
  loadAuditRules: () => Promise<void>;
}

export const useDbaState = (): UseDbaStateReturn => {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<SqlOrder[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [dsLoading, setDsLoading] = useState(false);
  const [auditRules, setAuditRules] = useState<AuditRule[]>([]);
  const [ruleLoading, setRuleLoading] = useState(false);

  const loadOrders = useCallback(async () => {
    setOrderLoading(true);
    try {
      const res = await listOrders({ tenantId: 'default', page: 1, limit: 100 });
      const list = (res.data as { data?: { data?: SqlOrder[] } })?.data?.data ?? [];
      setOrders(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      setOrders([]);
      message.error(`加载SQL工单失败: ${(error as Error).message}`);
    } finally {
      setOrderLoading(false);
    }
  }, []);

  const loadDataSources = useCallback(async () => {
    setDsLoading(true);
    try {
      const res = await listDataSources('default');
      const list = (res.data as { data?: DataSource[] })?.data ?? [];
      setDataSources(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      setDataSources([]);
      message.error(`加载数据源失败: ${(error as Error).message}`);
    } finally {
      setDsLoading(false);
    }
  }, []);

  const loadAuditRules = useCallback(async () => {
    setRuleLoading(true);
    try {
      const res = await listAuditRules('default');
      const list = (res.data as { data?: DataSource[] })?.data ?? [];
      setAuditRules((Array.isArray(list) ? list : []) as unknown as AuditRule[]);
    } catch (error: unknown) {
      setAuditRules([]);
      message.error(`加载审计规则失败: ${(error as Error).message}`);
    } finally {
      setRuleLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadOrders(), loadDataSources(), loadAuditRules()]).finally(() =>
      setLoading(false)
    );
  }, [loadOrders, loadDataSources, loadAuditRules]);

  return {
    loading,
    orders,
    orderLoading,
    dataSources,
    dsLoading,
    auditRules,
    ruleLoading,
    loadOrders,
    loadDataSources,
    loadAuditRules,
  };
};
