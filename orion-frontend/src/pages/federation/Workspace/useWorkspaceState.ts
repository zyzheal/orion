/**
 * useWorkspaceState.ts - Workspace 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 221)
 */
import { useState, useEffect, useCallback } from 'react';
import { Form, message } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@/providers/QueryProvider';
import { apiCall, type Workspace, type WorkspaceUpsertPayload } from './workspaceApi';

export type FormValues = {
  name: string;
  description: string;
  clusterId: string;
  cpuQuota: number;
  memoryQuota: number;
  storageQuota: number;
};

export function useWorkspaceState() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Workspace | null>(null);
  const [form] = Form.useForm<FormValues>();

  const {
    data = { workspaces: [] as Workspace[] },
    isLoading: loading,
    refetch: loadWorkspaces,
    error: queryError,
  } = useQuery({
    queryKey: ['workspaces', 'all'],
    queryFn: async () => {
      const ws = await apiCall<Workspace[]>('/');
      return { workspaces: Array.isArray(ws) ? ws : [] };
    },
  });

  useEffect(() => {
    if (queryError) message.warning('工作空间数据加载失败');
  }, [queryError]);

  const upsertMutation = useMutation({
    mutationFn: (values: WorkspaceUpsertPayload) =>
      values.id
        ? apiCall<Workspace>(`/${values.id}`, {
            method: 'PUT',
            body: JSON.stringify(values),
          })
        : apiCall<Workspace>('/', { method: 'POST', body: JSON.stringify(values) }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['workspaces'] });
      const prev = queryClient.getQueryData<{ workspaces: Workspace[] }>(['workspaces', 'all']);
      const optimistic: Workspace = {
        id: variables.id || `new-${Date.now()}`,
        name: variables.name,
        description: variables.description || '',
        clusterId: variables.clusterId,
        status: 'active',
        cpuQuota: variables.cpuQuota || 4,
        cpuUsed: 0,
        memoryQuota: variables.memoryQuota || 8,
        memoryUsed: 0,
        storageQuota: variables.storageQuota || 100,
        storageUsed: 0,
        memberCount: 0,
        createdAt: new Date().toISOString(),
      };
      if (prev) {
        queryClient.setQueryData(['workspaces', 'all'], {
          workspaces: optimistic.id.startsWith('new-')
            ? [...prev.workspaces, optimistic]
            : prev.workspaces.map((w) => (w.id === optimistic.id ? optimistic : w)),
        });
      }
      return { prev };
    },
    onSuccess: (_data, variables) => {
      message.success(variables.id ? '工作空间已更新' : '工作空间已创建');
    },
    onError: (_err, _variables, ctx) => {
      message.warning('操作失败');
      if (ctx?.prev) queryClient.setQueryData(['workspaces', 'all'], ctx.prev);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiCall<void>(`/${id}`, { method: 'DELETE' }),
    onSuccess: () => message.success('工作空间已删除'),
    onError: () => message.warning('删除失败'),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
  });

  const workspaces = data.workspaces;
  const activeCount = workspaces.filter((w) => w.status === 'active').length;
  const totalCpu = workspaces.reduce((s, w) => s + w.cpuQuota, 0);
  const totalMemory = workspaces.reduce((s, w) => s + w.memoryQuota, 0);

  const handleCreate = useCallback(() => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  }, [form]);

  const handleEdit = useCallback(
    (record: Workspace) => {
      setEditing(record);
      form.setFieldsValue(record);
      setModalOpen(true);
    },
    [form]
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation]
  );

  const handleSave = useCallback(async () => {
    const values = await form.validateFields();
    upsertMutation.mutate({ ...(editing || {}), ...values }, {
      onSettled: () => {
        setModalOpen(false);
        form.resetFields();
        setEditing(null);
      },
    });
  }, [form, editing, upsertMutation]);

  const handleCancel = useCallback(() => {
    setModalOpen(false);
    form.resetFields();
    setEditing(null);
  }, [form]);

  const handleRefresh = useCallback(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  return {
    // State
    modalOpen,
    setModalOpen,
    editing,
    form,
    loading,
    workspaces,
    activeCount,
    totalCpu,
    totalMemory,
    // Mutations
    upsertSaving: upsertMutation.isPending,
    // Handlers
    handleCreate,
    handleEdit,
    handleDelete,
    handleSave,
    handleCancel,
    handleRefresh,
  };
}
