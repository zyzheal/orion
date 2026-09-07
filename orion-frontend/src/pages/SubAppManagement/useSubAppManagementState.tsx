/**
 * useSubAppManagementState - SubAppManagement 状态 hook
 * 抽取自 index.tsx (P2-9 Phase 127)
 */
import { useEffect, useState } from 'react';
import { Form, message } from 'antd';
import { useSubAppStore, SubAppConfig, SubAppConfigHistory } from '@/stores/subappStore';

export const useSubAppManagementState = () => {
  const {
    apps,
    loading,
    error,
    fetchApps,
    createApp,
    updateApp,
    deleteApp,
    toggleStatus,
    getHistory,
    clearError,
  } = useSubAppStore();

  const [form] = Form.useForm();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<SubAppConfig | null>(null);
  const [historyData, setHistoryData] = useState<SubAppConfigHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  useEffect(() => {
    if (error) {
      message.error(error);
      clearError();
    }
  }, [error, clearError]);

  const handleCreate = () => {
    setSelectedApp(null);
    form.resetFields();
    setIsEditing(false);
    setDrawerOpen(true);
  };

  const handleEdit = (app: SubAppConfig) => {
    setSelectedApp(app);
    form.setFieldsValue({
      ...app,
      routes: app.routes.join(', '),
    });
    setIsEditing(true);
    setDrawerOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();

      const routes = values.routes
        ? values.routes
            .split(',')
            .map((r: string) => r.trim())
            .filter((r: string) => r.startsWith('/'))
        : [];

      const appData = {
        ...values,
        routes,
      };

      if (isEditing && selectedApp) {
        await updateApp(selectedApp.key, appData);
        message.success('子应用配置已更新');
      } else {
        await createApp(appData);
        message.success('子应用创建成功');
      }

      setDrawerOpen(false);
      form.resetFields();
    } catch (err: unknown) {
      if ((err as { errorFields?: unknown[] })?.errorFields) {
        return;
      }
      const e = err as { message?: string };
      message.error(e.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await deleteApp(key);
      message.success('子应用已删除');
    } catch (err: unknown) {
      const e = err as { message?: string };
      message.error(e.message || '删除失败');
    }
  };

  const handleToggleStatus = async (key: string) => {
    try {
      const updated = await toggleStatus(key);
      message.success(`子应用已${updated.status === 'enabled' ? '启用' : '禁用'}`);
    } catch (err: unknown) {
      const e = err as { message?: string };
      message.error(e.message || '操作失败');
    }
  };

  const handleShowHistory = async (app: SubAppConfig) => {
    setSelectedApp(app);
    setHistoryLoading(true);
    setHistoryDrawerOpen(true);

    try {
      const history = await getHistory(app.key);
      setHistoryData(history);
    } catch {
      message.error('获取历史记录失败');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCopyLink = (path: string) => {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard
      .writeText(url)
      .then(() => message.success(`链接已复制: ${url}`))
      .catch(() => message.error('复制失败，请手动复制'));
  };

  return {
    apps,
    loading,
    form,
    drawerOpen,
    historyDrawerOpen,
    selectedApp,
    historyData,
    historyLoading,
    isEditing,
    submitting,
    setDrawerOpen,
    setHistoryDrawerOpen,
    setSelectedApp,
    setIsEditing,
    handleCreate,
    handleEdit,
    handleSubmit,
    handleDelete,
    handleToggleStatus,
    handleShowHistory,
    handleCopyLink,
  };
};

export type SubAppManagementState = ReturnType<typeof useSubAppManagementState>;
