/**
 * useMultiCloudAdvancedState.ts - Multi-Cloud Advanced 页面状态管理
 * 抽取自 MultiCloudAdvancedPage.tsx (P2-9 Phase 47)
 * 包含: 账号/资源/合规报告/调度策略/调度结果 状态 + 所有加载与提交 handler
 */
import { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import {
  multiCloudApi,
  type CloudAccount,
  type CloudResource,
  type ComplianceReport,
  type SchedulingPolicy,
  type SchedulingDecision,
} from '@/api/multi-cloud';

export interface RegisterAccountInput {
  name: string;
  provider: string;
  region: string;
  credentials?: { accessKeyId?: string; secretAccessKey?: string };
}

export interface ScheduleResourceInput {
  resourceType: string;
  cpu?: number;
  memoryMb?: number;
  storageGb?: number;
  policyId?: string;
  preferredProvider?: string;
  preferredRegion?: string;
}

export const useMultiCloudAdvancedState = () => {
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [resources, setResources] = useState<CloudResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [accountModal, setAccountModal] = useState(false);
  const [drModal, setDrModal] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [complianceReport, setComplianceReport] = useState<ComplianceReport | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [schedulingPolicies, setSchedulingPolicies] = useState<SchedulingPolicy[]>([]);
  const [scheduleResult, setScheduleResult] = useState<SchedulingDecision | null>(null);
  const [scheduleResultLoading, setScheduleResultLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [accountRes, resourceRes] = await Promise.all([
        multiCloudApi.listCloudAccounts(),
        multiCloudApi.listCloudResources(),
      ]);
      const accountData = (accountRes as any)?.data ?? accountRes;
      const resourceData = (resourceRes as any)?.data ?? resourceRes;
      setAccounts(Array.isArray(accountData) ? accountData : []);
      setResources(Array.isArray(resourceData) ? resourceData : []);
    } catch {
      message.error('加载数据失败');
    }
    setLoading(false);
  }, []);

  const loadSchedulingPolicies = useCallback(async () => {
    try {
      const res = await multiCloudApi.listSchedulingPolicies();
      const data = (res as any)?.data ?? res;
      setSchedulingPolicies(Array.isArray(data) ? data : []);
    } catch {
      // Silent fail for scheduling policies
    }
  }, []);

  useEffect(() => {
    loadData();
    loadSchedulingPolicies();
  }, [loadData, loadSchedulingPolicies]);

  const handleRunComplianceCheck = useCallback(async (categories?: string[]) => {
    setComplianceLoading(true);
    try {
      const res = await multiCloudApi.runComplianceCheck(categories);
      const data = (res as any)?.data ?? res;
      setComplianceReport(data);
      message.success('合规检查完成');
    } catch (error: unknown) {
      message.error(`合规检查失败: ${(error as Error).message}`);
    } finally {
      setComplianceLoading(false);
    }
  }, []);

  const handleScheduleResource = useCallback(async (values: ScheduleResourceInput) => {
    setScheduleResultLoading(true);
    try {
      const res = await multiCloudApi.scheduleResource({
        resourceType: values.resourceType,
        spec: {
          cpu: values.cpu,
          memoryMb: values.memoryMb,
          storageGb: values.storageGb,
        },
        policyId: values.policyId,
        preferredProvider: values.preferredProvider,
        preferredRegion: values.preferredRegion,
      });
      const data = (res as any)?.data ?? res;
      setScheduleResult(data);
      message.success('资源调度决策生成成功');
    } catch (error: unknown) {
      message.error(`调度失败: ${(error as Error).message}`);
    } finally {
      setScheduleResultLoading(false);
    }
  }, []);

  const handleRegisterAccount = useCallback(
    async (values: RegisterAccountInput) => {
      try {
        await multiCloudApi.registerCloudAccount({
          name: values.name,
          provider: values.provider,
          region: values.region,
          credentials_ref: `${values.credentials?.accessKeyId ?? ''}`,
          metadata: {},
        });
        message.success('云账号注册成功');
        setAccountModal(false);
        loadData();
      } catch {
        message.error('注册失败');
      }
    },
    [loadData],
  );

  return {
    accounts,
    resources,
    loading,
    accountModal,
    setAccountModal,
    drModal,
    setDrModal,
    scheduleModal,
    setScheduleModal,
    complianceReport,
    complianceLoading,
    schedulingPolicies,
    scheduleResult,
    scheduleResultLoading,
    loadData,
    handleRunComplianceCheck,
    handleScheduleResource,
    handleRegisterAccount,
  };
};
