/**
 * useGatewayRoutesState
 * API 网关路由页状态与逻辑（抽取自 index.tsx）
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { message, Form } from 'antd';
import type { FormInstance } from 'antd';
import type { GatewayRoute, GatewayRouteStats } from '@/api/gateway-routes';
import {
  getGatewayRoutes,
  createGatewayRoute,
  updateGatewayRoute,
  deleteGatewayRoute,
  toggleGatewayRoute,
  getGatewayRouteStats,
  getGatewayRoute,
} from '@/api/gateway-routes';

export interface UseGatewayRoutesStateReturn {
  // Data
  routes: GatewayRoute[];
  stats: GatewayRouteStats | null;
  loading: boolean;
  error: Error | null;
  setError: (e: Error | null) => void;
  actionLoading: string | null;
  // Filters
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  methodFilter: string | undefined;
  setMethodFilter: (v: string | undefined) => void;
  statusFilter: string | undefined;
  setStatusFilter: (v: string | undefined) => void;
  authFilter: string | undefined;
  setAuthFilter: (v: string | undefined) => void;
  serviceFilter: string | undefined;
  setServiceFilter: (v: string | undefined) => void;
  clearFilters: () => void;
  uniqueServices: string[];
  filteredRoutes: GatewayRoute[];
  // Modal
  modalVisible: boolean;
  setModalVisible: (v: boolean) => void;
  modalMode: 'create' | 'edit';
  selectedRoute: GatewayRoute | null;
  setSelectedRoute: (r: GatewayRoute | null) => void;
  form: FormInstance;
  // Drawer
  drawerVisible: boolean;
  setDrawerVisible: (v: boolean) => void;
  drawerLoading: boolean;
  // Handlers
  handleCreate: () => void;
  handleEdit: (record: GatewayRoute) => void;
  handleView: (record: GatewayRoute) => Promise<void>;
  handleModalSubmit: () => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handleToggle: (id: string, enabled: boolean) => Promise<void>;
  loadAll: () => void;
}

export const useGatewayRoutesState = (): UseGatewayRoutesStateReturn => {
  // ---- Data State ----
  const [routes, setRoutes] = useState<GatewayRoute[]>([]);
  const [stats, setStats] = useState<GatewayRouteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ---- Filter State ----
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [authFilter, setAuthFilter] = useState<string | undefined>(undefined);
  const [serviceFilter, setServiceFilter] = useState<string | undefined>(undefined);

  // ---- Modal State ----
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedRoute, setSelectedRoute] = useState<GatewayRoute | null>(null);

  // ---- Drawer State ----
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // ---- Form ----
  const [form] = Form.useForm();

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getGatewayRoutes();
      setRoutes(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载路由列表失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await getGatewayRouteStats();
      setStats(data);
    } catch {
      // Stats failure is non-critical
    }
  }, []);

  const loadAll = useCallback(() => {
    loadRoutes();
    loadStats();
  }, [loadRoutes, loadStats]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ============================================================================
  // CRUD Handlers
  // ============================================================================

  const handleCreate = () => {
    setModalMode('create');
    setSelectedRoute(null);
    form.resetFields();
    form.setFieldsValue({ enabled: true, authRequired: true, method: 'GET' });
    setModalVisible(true);
  };

  const handleEdit = (record: GatewayRoute) => {
    setModalMode('edit');
    setSelectedRoute(record);
    form.setFieldsValue({
      path: record.path,
      method: record.method,
      targetService: record.targetService,
      targetUrl: record.targetUrl,
      description: record.description,
      enabled: record.enabled,
      authRequired: record.authRequired,
      allowedRoles: record.allowedRoles,
      rateLimit: record.rateLimit,
      timeoutMs: record.timeoutMs,
    });
    setModalVisible(true);
  };

  const handleView = async (record: GatewayRoute) => {
    setDrawerLoading(true);
    setDrawerVisible(true);
    try {
      const detail = await getGatewayRoute(record.id);
      setSelectedRoute(detail);
    } catch (err: any) {
      message.error(`加载路由详情失败: ${err.message || '未知错误'}`);
      setSelectedRoute(record);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      setActionLoading(modalMode === 'create' ? 'create' : `edit-${selectedRoute?.id}`);

      if (modalMode === 'create') {
        await createGatewayRoute(values);
        message.success('路由创建成功');
      } else if (selectedRoute) {
        await updateGatewayRoute(selectedRoute.id, values);
        message.success('路由更新成功');
      }

      setModalVisible(false);
      loadAll();
    } catch (err: any) {
      if (err.errorFields) return; // form validation error
      message.error(`操作失败: ${err.message || '未知错误'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setActionLoading(`delete-${id}`);
      await deleteGatewayRoute(id);
      message.success('路由已删除');
      loadAll();
    } catch (err: any) {
      message.error(`删除失败: ${err.message || '未知错误'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      setActionLoading(`toggle-${id}`);
      await toggleGatewayRoute(id, enabled);
      message.success(enabled ? '路由已启用' : '路由已禁用');
      loadRoutes();
    } catch (err: any) {
      message.error(`操作失败: ${err.message || '未知错误'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================================================
  // Filtered Routes (search)
  // ============================================================================

  const filteredRoutes = useMemo(() => {
    let data = [...routes];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (r) =>
          r.path.toLowerCase().includes(q) ||
          r.targetService.toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q) ||
          r.method.toLowerCase().includes(q)
      );
    }

    if (methodFilter) {
      data = data.filter((r) => r.method === methodFilter);
    }

    if (statusFilter) {
      const isEnabled = statusFilter === 'enabled';
      data = data.filter((r) => r.enabled === isEnabled);
    }

    if (authFilter !== undefined) {
      const required = authFilter === 'true';
      data = data.filter((r) => r.authRequired === required);
    }

    if (serviceFilter) {
      data = data.filter((r) => r.targetService === serviceFilter);
    }

    return data;
  }, [routes, searchQuery, methodFilter, statusFilter, authFilter, serviceFilter]);

  // Extract unique services for filter dropdown
  const uniqueServices = useMemo(() => {
    const services = new Set(routes.map((r) => r.targetService));
    return Array.from(services).sort();
  }, [routes]);

  const clearFilters = () => {
    setSearchQuery('');
    setMethodFilter(undefined);
    setStatusFilter(undefined);
    setAuthFilter(undefined);
    setServiceFilter(undefined);
  };

  return {
    routes,
    stats,
    loading,
    error,
    setError,
    actionLoading,
    searchQuery,
    setSearchQuery,
    methodFilter,
    setMethodFilter,
    statusFilter,
    setStatusFilter,
    authFilter,
    setAuthFilter,
    serviceFilter,
    setServiceFilter,
    clearFilters,
    uniqueServices,
    filteredRoutes,
    modalVisible,
    setModalVisible,
    modalMode,
    selectedRoute,
    setSelectedRoute,
    form,
    drawerVisible,
    setDrawerVisible,
    drawerLoading,
    handleCreate,
    handleEdit,
    handleView,
    handleModalSubmit,
    handleDelete,
    handleToggle,
    loadAll,
  };
};
