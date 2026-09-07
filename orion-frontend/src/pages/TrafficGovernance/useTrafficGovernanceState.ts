/**
 * Traffic Governance state hook
 * 抽取自 index.tsx (P2-9 Phase 157)
 */
import { useEffect, useMemo, useState } from 'react';
import { Form, message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import canaryTrafficApi, { type CanaryDeployment } from '@/api/canary-traffic';
import type { TrafficRule, TrafficStats } from './types';

export function useTrafficGovernanceState() {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<TrafficRule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const {
    data: trafficRules = [] as TrafficRule[],
    isLoading: loading,
    isError,
    refetch: loadTrafficRules,
  } = useQuery<TrafficRule[]>({
    queryKey: ['traffic-rules'],
    queryFn: async () => {
      const data = await canaryTrafficApi.listCanaryDeployments();
      return data.map((d: CanaryDeployment): TrafficRule => ({
        id: d.id,
        serviceName: d.serviceName,
        environment: d.environment,
        canaryVersion: d.canaryVersion,
        baselineVersion: d.baselineVersion,
        canaryWeight: d.trafficSplit.canary,
        baselineWeight: d.trafficSplit.baseline,
        status: d.status,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }));
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (isError) message.error('加载流量规则失败');
  }, [isError]);

  const stats: TrafficStats = useMemo(() => {
    const activeRules = trafficRules.filter((r) => r.status === 'active').length;
    const avgCanary =
      trafficRules.length > 0
        ? Math.round(trafficRules.reduce((sum, r) => sum + r.canaryWeight, 0) / trafficRules.length)
        : 0;
    return {
      totalRules: trafficRules.length,
      activeRules,
      avgCanaryWeight: avgCanary,
      totalTraffic: trafficRules.reduce((sum, r) => sum + r.canaryWeight + r.baselineWeight, 0),
    };
  }, [trafficRules]);

  const handleCreate = () => {
    setEditingRule(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: TrafficRule) => {
    setEditingRule(record);
    form.setFieldsValue({
      serviceName: record.serviceName,
      environment: record.environment,
      canaryVersion: record.canaryVersion,
      baselineVersion: record.baselineVersion,
      canaryWeight: record.canaryWeight,
      baselineWeight: record.baselineWeight,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      if (editingRule) {
        await canaryTrafficApi.configureTrafficSplit(editingRule.id, {
          canaryWeight: values.canaryWeight,
          baselineWeight: values.baselineWeight,
        });
        message.success('流量规则已更新');
      } else {
        await canaryTrafficApi.createCanaryDeployment({
          serviceName: values.serviceName,
          environment: values.environment,
          canaryVersion: values.canaryVersion,
          baselineVersion: values.baselineVersion,
          initialTrafficSplit: {
            canary: values.canaryWeight,
            baseline: values.baselineWeight,
          },
        });
        message.success('流量规则已创建');
      }
      setModalVisible(false);
      loadTrafficRules();
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePromote = async (record: TrafficRule) => {
    try {
      await canaryTrafficApi.promoteCanary(record.id);
      message.success(`Canary 部署 ${record.canaryVersion} 已全量发布`);
      loadTrafficRules();
    } catch (err) {
      message.error('发布失败');
    }
  };

  const handleRollback = async (record: TrafficRule) => {
    try {
      await canaryTrafficApi.rollbackCanary(record.id);
      message.success(`已回滚到基线版本 ${record.baselineVersion}`);
      loadTrafficRules();
    } catch (err) {
      message.error('回滚失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await canaryTrafficApi.deleteCanaryDeployment(id);
      message.success('流量规则已删除');
      loadTrafficRules();
    } catch (err) {
      message.error('删除失败');
    }
  };

  return {
    modalVisible,
    setModalVisible,
    editingRule,
    submitting,
    form,
    trafficRules,
    loading,
    stats,
    handleCreate,
    handleEdit,
    handleSubmit,
    handlePromote,
    handleRollback,
    handleDelete,
  };
}

export type TrafficGovernanceState = ReturnType<typeof useTrafficGovernanceState>;
