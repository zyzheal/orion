/**
 * useConfigCenterState
 * 分布式配置中心：命名空间/分组/配置项/快照/发布/审计 全部状态 + 加载器 + 处理器
 */
import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import {
  listNamespaces,
  createNamespace,
  listGroups,
  createGroup,
  listItems,
  createItem,
  updateItem,
  deleteItem,
  getItemHistory,
  publishSnapshot,
  listSnapshots,
  publishRelease,
  rollbackRelease,
  listReleases,
  listAudit,
  type ConfigNamespace,
  type ConfigGroup,
  type ConfigItem,
  type ConfigSnapshot,
  type ConfigRelease,
  type ConfigAudit,
} from '@/api/distributedConfig';

export const useConfigCenterState = () => {
  const [activeTab, setActiveTab] = useState('items');
  const [loading, setLoading] = useState(false);

  // Namespace / Group state
  const [namespaces, setNamespaces] = useState<ConfigNamespace[]>([]);
  const [groups, setGroups] = useState<ConfigGroup[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>();
  const [selectedGroup, setSelectedGroup] = useState<string>();

  // Items
  const [items, setItems] = useState<ConfigItem[]>([]);

  // Snapshot / Release
  const [snapshots, setSnapshots] = useState<ConfigSnapshot[]>([]);
  const [releases, setReleases] = useState<ConfigRelease[]>([]);
  const [selectedEnv, setSelectedEnv] = useState('default');

  // Audit
  const [audits, setAudits] = useState<ConfigAudit[]>([]);

  // History modal
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const operator = localStorage.getItem('username') || 'system';

  // ==================== Loaders ====================

  const loadNamespaces = useCallback(async () => {
    try {
      const res = await listNamespaces();
      setNamespaces(Array.isArray(res) ? res : []);
    } catch {
      setNamespaces([]);
    }
  }, []);

  const loadGroups = useCallback(async (nsId?: string) => {
    try {
      const res = await listGroups(nsId);
      setGroups(Array.isArray(res) ? res : []);
    } catch {
      setGroups([]);
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listItems(selectedGroup || undefined);
      setItems(Array.isArray(res) ? res : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [selectedGroup]);

  const loadSnapshots = useCallback(async () => {
    try {
      const res = await listSnapshots(selectedGroup || undefined, selectedEnv || undefined);
      setSnapshots(Array.isArray(res) ? res : []);
    } catch {
      setSnapshots([]);
    }
  }, [selectedGroup, selectedEnv]);

  const loadReleases = useCallback(async () => {
    try {
      const res = await listReleases(selectedEnv || undefined);
      setReleases(Array.isArray(res) ? res : []);
    } catch {
      setReleases([]);
    }
  }, [selectedEnv]);

  const loadAudit = useCallback(async () => {
    try {
      const res = await listAudit(100);
      setAudits(Array.isArray(res) ? res : []);
    } catch {
      setAudits([]);
    }
  }, []);

  useEffect(() => {
    loadNamespaces();
  }, [loadNamespaces]);

  useEffect(() => {
    if (selectedNamespace) loadGroups(selectedNamespace);
    else loadGroups();
  }, [selectedNamespace, loadGroups]);

  useEffect(() => {
    loadItems();
  }, [selectedGroup, loadItems]);

  useEffect(() => {
    if (activeTab === 'snapshots') loadSnapshots();
  }, [activeTab, loadSnapshots]);

  useEffect(() => {
    if (activeTab === 'releases') loadReleases();
  }, [activeTab, loadReleases]);

  useEffect(() => {
    if (activeTab === 'audit') loadAudit();
  }, [activeTab, loadAudit]);

  // ==================== Handlers ====================

  const handleCreateNamespace = async (values: { name: string; description?: string }) => {
    try {
      const ns = (await createNamespace(values)) as ConfigNamespace;
      setNamespaces((prev) => [...prev, ns]);
      message.success('命名空间创建成功');
    } catch {
      message.error('创建失败');
    }
  };

  const handleCreateGroup = async (values: {
    namespaceId: string;
    name: string;
    description?: string;
  }) => {
    try {
      const g = (await createGroup(values)) as ConfigGroup;
      setGroups((prev) => [...prev, g]);
      setSelectedGroup(g.id);
      message.success('配置分组创建成功');
      loadGroups(selectedNamespace);
    } catch {
      message.error('创建失败');
    }
  };

  const handleCreateItem = async (values: any) => {
    try {
      if (!selectedGroup) {
        message.warning('请先选择配置分组');
        return;
      }
      const item = (await createItem({
        groupId: selectedGroup,
        namespaceId:
          namespaces.find((n) => groups.find((g) => g.id === selectedGroup)?.namespaceId === n.id)
            ?.id || '',
        keyName: values.keyName,
        value: String(values.value),
        valueType: values.valueType,
        encrypted: values.encrypted || false,
        description: values.description,
      })) as ConfigItem;
      setItems((prev) => [...prev, item]);
      message.success('配置项创建成功');
      loadItems();
    } catch {
      message.error('创建失败');
    }
  };

  const handleUpdateItem = async (id: string, values: any) => {
    try {
      const data: any = {};
      if (values.value !== undefined) data.value = String(values.value);
      if (values.valueType !== undefined) data.valueType = values.valueType;
      if (values.encrypted !== undefined) data.encrypted = values.encrypted;
      if (values.description !== undefined) data.description = values.description;
      await updateItem(id, data);
      message.success('配置项更新成功');
      loadItems();
    } catch {
      message.error('更新失败');
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteItem(id);
      message.success('已删除');
      loadItems();
    } catch {
      message.error('删除失败');
    }
  };

  const handleViewHistory = async (item: ConfigItem) => {
    try {
      const res = await getItemHistory(item.id);
      const data = Array.isArray(res) ? res : [];
      setHistoryData(data);
      setHistoryOpen(true);
    } catch {
      message.error('获取历史失败');
    }
  };

  const handlePublishSnapshot = async () => {
    if (!selectedGroup) {
      message.warning('请先选择分组');
      return;
    }
    setLoading(true);
    try {
      const snap = (await publishSnapshot(selectedGroup, {
        environment: selectedEnv,
        operator,
      })) as ConfigSnapshot;
      setSnapshots((prev) => [snap, ...prev]);
      message.success('快照发布成功');
      loadSnapshots();
    } catch {
      message.error('发布失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishRelease = async (values: {
    snapshotId: string;
    environment: string;
    releaseNote?: string;
  }) => {
    setLoading(true);
    try {
      const rel = (await publishRelease({
        snapshotId: values.snapshotId,
        environment: values.environment,
        operator,
        releaseNote: values.releaseNote,
      })) as ConfigRelease;
      setReleases((prev) => [rel, ...prev]);
      message.success('发布成功');
      loadReleases();
    } catch {
      message.error('发布失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (values: { snapshotId: string; reason?: string }) => {
    setLoading(true);
    try {
      const rel = (await rollbackRelease({
        snapshotId: values.snapshotId,
        operator,
        reason: values.reason,
      })) as ConfigRelease;
      setReleases((prev) => [rel, ...prev]);
      message.success('回滚成功');
      loadReleases();
    } catch {
      message.error('回滚失败');
    } finally {
      setLoading(false);
    }
  };

  return {
    // state
    activeTab,
    setActiveTab,
    loading,
    namespaces,
    groups,
    selectedNamespace,
    setSelectedNamespace,
    selectedGroup,
    setSelectedGroup,
    items,
    snapshots,
    releases,
    selectedEnv,
    setSelectedEnv,
    audits,
    historyData,
    historyOpen,
    setHistoryOpen,
    // loaders
    loadNamespaces,
    loadGroups,
    loadItems,
    loadSnapshots,
    loadReleases,
    loadAudit,
    // handlers
    handleCreateNamespace,
    handleCreateGroup,
    handleCreateItem,
    handleUpdateItem,
    handleDeleteItem,
    handleViewHistory,
    handlePublishSnapshot,
    handlePublishRelease,
    handleRollback,
  };
};
