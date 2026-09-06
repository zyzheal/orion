/**
 * useVisorState.ts - Visor 状态管理 Hook
 * 抽取自 VisorPage.tsx (P2-9 Phase 94)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Form, message } from 'antd';
import {
  listHosts,
  addHost,
  removeHost,
  getHostStatus,
  executeScript,
  getScriptResult,
  listResources,
  getResourcesByType,
  type Host,
  type AddHostInput,
  type ScriptExecution,
  type ResourceUsage,
} from '@/api/visor';

export interface HostFormValues {
  hostname: string;
  ip: string;
  os?: string;
}

export interface ScriptFormValues {
  hostId: string;
  script: string;
}

export function useVisorState() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('hosts');

  // Hosts state
  const [hosts, setHosts] = useState<Host[]>([]);
  const [hostLoading, setHostLoading] = useState(false);
  const [hostModalVisible, setHostModalVisible] = useState(false);
  const [hostForm] = Form.useForm<HostFormValues>();
  const [hostSubmitting, setHostSubmitting] = useState(false);

  // Scripts state
  const [scripts, setScripts] = useState<ScriptExecution[]>([]);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptForm] = Form.useForm<ScriptFormValues>();
  const [scriptExecuting, setScriptExecuting] = useState(false);
  const [scriptResult, setScriptResult] = useState<ScriptExecution | null>(null);
  const [viewingResult, setViewingResult] = useState(false);

  // Resources state
  const [resources, setResources] = useState<ResourceUsage[]>([]);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('all');

  // ---- Data Loading ----

  const loadHosts = useCallback(async () => {
    setHostLoading(true);
    try {
      const res = await listHosts();
      const list = (res.data as { hosts?: Host[] })?.hosts;
      setHosts(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      setHosts([]);
      message.error(`加载主机列表失败: ${(error as Error).message}`);
    } finally {
      setHostLoading(false);
    }
  }, []);

  const loadScripts = useCallback(async () => {
    setScriptLoading(true);
    try {
      // Reuse hosts list for script history display
      const res = await listHosts();
      const list = (res.data as { scripts?: ScriptExecution[] })?.scripts;
      setScripts(Array.isArray(list) ? list : []);
    } catch {
      setScripts([]);
    } finally {
      setScriptLoading(false);
    }
  }, []);

  const loadResources = useCallback(async () => {
    setResourceLoading(true);
    try {
      const res = await listResources();
      const list = (res.data as { resources?: ResourceUsage[] })?.resources;
      setResources(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      setResources([]);
      message.error(`加载资源数据失败: ${(error as Error).message}`);
    } finally {
      setResourceLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadHosts(), loadScripts(), loadResources()]).finally(() => setLoading(false));
  }, [loadHosts, loadScripts, loadResources]);

  // ---- Host Handlers ----

  const handleAddHost = useCallback(async () => {
    try {
      const values = await hostForm.validateFields();
      setHostSubmitting(true);
      const payload: AddHostInput = {
        hostname: values.hostname,
        ip: values.ip,
        os: values.os || 'linux',
      };
      await addHost(payload);
      message.success('主机添加成功');
      setHostModalVisible(false);
      hostForm.resetFields();
      loadHosts();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`添加失败: ${(error as Error).message}`);
      }
    } finally {
      setHostSubmitting(false);
    }
  }, [hostForm, loadHosts]);

  const handleRemoveHost = useCallback(
    async (id: string) => {
      try {
        await removeHost(id);
        message.success('主机已移除');
        loadHosts();
      } catch (error: unknown) {
        message.error(`移除失败: ${(error as Error).message}`);
      }
    },
    [loadHosts]
  );

  const handleViewHostStatus = useCallback(async (id: string) => {
    try {
      const res = await getHostStatus(id);
      const data = res.data as { status?: string };
      message.info(`主机状态: ${data?.status || 'unknown'}`);
    } catch (error: unknown) {
      message.error(`获取状态失败: ${(error as Error).message}`);
    }
  }, []);

  // ---- Script Handlers ----

  const handleExecuteScript = useCallback(async () => {
    try {
      const values = await scriptForm.validateFields();
      setScriptExecuting(true);
      await executeScript({
        hostId: values.hostId,
        script: values.script,
      });
      message.success('脚本已提交执行');
      scriptForm.resetFields();
      loadScripts();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`执行失败: ${(error as Error).message}`);
      }
    } finally {
      setScriptExecuting(false);
    }
  }, [scriptForm, loadScripts]);

  const handleViewScriptResult = useCallback(async (id: string) => {
    try {
      const res = await getScriptResult(id);
      const data = res.data as ScriptExecution;
      setScriptResult(data);
      setViewingResult(true);
    } catch (error: unknown) {
      message.error(`获取结果失败: ${(error as Error).message}`);
    }
  }, []);

  const closeScriptResult = useCallback(() => {
    setViewingResult(false);
    setScriptResult(null);
  }, []);

  // ---- Resource Handlers ----

  const handleFilterByType = useCallback(
    async (type: string) => {
      setResourceTypeFilter(type);
      if (type === 'all') {
        await loadResources();
      } else {
        try {
          const res = await getResourcesByType(type);
          const list = (res.data as { resources?: ResourceUsage[] })?.resources;
          setResources(Array.isArray(list) ? list : []);
        } catch (error: unknown) {
          setResources([]);
          message.error(`加载资源失败: ${(error as Error).message}`);
        }
      }
    },
    [loadResources]
  );

  // ---- Filtered Data ----

  const filteredResources = useMemo(
    () =>
      resourceTypeFilter === 'all'
        ? resources
        : resources.filter((r) => r.type === resourceTypeFilter),
    [resourceTypeFilter, resources]
  );

  // ---- Stats ----

  const hostStats = useMemo(
    () => ({
      total: hosts.length,
      online: hosts.filter((h) => h.status === 'online').length,
      offline: hosts.filter((h) => h.status === 'offline').length,
      error: hosts.filter((h) => h.status === 'error').length,
    }),
    [hosts]
  );

  return {
    // State
    loading,
    activeTab,
    setActiveTab,
    hosts,
    hostLoading,
    hostModalVisible,
    setHostModalVisible,
    hostForm,
    hostSubmitting,
    scripts,
    scriptLoading,
    scriptForm,
    scriptExecuting,
    scriptResult,
    viewingResult,
    resources,
    resourceLoading,
    resourceTypeFilter,
    filteredResources,
    hostStats,
    // Actions
    loadHosts,
    loadScripts,
    loadResources,
    handleAddHost,
    handleRemoveHost,
    handleViewHostStatus,
    handleExecuteScript,
    handleViewScriptResult,
    closeScriptResult,
    handleFilterByType,
  };
}
