/**
 * Pipeline Run History Analytics
 * P2-25: 成功率/耗时趋势/瓶颈分析
 *
 * 拆分结构（P2-9 Phase 38）:
 * - types.ts: RunRecord/PipelineSummary/RunStats/Bottleneck/DurationBucket
 * - constants.tsx: statusConfig + computeStats + formatDuration + toNumberMs
 * - StatsCards.tsx: 6 张 Statistic 卡片行
 * - FilterBar.tsx: Pipeline/Status/DateRange/Refresh 筛选
 * - SuccessRateChart.tsx: 环形进度 + 成功/失败/取消 计数
 * - DurationDistribution.tsx: 30s-2m 等 5 个桶
 * - TopSlowRuns.tsx: Top 5 慢速运行
 * - BottleneckTable.tsx: 按失败次数排序的瓶颈分析
 * - RunHistoryTable.tsx: 运行历史明细 + Cancel/Retry/详情 操作
 * - StageDetailDrawer.tsx: 700px Stage 详情抽屉
 * - index.tsx: state + 4 loader + 6 useMemo + 布局
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Typography, Row, Col, message } from 'antd';
import { DashboardOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import {
  getAllPipelineRuns,
  getPipelineRunStages,
  type GetAllPipelineRunsParams,
} from '@/api/pipelineRuns';
import { getPipelines } from '@/api/pipelines';
import dayjs from 'dayjs';
import type {
  RunRecord,
  PipelineSummary,
  Bottleneck,
  DurationBucket,
} from './types';
import { computeStats } from './constants';
import { StatsCards } from './StatsCards';
import { FilterBar } from './FilterBar';
import { SuccessRateChart } from './SuccessRateChart';
import { DurationDistribution } from './DurationDistribution';
import { TopSlowRuns } from './TopSlowRuns';
import { BottleneckTable } from './BottleneckTable';
import { RunHistoryTable } from './RunHistoryTable';
import { StageDetailDrawer } from './StageDetailDrawer';

const { Title, Text } = Typography;

export default function PipelineRunAnalyticsPage() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);
  const [stageDetails, setStageDetails] = useState<unknown[]>([]);
  const [stageLoading, setStageLoading] = useState(false);

  const loadPipelines = async () => {
    try {
      const res = await getPipelines();
      const list = res.data as
        | { data?: PipelineSummary[]; pipelines?: PipelineSummary[] }
        | PipelineSummary[];
      const data = Array.isArray(list)
        ? list
        : ((list as { data?: PipelineSummary[] })?.data ??
          (list as { pipelines?: PipelineSummary[] })?.pipelines ??
          []);
      setPipelines(data);
    } catch {
      // Pipeline list optional
    }
  };

  const buildParams = useCallback((): GetAllPipelineRunsParams => {
    const params: GetAllPipelineRunsParams = { limit: 200 };
    if (selectedPipeline) params.pipelineId = selectedPipeline;
    if (selectedStatus) params.status = selectedStatus;
    return params;
  }, [selectedPipeline, selectedStatus]);

  const loadRuns = async () => {
    setLoading(true);
    try {
      const res = await getAllPipelineRuns(buildParams());
      const raw = (res as any).data ?? res;
      let data =
        (raw as { data?: RunRecord[]; runs?: RunRecord[] })?.data ??
        (raw as { runs?: RunRecord[] })?.runs ??
        (raw as RunRecord[]) ??
        [];
      if (!Array.isArray(data)) data = [];

      // Client-side date filtering
      if (dateRange && dateRange[0] && dateRange[1]) {
        const start = dateRange[0].startOf('day');
        const end = dateRange[1].endOf('day');
        data = data.filter((r) => {
          const d = dayjs(r.startedAt || r.createdAt);
          return d.isAfter(start) && d.isBefore(end);
        });
      }

      // Sort newest first
      data.sort((a, b) => {
        const ta = a.startedAt || a.createdAt;
        const tb = b.startedAt || b.createdAt;
        return dayjs(tb).valueOf() - dayjs(ta).valueOf();
      });

      setRuns(data);
    } catch {
      message.error('Failed to load pipeline runs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
    loadPipelines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPipeline, selectedStatus]);

  const stats = useMemo(() => computeStats(runs), [runs]);
  const successRateProgress: {
    percent: number;
    status?: 'normal' | 'active' | 'exception' | 'success' | undefined;
  } =
    stats.total > 0
      ? {
          percent: stats.successRate,
          status:
            stats.successRate >= 80
              ? 'normal'
              : stats.successRate >= 50
                ? 'active'
                : 'exception',
        }
      : { percent: 0 };

  const bottlenecks = useMemo((): Bottleneck[] => {
    const byPipeline = new Map<string, RunRecord[]>();
    runs.forEach((r) => {
      const existing = byPipeline.get(r.pipelineId) || [];
      existing.push(r);
      byPipeline.set(r.pipelineId, existing);
    });
    return Array.from(byPipeline.entries())
      .map(([pid, pruns]) => {
        const failures = pruns.filter((r) => r.status === 'failed');
        const durations = pruns
          .filter((r) => r.status === 'success')
          .map((r) =>
            typeof r.durationMs === 'string' ? parseInt(r.durationMs, 10) : (r.durationMs ?? 0)
          )
          .filter((d) => Number.isFinite(d) && d > 0);
        const avgMs =
          durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
        const pname = pipelines.find((p) => p.id === pid)?.name || pid;
        return {
          stageName: pname,
          failureCount: failures.length,
          avgDurationMs: Math.round(avgMs),
          pipelineId: pid,
          pipelineName: pname,
        };
      })
      .sort((a, b) => b.failureCount - a.failureCount)
      .slice(0, 10);
  }, [runs, pipelines]);

  const durationBuckets = useMemo((): DurationBucket[] => {
    const buckets: { label: string; items: RunRecord[] }[] = [
      { label: '< 30s', items: [] },
      { label: '30s-2m', items: [] },
      { label: '2m-5m', items: [] },
      { label: '5m-15m', items: [] },
      { label: '> 15m', items: [] },
    ];
    runs
      .filter((r) => r.status === 'success')
      .forEach((r) => {
        const ms = typeof r.durationMs === 'string' ? parseInt(r.durationMs, 10) : r.durationMs;
        if (ms == null) return;
        if (ms < 30000) buckets[0].items.push(r);
        else if (ms < 120000) buckets[1].items.push(r);
        else if (ms < 300000) buckets[2].items.push(r);
        else if (ms < 900000) buckets[3].items.push(r);
        else buckets[4].items.push(r);
      });
    return buckets.map((b) => ({
      label: b.label,
      count: b.items.length,
      avgMs:
        b.items.length > 0
          ? Math.round(
              b.items.reduce((sum, r) => {
                const d =
                  typeof r.durationMs === 'string' ? parseInt(r.durationMs, 10) : r.durationMs;
                return sum + (d || 0);
              }, 0) / b.items.length
            )
          : 0,
    }));
  }, [runs]);

  const topSlow = useMemo((): RunRecord[] => {
    return runs
      .filter((r) => r.status === 'success')
      .map((r) => ({
        ...r,
        _dur: typeof r.durationMs === 'string' ? parseInt(r.durationMs, 10) : r.durationMs,
      }))
      .sort((a, b) => (b._dur ?? 0) - (a._dur ?? 0))
      .slice(0, 5)
      .map(({ _dur, ...rest }) => rest);
  }, [runs]);

  const openStageDetail = async (run: RunRecord) => {
    setSelectedRun(run);
    setStageLoading(true);
    try {
      const res = await getPipelineRunStages(run.id);
      const stages = res.data as unknown[];
      setStageDetails(Array.isArray(stages) ? stages : [stages]);
    } catch {
      message.error('Failed to load stage details');
    } finally {
      setStageLoading(false);
    }
  };

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <DashboardOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        流水线运行分析
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        运行历史成功率、耗时趋势与瓶颈分析
      </Text>

      <FilterBar
        pipelines={pipelines}
        selectedPipeline={selectedPipeline}
        setSelectedPipeline={setSelectedPipeline}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        dateRange={dateRange}
        setDateRange={setDateRange}
        loading={loading}
        loadRuns={loadRuns}
      />

      <StatsCards stats={stats} />

      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        <Col span={8}>
          <SuccessRateChart stats={stats} status={successRateProgress.status} />
        </Col>
        <Col span={8}>
          <DurationDistribution buckets={durationBuckets} successCount={stats.success} />
        </Col>
        <Col span={8}>
          <TopSlowRuns topSlow={topSlow} pipelines={pipelines} stats={stats} />
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        <Col span={24}>
          <BottleneckTable bottlenecks={bottlenecks} runs={runs} />
        </Col>
      </Row>

      <RunHistoryTable
        runs={runs}
        pipelines={pipelines}
        loading={loading}
        loadRuns={loadRuns}
        openStageDetail={openStageDetail}
      />

      <StageDetailDrawer
        selectedRun={selectedRun}
        pipelines={pipelines}
        stageDetails={stageDetails}
        stageLoading={stageLoading}
        onClose={() => setSelectedRun(null)}
      />
    </div>
  );
}
