/**
 * ServiceRegistry state hook
 * 抽取自 index.tsx (P2-9 Phase 142)
 */
import { useEffect, useState } from 'react';
import { Form, message } from 'antd';
import {
  getServices,
  registerService,
  deregisterService,
  type ServiceInfo,
  type GetServicesParams,
} from '@/api/service-registry';
import type { RegisterFormValues } from './types';

export const useServiceRegistryState = () => {
  // Data state
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [healthFilter, setHealthFilter] = useState<string | undefined>(undefined);

  // Register modal state
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerForm] = Form.useForm();

  // Deregister confirmation state
  const [deregisteringId, setDeregisteringId] = useState<string | null>(null);
  const [deregisterLoading, setDeregisterLoading] = useState(false);

  // Data Loading
  const loadServices = async () => {
    setLoading(true);
    try {
      const params: GetServicesParams = {};
      if (searchText.trim()) {
        params.serviceName = searchText.trim();
      }
      if (healthFilter) {
        params.health = healthFilter;
      }
      const data = await getServices(params);
      setServices(data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载服务列表失败：${error.message}`);
      } else {
        message.error('加载服务列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, [searchText, healthFilter]);

  // Event Handlers
  const handleRefresh = () => {
    loadServices();
    message.info('正在刷新服务列表...');
  };

  const handleRegister = async (values: RegisterFormValues) => {
    setRegisterLoading(true);
    try {
      await registerService({
        serviceId: values.serviceId,
        serviceName: values.serviceName,
        serviceUrl: values.serviceUrl,
        protocol: values.protocol as 'http' | 'grpc' | 'tcp' | 'custom',
        version: values.version || undefined,
      });
      message.success(`服务 "${values.serviceName}" 注册成功`);
      setRegisterModalVisible(false);
      registerForm.resetFields();
      loadServices();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`注册服务失败：${error.message}`);
      } else {
        message.error('注册服务失败，请稍后重试');
      }
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleDeregister = async (record: ServiceInfo) => {
    setDeregisteringId(record.id);
    setDeregisterLoading(true);
    try {
      await deregisterService(record.id);
      message.success(`服务 "${record.name}" 已取消注册`);
      loadServices();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`取消注册失败：${error.message}`);
      } else {
        message.error('取消注册失败，请稍后重试');
      }
    } finally {
      setDeregisterLoading(false);
      setDeregisteringId(null);
    }
  };

  const closeRegister = () => {
    setRegisterModalVisible(false);
    registerForm.resetFields();
  };

  const openRegister = () => {
    setRegisterModalVisible(true);
  };

  return {
    // data
    services,
    loading,
    searchText,
    setSearchText,
    healthFilter,
    setHealthFilter,
    // register
    registerModalVisible,
    registerLoading,
    registerForm,
    openRegister,
    closeRegister,
    handleRegister,
    // deregister
    deregisteringId,
    deregisterLoading,
    handleDeregister,
    // loading
    loadServices,
    handleRefresh,
  };
};

export type ServiceRegistryState = ReturnType<typeof useServiceRegistryState>;
