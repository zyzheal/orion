/**
 * ComplianceScan state hook
 * 抽取自 index.tsx (P2-9 Phase 188)
 */
import { useState, useEffect, useMemo } from 'react';
import { Form, message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import { apiCall } from './api';
import type { ComplianceFinding, ComplianceBaseline, FrameworkType } from './types';

export interface CreateBaselineFormValues {
  name: string;
  framework: FrameworkType;
  description?: string;
}

export const useComplianceScanState = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm<CreateBaselineFormValues>();
  const [scanning, setScanning] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: rawData, isLoading: loading, isError, refetch } = useQuery<{
    findings: ComplianceFinding[];
    baselines: ComplianceBaseline[];
  }>({
    queryKey: ['compliance-scan'],
    queryFn: async () => {
      const [findingsRes, baselinesRes] = await Promise.all([
        apiCall<ComplianceFinding[]>('/findings'),
        apiCall<ComplianceBaseline[]>('/baselines'),
      ]);
      return {
        findings: Array.isArray(findingsRes) ? findingsRes : [],
        baselines: Array.isArray(baselinesRes) ? baselinesRes : [],
      };
    },
    retry: 0,
    staleTime: 30_000,
  });

  const safeFindings = rawData?.findings ?? [];
  const safeBaselines = rawData?.baselines ?? [];

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (isError) {
      message.warning('合规数据加载失败，显示默认状态');
    }
  }, [isError]);

  const handleScan = async (id: string, name: string) => {
    setScanning(id);
    try {
      await apiCall<void>(`/baselines/${id}/scan`, { method: 'POST' });
      message.success(`安全基线 "${name}" 扫描已启动`);
      refetch();
    } catch (_err: unknown) {
      message.warning('扫描启动失败，请稍后重试');
    } finally {
      setScanning(null);
    }
  };

  const handleSubmitBaseline = async () => {
    const values = await createForm.validateFields();
    setCreating(true);
    try {
      await apiCall<ComplianceBaseline>('/baselines', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      message.success(`合规基线 "${values.name}" 创建成功`);
      setCreateModalOpen(false);
      createForm.resetFields();
      refetch();
    } catch (_err: unknown) {
      message.warning('基线创建失败，请稍后重试');
    } finally {
      setCreating(false);
    }
  };

  const closeCreate = () => {
    setCreateModalOpen(false);
    createForm.resetFields();
  };

  const totalRules = safeBaselines.reduce((sum, b) => sum + b.rules, 0);
  const avgPassRate = safeBaselines.length > 0
    ? Math.round(safeBaselines.reduce((s, b) => s + b.passRate, 0) / safeBaselines.length)
    : 0;
  const criticalCount = useMemo(
    () => safeFindings.filter((f) => f.level === 'critical' || f.level === 'high').length,
    [safeFindings]
  );

  return {
    createModalOpen,
    createForm,
    scanning,
    creating,
    loading,
    safeFindings,
    safeBaselines,
    totalRules,
    avgPassRate,
    criticalCount,
    refetch,
    handleScan,
    handleSubmitBaseline,
    closeCreate,
    setCreateModalOpen,
  };
};
