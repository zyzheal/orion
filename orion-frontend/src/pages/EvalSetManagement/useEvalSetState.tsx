/**
 * useEvalSetState.ts - EvalSetManagement 状态 Hook
 * 抽取自 EvalSetManagement/index.tsx (P2-9 Phase 60)
 */
import { useState, useEffect } from 'react';
import { Form, message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import { apiCall } from './constants';
import type { EvalSet, EvalRun } from './types';

export const useEvalSetState = () => {
  const [selectedSet, setSelectedSet] = useState<EvalSet | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm<{ name: string; description?: string; cases: string }>();
  const [selectedRuns, setSelectedRuns] = useState<EvalRun[]>([]);
  const [runLoading, setRunLoading] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data: rawData, isLoading: loading, isError, error, refetch } = useQuery<{
    sets: EvalSet[];
    runs: EvalRun[];
  }>({
    queryKey: ['eval-sets'],
    queryFn: async () => {
      const [setsRes, runsRes] = await Promise.all([
        apiCall<EvalSet[]>('/eval/sets'),
        apiCall<EvalRun[]>('/eval/runs'),
      ]);
      return {
        sets: Array.isArray(setsRes) ? setsRes : [],
        runs: Array.isArray(runsRes) ? runsRes : [],
      };
    },
    retry: 0,
    staleTime: 30_000,
  });

  const sets = rawData?.sets ?? [];
  const runs = rawData?.runs ?? [];

  // 加载失败反馈：当前锁定的 @tanstack/react-query 构建不调用 useQuery 的 onError
  // 选项（observer 级回调未实现），统一改用 isError + useEffect 保持错误可见。
  useEffect(() => {
    if (isError) {
      message.error(
        `加载评测集失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }, [isError, error]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const result = await apiCall<{ seeded: number }>('/eval/sets/seed', { method: 'POST' });
      const count = (result as unknown as { seeded?: number })?.seeded ?? 0;
      message.success(`已初始化 ${count} 个评测集（TR-09/10/11 演示数据）`);
      refetch();
    } catch (error: unknown) {
      message.warning(`初始化失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setSeeding(false);
    }
  };

  const handleExportReport = async () => {
    if (runs.length === 0) {
      message.warning('暂无评测运行记录可导出');
      return;
    }
    setExporting(true);
    try {
      const report = {
        reportTitle: 'Orion RAG 评测报告',
        exportTime: new Date().toISOString(),
        totalRuns: runs.length,
        summary: {
          totalSets: sets.length,
          totalCases: sets.reduce((sum, s) => sum + (s.cases?.length || 0), 0),
          avgPassRate: runs.length > 0
            ? runs.reduce((s, r) => s + (r.total_count > 0 ? r.pass_count / r.total_count : 0), 0) / runs.length
            : 0,
          avgRecall: runs.length > 0
            ? runs.reduce((s, r) => s + (r.avg_recall ?? 0), 0) / runs.length
            : 0,
          avgScore: runs.length > 0
            ? runs.reduce((s, r) => s + (r.avg_score ?? 0), 0) / runs.length
            : 0,
        },
        runs: runs.map((r) => ({
          runId: r.id,
          setId: r.set_id,
          model: r.model,
          status: r.status,
          passCount: r.pass_count,
          totalCount: r.total_count,
          passRate: r.total_count > 0 ? Number((r.pass_count / r.total_count * 100).toFixed(2)) : 0,
          avgRecall: r.avg_recall ?? 0,
          avgScore: r.avg_score ?? 0,
          createdAt: r.created_at,
        })),
      };
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eval-report-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('评测报告已导出');
    } catch (error: unknown) {
      message.warning(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setExporting(false);
    }
  };

  const handleCreateSet = async () => {
    try {
      const values = await createForm.validateFields();
      const lines = values.cases
        ? String(values.cases)
            .split('\n')
            .map((l: string) => l.trim())
            .filter(Boolean)
        : [];

      if (lines.length === 0) {
        message.warning('请至少输入一个评测用例');
        return;
      }

      const cases: Array<{ query: string; gold_answer?: string }> = lines.map((line) => {
        const parts = line.split('|||');
        return {
          query: parts[0].trim(),
          gold_answer: parts[1]?.trim() || '',
        };
      });

      await apiCall<EvalSet>('/eval/sets', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          description: values.description,
          cases,
        }),
      });
      message.success(`评测集 "${values.name}" 创建成功，含 ${cases.length} 个用例`);
      setCreateModalOpen(false);
      createForm.resetFields();
      refetch();
    } catch (error: unknown) {
      message.error(`创建失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleDeleteSet = async (id: string, name: string) => {
    try {
      await apiCall<void>(`/eval/sets/${id}`, { method: 'DELETE' });
      message.success(`评测集 "${name}" 已删除`);
      refetch();
    } catch (error: unknown) {
      message.error(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleViewSet = async (id: string) => {
    try {
      const set = await apiCall<EvalSet>(`/eval/sets/${id}`);
      setSelectedSet(set);
    } catch (error: unknown) {
      message.error(`加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleRunEval = async (setId: string, setName: string) => {
    setRunLoading(setId);
    try {
      const run = await apiCall<EvalRun>(`/eval/sets/${setId}/run`, { method: 'POST' });
      message.success({
        content: (
          <div>
            <strong>评测已启动</strong>
            <br />
            <span style={{ color: 'rgba(0,0,0,0.45)' }}>
              评测集: {setName} | Run ID: {run.id}
            </span>
          </div>
        ),
        duration: 5,
      });
      refetch();
    } catch (error: unknown) {
      message.error(`启动评测失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setRunLoading(null);
    }
  };

  const handleCompare = async () => {
    if (selectedRuns.length !== 2) {
      message.warning('请勾选两条评测运行记录进行对比');
      return;
    }
    try {
      await apiCall<{ run_a: EvalRun; run_b: EvalRun }>('/eval/compare', {
        method: 'POST',
        body: JSON.stringify({
          run_a_id: selectedRuns[0].id,
          run_b_id: selectedRuns[1].id,
        }),
      });
      message.success({
        content: (
          <div>
            <strong>对比分析完成</strong>
            <br />
            <span style={{ color: 'rgba(0,0,0,0.45)' }}>
              {selectedRuns[0].model} vs {selectedRuns[1].model}
            </span>
            <br />
            <span>
              得分 A: {selectedRuns[0].avg_score?.toFixed(2)} | 得分 B:{' '}
              {selectedRuns[1].avg_score?.toFixed(2)}
            </span>
          </div>
        ),
        duration: 8,
      });
      setSelectedRuns([]);
    } catch (error: unknown) {
      message.error(`对比失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  return {
    selectedSet, setSelectedSet,
    createModalOpen, setCreateModalOpen,
    createForm,
    selectedRuns, setSelectedRuns,
    runLoading,
    seeding,
    exporting,
    sets, runs,
    loading,
    refetch,
    handleSeed,
    handleExportReport,
    handleCreateSet,
    handleDeleteSet,
    handleViewSet,
    handleRunEval,
    handleCompare,
  };
};
