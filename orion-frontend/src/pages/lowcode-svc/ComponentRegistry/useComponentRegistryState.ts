/**
 * ComponentRegistry state hook
 * 抽取自 index.tsx (P2-9 Phase 194)
 */
import { useState, useEffect } from 'react';
import { Form, message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import {
  listComponents,
  createComponent,
  getComponent,
  type ComponentRegistry,
} from '@/api/lowcode';

export const useComponentRegistryState = () => {
  const [category, setCategory] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<ComponentRegistry | null>(null);
  const [form] = Form.useForm();

  const {
    data: components = [] as ComponentRegistry[],
    isLoading: loading,
    isError,
    error: queryError,
    refetch: loadComponents,
  } = useQuery<ComponentRegistry[]>({
    queryKey: ['lowcode-components', category],
    queryFn: async () => {
      const data = await listComponents(category || undefined);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30_000,
  });

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (!isError) return;
    message.error(
      queryError instanceof Error ? `加载组件列表失败：${queryError.message}` : '加载组件列表失败'
    );
  }, [isError, queryError]);

  const handleCreate = async (values: any) => {
    setSubmitting(true);
    try {
      const propsSchema =
        typeof values.propsSchema === 'string'
          ? JSON.parse(values.propsSchema)
          : values.propsSchema || {};
      const defaultConfig =
        typeof values.defaultConfig === 'string'
          ? JSON.parse(values.defaultConfig)
          : values.defaultConfig || {};
      await createComponent({
        name: values.name,
        displayName: values.displayName,
        category: values.category || 'custom',
        version: values.version || '1.0.0',
        propsSchema,
        defaultConfig,
        icon: values.icon,
      });
      message.success('组件注册成功');
      setModalOpen(false);
      form.resetFields();
      loadComponents();
    } catch {
      message.error('注册失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetail = async (comp: ComponentRegistry) => {
    try {
      const data = await getComponent(comp.id);
      setSelectedComponent(data || comp);
      setDetailOpen(true);
    } catch {
      setSelectedComponent(comp);
      setDetailOpen(true);
    }
  };

  const openCreate = () => {
    form.resetFields();
    setModalOpen(true);
  };

  const closeCreate = () => setModalOpen(false);
  const closeDetail = () => setDetailOpen(false);

  return {
    category,
    modalOpen,
    submitting,
    detailOpen,
    selectedComponent,
    components,
    loading,
    form,
    loadComponents,
    handleCreate,
    handleViewDetail,
    openCreate,
    closeCreate,
    closeDetail,
    setCategory,
    setModalOpen,
    setDetailOpen,
    setSelectedComponent,
  };
};
