/**
 * CodeScan state hook
 */
import { useCallback, useEffect, useState } from 'react';
import { Form, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@/providers/QueryProvider';
import { apiCall } from './api';
import type { ScanCreateInput, ScanRecord, VulnFinding } from './types';

export const useCodeScanState = () => {
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm<ScanCreateInput>();
  const [scanning, setScanning] = useState<string | null>(null);

  const {
    data = { scans: [] as ScanRecord[], vulns: [] as VulnFinding[] },
    isLoading: loading,
    refetch: loadScans,
    error: queryError,
  } = useQuery({
    queryKey: ['security', 'code-scan', 'all'],
    queryFn: async () => {
      const [scansRes, vulnsRes] = await Promise.all([
        apiCall<ScanRecord[]>('/scans'),
        apiCall<VulnFinding[]>('/findings'),
      ]);
      return {
        scans: Array.isArray(scansRes) ? scansRes : [],
        vulns: Array.isArray(vulnsRes) ? vulnsRes : [],
      };
    },
  });

  const { scans, vulns } = data;

  useEffect(() => {
    if (queryError) {
      message.warning('代码扫描数据加载失败，显示默认状态');
    }
  }, [queryError]);

  const runScanMutation = useMutation({
    mutationFn: (id: string) => apiCall<void>(`/scans/${id}/run`, { method: 'POST' }),
    onSuccess: () => {
      message.success('代码安全扫描已启动');
      void queryClient.invalidateQueries({ queryKey: ['security', 'code-scan'] });
    },
    onError: () => {
      message.warning('扫描启动失败，请稍后重试');
    },
  });

  const handleScan = useCallback(
    (id: string) => {
      setScanning(id);
      runScanMutation.mutate(id, {
        onSettled: () => setScanning(null),
      });
    },
    [runScanMutation],
  );

  const createScanMutation = useMutation({
    mutationFn: (values: ScanCreateInput) =>
      apiCall<ScanRecord>('/scans', {
        method: 'POST',
        body: JSON.stringify(values),
      }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['security', 'code-scan'] });
      const previousData = queryClient.getQueryData<{
        scans: ScanRecord[];
        vulns: VulnFinding[];
      }>(['security', 'code-scan', 'all']);

      const optimisticScan: ScanRecord = {
        id: `new-${Date.now()}`,
        target: variables.target,
        branch: variables.branch || 'main',
        status: 'pending',
        totalVulns: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        duration: 0,
        startedAt: new Date().toISOString(),
      };

      if (previousData) {
        queryClient.setQueryData(['security', 'code-scan', 'all'], {
          ...previousData,
          scans: [...previousData.scans, optimisticScan],
        });
      }

      return { previousData, optimisticScan };
    },
    onSuccess: (_data, variables) => {
      message.success(`代码扫描 "${variables.target}" 已创建`);
    },
    onError: (_err, _variables, context) => {
      message.warning('扫描创建失败，请稍后重试');
      if (context?.previousData) {
        queryClient.setQueryData(['security', 'code-scan', 'all'], context.previousData);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['security', 'code-scan'] });
    },
  });

  const completedScans = scans.filter((s) => s.status === 'completed');
  const totalVulns = vulns.length;
  const highAndAboveVulns = vulns.filter(
    (v) => v.severity === 'critical' || v.severity === 'high',
  ).length;
  const passRate =
    completedScans.length > 0
      ? Math.round(
          (completedScans.filter((s) => s.totalVulns === 0).length / completedScans.length) * 100,
        )
      : 0;

  return {
    scans,
    vulns,
    loading,
    loadScans,
    createModalOpen,
    setCreateModalOpen,
    createForm,
    scanning,
    handleScan,
    runScanMutation,
    createScanMutation,
    completedScans,
    totalVulns,
    highAndAboveVulns,
    passRate,
  };
};

export type CodeScanState = ReturnType<typeof useCodeScanState>;
