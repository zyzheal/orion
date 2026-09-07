/**
 * ServiceCatalog state hook
 * 抽取自 index.tsx (P2-9 Phase 189)
 */
import { useState, useEffect } from 'react';
import { Form, Modal, message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import {
  listCatalogItems,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  getSLABreaches,
  type ServiceCatalog,
  type SLABreach,
} from '@/api/service-catalog';

export const useServiceCatalogState = () => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'sla'>('catalog');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ServiceCatalog | null>(null);
  const [form] = Form.useForm();

  const { data: itemsData, isLoading: itemsLoading, isError: itemsError, refetch: refetchItems } = useQuery<ServiceCatalog[]>({
    queryKey: ['service-catalog/items'],
    queryFn: async () => {
      const data = await listCatalogItems();
      return Array.isArray(data) ? data : [];
    },
    retry: 0,
    staleTime: 30_000,
  });

  const { data: breachesData, isLoading: breachesLoading, isError: breachesError, refetch: refetchBreaches } = useQuery<{ breaches: SLABreach[]; total: number }>({
    queryKey: ['service-catalog/breaches'],
    queryFn: async () => {
      const data = await getSLABreaches({ limit: 20 });
      return { breaches: data?.breaches || [], total: data?.total || 0 };
    },
    retry: 0,
    staleTime: 30_000,
  });

  const items = itemsData ?? [];
  const breaches = breachesData?.breaches ?? [];
  const totalBreaches = breachesData?.total ?? 0;
  const loading = itemsLoading || breachesLoading;

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  useEffect(() => {
    if (itemsError) {
      message.error('加载服务目录失败');
    }
  }, [itemsError]);

  useEffect(() => {
    if (breachesError) {
      message.error('加载 SLA 违约记录失败');
    }
  }, [breachesError]);

  const handleCreate = () => {
    setSelectedItem(null);
    form.resetFields();
    setModalOpen(true);
  };
  const handleEdit = (r: ServiceCatalog) => {
    setSelectedItem(r);
    form.setFieldsValue(r);
    setModalOpen(true);
  };
  const handleViewDetail = (r: ServiceCatalog) => {
    setSelectedItem(r);
    setDetailOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      if (selectedItem) {
        await updateCatalogItem(selectedItem.id, values);
        message.success('更新成功');
      } else {
        await createCatalogItem(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      form.resetFields();
      refetchItems();
    } catch (error: unknown) {
      if (!(error instanceof Error) && (error as { errorFields?: unknown[] })?.errorFields) {
        return;
      }
      message.error('保存服务目录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复',
      onOk: async () => {
        try {
          await deleteCatalogItem(id);
          message.success('删除成功');
          refetchItems();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const closeCreate = () => {
    setModalOpen(false);
    setSelectedItem(null);
    form.resetFields();
  };
  const closeDetail = () => setDetailOpen(false);

  const enabledCount = items.filter((i) => i.enabled).length;

  return {
    activeTab,
    modalOpen,
    submitting,
    detailOpen,
    selectedItem,
    form,
    items,
    breaches,
    totalBreaches,
    loading,
    enabledCount,
    setActiveTab,
    setModalOpen,
    refetchItems,
    refetchBreaches,
    handleCreate,
    handleEdit,
    handleViewDetail,
    handleSubmit,
    handleDelete,
    closeCreate,
    closeDetail,
  };
};
