/**
 * useEnvironmentState
 * 环境管理页状态与逻辑（抽取自 EnvironmentPage.tsx）
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { message, Form } from 'antd';
import type { FormInstance } from 'antd';
import type { FilterDefinition } from '@/components/SearchFilterBar';
import {
  getEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  updateEnvironmentStatus,
  lockEnvironment,
  unlockEnvironment,
  type Environment,
  type CreateEnvironmentInput,
  type UpdateEnvironmentInput,
  type EnvironmentStatus,
} from '@/api/environments';
import { envTemplates, type EnvTemplate } from './constants';

export interface UseEnvironmentStateReturn {
  loading: boolean;
  environments: Environment[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filters: Record<string, string | string[] | undefined>;
  setFilters: (v: Record<string, string | string[] | undefined>) => void;
  createModalVisible: boolean;
  setCreateModalVisible: (v: boolean) => void;
  editModalVisible: boolean;
  setEditModalVisible: (v: boolean) => void;
  editingEnv: Environment | null;
  setEditingEnv: (e: Environment | null) => void;
  detailDrawerVisible: boolean;
  setDetailDrawerVisible: (v: boolean) => void;
  selectedEnv: Environment | null;
  setSelectedEnv: (e: Environment | null) => void;
  createForm: FormInstance;
  editForm: FormInstance;
  submitting: boolean;
  loadData: () => Promise<void>;
  filteredData: Environment[];
  stats: { total: number; active: number; hibernated: number; maintenance: number };
  handleCreate: () => Promise<void>;
  handleEdit: () => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handleStatusChange: (id: string, status: EnvironmentStatus) => Promise<void>;
  handleLock: (id: string) => Promise<void>;
  handleUnlock: (id: string) => Promise<void>;
  openEdit: (env: Environment) => void;
  openDetail: (env: Environment) => void;
  applyTemplate: (template: EnvTemplate) => void;
  filterDefs: FilterDefinition[];
  envTemplates: EnvTemplate[];
}

export const useEnvironmentState = (): UseEnvironmentStateReturn => {
  const [loading, setLoading] = useState(false);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedEnv, setSelectedEnv] = useState<Environment | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEnvironments();
      setEnvironments(Array.isArray(res.data) ? res.data : []);
    } catch (error: unknown) {
      setEnvironments([]);
      message.error(`加载环境列表失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredData = useMemo(() => {
    return environments.filter((env) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !env.name.toLowerCase().includes(q) &&
          !(env.cluster && env.cluster.toLowerCase().includes(q)) &&
          !(env.namespace && env.namespace.toLowerCase().includes(q))
        )
          return false;
      }
      if (filters.type && filters.type !== 'all' && env.type !== filters.type) return false;
      if (filters.status && filters.status !== 'all' && env.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, environments]);

  const stats = useMemo(() => {
    const total = environments.length;
    const active = environments.filter((e) => e.status === 'active').length;
    const hibernated = environments.filter((e) => e.status === 'inactive').length;
    const maintenance = environments.filter((e) => e.status === 'maintenance').length;
    return { total, active, hibernated, maintenance };
  }, [environments]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload: CreateEnvironmentInput = {
        projectId: values.projectId,
        name: values.name,
        type: values.type,
        cluster: values.cluster || undefined,
        namespace: values.namespace || undefined,
        config: values.config
          ? (() => {
              try {
                return JSON.parse(values.config);
              } catch {
                return undefined;
              }
            })()
          : undefined,
      };
      await createEnvironment(payload);
      message.success('环境创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingEnv) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      const payload: UpdateEnvironmentInput = {
        name: values.name || undefined,
        type: values.type || undefined,
        cluster: values.cluster || undefined,
        namespace: values.namespace || undefined,
        config: values.config
          ? (() => {
              try {
                return JSON.parse(values.config);
              } catch {
                return undefined;
              }
            })()
          : undefined,
      };
      await updateEnvironment(editingEnv.id, payload);
      message.success('环境更新成功');
      setEditModalVisible(false);
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`更新失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEnvironment(id);
      message.success('环境已删除');
      loadData();
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  const handleStatusChange = async (id: string, status: EnvironmentStatus) => {
    try {
      await updateEnvironmentStatus(id, { status });
      message.success('状态更新成功');
      loadData();
    } catch (error: unknown) {
      message.error(`状态更新失败: ${(error as Error).message}`);
    }
  };

  const handleLock = async (id: string) => {
    try {
      await lockEnvironment(id, { reason: '手动锁定', lockedBy: 'current-user' });
      message.success('环境已锁定');
      loadData();
    } catch (error: unknown) {
      message.error(`锁定失败: ${(error as Error).message}`);
    }
  };

  const handleUnlock = async (id: string) => {
    try {
      await unlockEnvironment(id);
      message.success('环境已解锁');
      loadData();
    } catch (error: unknown) {
      message.error(`解锁失败: ${(error as Error).message}`);
    }
  };

  const openEdit = (env: Environment) => {
    setEditingEnv(env);
    editForm.setFieldsValue({
      name: env.name,
      type: env.type,
      cluster: env.cluster,
      namespace: env.namespace,
      config: env.config ? JSON.stringify(env.config, null, 2) : undefined,
    });
    setEditModalVisible(true);
  };

  const openDetail = (env: Environment) => {
    setSelectedEnv(env);
    setDetailDrawerVisible(true);
  };

  const applyTemplate = (template: EnvTemplate) => {
    createForm.setFieldsValue({
      config: JSON.stringify(template.config, null, 2),
    });
    message.success(`已应用模板: ${template.name}`);
  };

  const filterDefs = useMemo<FilterDefinition[]>(
    () => [
      {
        key: 'type',
        label: '环境类型',
        options: [
          { label: '全部', value: 'all' },
          { label: '开发', value: 'dev' },
          { label: '测试', value: 'testing' },
          { label: '预发', value: 'staging' },
          { label: '预生产', value: 'pre-prod' },
          { label: '生产', value: 'prod' },
        ],
      },
      {
        key: 'status',
        label: '状态',
        options: [
          { label: '全部', value: 'all' },
          { label: '运行中', value: 'active' },
          { label: '休眠', value: 'inactive' },
          { label: '维护中', value: 'maintenance' },
          { label: '已废弃', value: 'deprecated' },
        ],
      },
    ],
    []
  );

  return {
    loading,
    environments,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    createModalVisible,
    setCreateModalVisible,
    editModalVisible,
    setEditModalVisible,
    editingEnv,
    setEditingEnv,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedEnv,
    setSelectedEnv,
    createForm,
    editForm,
    submitting,
    loadData,
    filteredData,
    stats,
    handleCreate,
    handleEdit,
    handleDelete,
    handleStatusChange,
    handleLock,
    handleUnlock,
    openEdit,
    openDetail,
    applyTemplate,
    filterDefs,
    envTemplates,
  };
};
