/**
 * ServiceCatalog state hook
 */
import { useEffect, useState } from 'react';
import { Form, message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import {
  listCatalogItems,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  getCatalogItem,
  getRequestTimeline,
  getSLABreaches,
  type ServiceCatalog,
  type TimelineEntry,
} from '@/api/service-catalog';

export const useServiceCatalogState = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceCatalog | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('catalog');
  const [selectedItem, setSelectedItem] = useState<ServiceCatalog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [form] = Form.useForm();

  const {
    data: items = [] as ServiceCatalog[],
    isLoading: loading,
    isError: itemsError,
    error: itemsErrorObj,
    refetch: refetchItems,
  } = useQuery<ServiceCatalog[]>({
    queryKey: ['service-catalog-items'],
    queryFn: async () => {
      const data = await listCatalogItems();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30_000,
  });

  const {
    data: slaBreaches = [] as Awaited<ReturnType<typeof getSLABreaches>>['breaches'],
    isLoading: slaLoading,
    isError: slaError,
    error: slaErrorObj,
    refetch: refetchSLA,
  } = useQuery({
    queryKey: ['service-catalog-sla'],
    queryFn: async () => {
      const data = await getSLABreaches();
      return data.breaches || [];
    },
    enabled: activeTab === 'sla',
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!itemsError) return;
    message.error(
      itemsErrorObj instanceof Error ? itemsErrorObj.message : '加载服务目录失败',
    );
  }, [itemsError, itemsErrorObj]);

  useEffect(() => {
    if (!slaError) return;
    message.error(
      slaErrorObj instanceof Error ? slaErrorObj.message : '加载 SLA 数据失败',
    );
  }, [slaError, slaErrorObj]);

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = async (record: ServiceCatalog) => {
    setEditingItem(record);
    try {
      const detail = await getCatalogItem(record.id);
      form.setFieldsValue({
        name: detail.name,
        value: detail.value,
        enabled: detail.enabled,
      });
    } catch {
      form.setFieldsValue({
        name: record.name,
        value: record.value,
        enabled: record.enabled,
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingItem) {
        await updateCatalogItem(editingItem.id, values);
        message.success('更新服务目录成功');
      } else {
        await createCatalogItem(values);
        message.success('创建服务目录成功');
      }
      setModalOpen(false);
      refetchItems();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCatalogItem(id);
      message.success('删除成功');
      refetchItems();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleViewDetail = async (record: ServiceCatalog) => {
    setSelectedItem(record);
    setDetailOpen(true);
    try {
      const entries = await getRequestTimeline(record.id);
      setTimeline(Array.isArray(entries) ? entries : []);
    } catch {
      setTimeline([]);
    }
  };

  return {
    items,
    loading,
    refetchItems,
    slaBreaches,
    slaLoading,
    refetchSLA,
    activeTab,
    setActiveTab,
    modalOpen,
    setModalOpen,
    editingItem,
    submitting,
    form,
    handleCreate,
    handleEdit,
    handleSubmit,
    handleDelete,
    handleViewDetail,
    detailOpen,
    setDetailOpen,
    selectedItem,
    timeline,
  };
};

export type ServiceCatalogState = ReturnType<typeof useServiceCatalogState>;
