/**
 * service-portal useServicePortalState
 * 抽取自 index.tsx (P2-9 Phase 182)
 */
import { useState, useEffect, useMemo } from 'react';
import { Form, message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import {
  getServices,
  registerService,
  deregisterService,
  getServiceHealth,
  type ServiceInfo,
  type RegisterServicePayload,
  type ServiceHealth,
} from '@/api/service-registry';

export const useServicePortalState = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceInfo | null>(null);
  const [healthData, setHealthData] = useState<ServiceHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [form] = Form.useForm();

  const { data: rawData, isLoading: loading, isError, error, refetch } = useQuery<ServiceInfo[]>(
    {
      queryKey: ['service-registry/services'],
      queryFn: async () => {
        const data = await getServices();
        return Array.isArray(data) ? data : [];
      },
      retry: 0,
      staleTime: 30_000,
    }
  );

  const services = rawData ?? [];

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (isError) {
      message.error(error instanceof Error ? error.message : '加载服务列表失败');
    }
  }, [isError, error]);

  const handleRegister = () => {
    form.resetFields();
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await registerService(values as RegisterServicePayload);
      message.success('服务注册成功');
      setModalOpen(false);
      refetch();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeregister = async (id: string) => {
    try {
      await deregisterService(id);
      message.success('服务已注销');
      refetch();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '注销失败');
    }
  };

  const handleViewDetail = async (record: ServiceInfo) => {
    setSelectedService(record);
    setDetailOpen(true);
    setHealthLoading(true);
    setHealthData(null);
    try {
      const health = await getServiceHealth(record.id);
      setHealthData(health);
    } catch {
      message.error('加载服务健康数据失败');
      setHealthData(null);
    } finally {
      setHealthLoading(false);
    }
  };

  const handleRefresh = () => refetch();

  const healthStats = useMemo(() => {
    const total = services.length;
    const healthy = services.filter((s) => s.health === 'healthy').length;
    const unhealthy = services.filter((s) => s.health === 'unhealthy').length;
    const degraded = services.filter((s) => s.health === 'degraded').length;
    return { total, healthy, unhealthy, degraded };
  }, [services]);

  return {
    // state
    modalOpen,
    setModalOpen,
    submitting,
    detailOpen,
    setDetailOpen,
    selectedService,
    healthData,
    healthLoading,
    form,
    // query
    loading,
    services,
    refetch,
    // derived
    healthStats,
    // handlers
    handleRegister,
    handleSubmit,
    handleDeregister,
    handleViewDetail,
    handleRefresh,
  };
};
