/**
 * useDisasterRecoveryState.ts - 灾备管理页状态钩子
 * 抽取自 DisasterRecovery/index.tsx (P2-9 Phase 100)
 */
import { useState, useEffect } from 'react';
import { Form, message } from 'antd';
import { disasterRecoveryApi } from '@/api/disaster-recovery';
import {
  type RtoRpoRecord,
  type DrillRecord,
  DEFAULT_RTO_TARGET,
  DEFAULT_RPO_TARGET,
  DEFAULT_LAST_DRILL,
  DEFAULT_COVERAGE,
  loadDRStatus,
  loadDRPlans,
} from './constants';

export const useDisasterRecoveryState = () => {
  const [rtoRpoRecords, setRtoRpoRecords] = useState<RtoRpoRecord[]>([]);
  const [drillRecords] = useState<DrillRecord[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [createForm] = Form.useForm();
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [testingType, setTestingType] = useState<'rto' | 'rpo' | null>(null);
  const [rtoTarget] = useState(DEFAULT_RTO_TARGET);
  const [rpoTarget] = useState(DEFAULT_RPO_TARGET);
  const [lastDrill, setLastDrill] = useState(DEFAULT_LAST_DRILL);
  const [coverage, setCoverage] = useState(DEFAULT_COVERAGE);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [status, plans] = await Promise.all([loadDRStatus(), loadDRPlans()]);
      if (!mounted) return;

      if (plans && plans.length > 0) {
        const mapped = plans.map((p) => ({
          id: p.id,
          serviceName: p.name,
          rtoTarget: p.rto,
          rtoActual: null,
          rpoTarget: p.rpo,
          rpoActual: null,
          status: p.status === 'active' ? 'pass' : 'untested',
          drLevel: 'active-passive',
          lastTestedAt: p.lastTestedAt || '-',
        })) as RtoRpoRecord[];
        setRtoRpoRecords(mapped);
      }

      if (status) {
        setCoverage(Math.round(((status.plans?.length || 0) / 10) * 100));
        const last = status.plans?.find((p) => p.lastTestedAt);
        if (last?.lastTestedAt) {
          setLastDrill(last.lastTestedAt.split(' ')[0] || DEFAULT_LAST_DRILL);
        }
        setLoading(false);
      } else {
        setRtoRpoRecords([]);
        setCoverage(0);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleTest = async (id: string, type: 'rto' | 'rpo') => {
    setSelectedRecordId(id);
    setTestingType(type);
    setLoading(true);
    try {
      await disasterRecoveryApi.executeFailoverTest(id);
      message.success(`${type.toUpperCase()} 测试完成`);
    } catch {
      message.error(`${type.toUpperCase()} 测试失败`);
    } finally {
      setLoading(false);
      setSelectedRecordId(null);
      setTestingType(null);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setLoading(true);
      await disasterRecoveryApi.createDRPlan({
        name: values.serviceName,
        description: values.serviceName + ' 灾备计划',
        rpo: values.rpo,
        rto: values.rto,
        services: [values.serviceName],
      });
      message.success('灾备计划已创建');
      await loadDRPlans().then((plans) => {
        if (plans && plans.length > 0) {
          setRtoRpoRecords(
            plans.map((p) => ({
              id: p.id,
              serviceName: p.name,
              rtoTarget: p.rto,
              rtoActual: null,
              rpoTarget: p.rpo,
              rpoActual: null,
              status: 'pass',
              drLevel: values.drLevel,
              lastTestedAt: '-',
            })) as RtoRpoRecord[]
          );
        }
      });
      setCreateModalOpen(false);
      createForm.resetFields();
      setLoading(false);
    } catch {
      message.error('创建失败');
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    const plans = await loadDRPlans();
    if (plans && plans.length > 0) {
      setRtoRpoRecords(
        plans.map((p) => ({
          id: p.id,
          serviceName: p.name,
          rtoTarget: p.rto,
          rtoActual: null,
          rpoTarget: p.rpo,
          rpoActual: null,
          status: 'pass',
          drLevel: 'active-passive',
          lastTestedAt: p.lastTestedAt || '-',
        })) as RtoRpoRecord[]
      );
    }
    setLoading(false);
    message.success('已刷新');
  };

  return {
    rtoRpoRecords,
    setRtoRpoRecords,
    drillRecords,
    createModalOpen,
    setCreateModalOpen,
    loading,
    setLoading,
    createForm,
    selectedRecordId,
    setSelectedRecordId,
    testingType,
    setTestingType,
    rtoTarget,
    rpoTarget,
    lastDrill,
    coverage,
    handleTest,
    handleCreate,
    handleRefresh,
  };
};

export type DisasterRecoveryState = ReturnType<typeof useDisasterRecoveryState>;
