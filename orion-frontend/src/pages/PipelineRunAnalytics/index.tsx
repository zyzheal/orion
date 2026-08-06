/**
 * Pipeline Run History Analytics
 * P2-25: 成功率/耗时趋势/瓶颈分析
 * Analyzes pipeline run history for success rates, duration trends, and bottleneck detection.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Button,
  Statistic,
  Row,
  Col,
  Space,
  Table,
  Select,
  DatePicker,
  Tag,
  Progress,
  Typography,
  message,
  List,
  Descriptions,
  Drawer,
} from 'antd';
import {
  ThunderboltOutlined,
  ReloadOutlined,
  TrophyOutlined,
  ClockCircleOutlined,
  FireOutlined,
  DashboardOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { getAllPipelineRuns, cancelPipelineRun, retryPipelineRun, getPipelineRunStages, type GetAllPipelineRunsParams } from '@/api/pipelineRuns';
import { getPipelines } from '@/api/pipelines';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

// ==================== Types ====================

interface RunRecord {
  id: string;
  pipelineId: string;
  pipelineVersion?: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  triggerType: 'manual' | 'push' | 'schedule' | 'api';
  triggerBy?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number | string;
  createdAt: string;
}

interface PipelineSummary {
  id: string;
  name: string;
}

interface RunStats {
  total: number;
  success: number;
  failed: number;
  cancelled: number;
  running: number;
  successRate: number;
  avgDurationMs: number;
  maxDurationMs: number;
  minDurationMs: number;
}

interface Bottleneck {
  stageName: string;
  failureCount: number;
  avgDurationMs: number;
  pipelineId: string;
  pipelineName: string;
}

interface DurationBucket {
  label: string;
  count: number;
  avgMs: number;
}

// ==================== Helpers ====================

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  success: { color: 'green', icon: <CheckCircleOutlined />, label: '成功' },
  failed: { color: 'red', icon: <CloseCircleOutlined />, label: '失败' },
  running: { color: 'blue', icon: <PauseCircleOutlined />, label: '运行中' },
  pending: { color: 'default', icon: <ClockCircleOutlined />, label: '等待' },
  cancelled: { color: 'orange', icon: <PauseCircleOutlined />, label: '取消' },
};

const computeStats = (runs: RunRecord[]): RunStats => {
  const success = runs.filter((r) => r.status === 'success');
  const failed = runs.filter((r) => r.status === 'failed');
  const cancelled = runs.filter((r) => r.status === 'cancelled');
  const running = runs.filter((r) => r.status === 'running');
  const durations = success
    .map((r) => typeof r.durationMs === 'string' ? parseInt(r.durationMs, 10) : r.durationMs)
    .filter((d): d is number => d != null && d > 0);
  const avgDurationMs = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const maxDurationMs = durations.length > 0 ? Math.max(...durations) : 0;
  const minDurationMs = durations.length > 0 ? Math.min(...durations) : 0;
  return {
    total: runs.length,
    success: success.length,
    failed: failed.length,
    cancelled: cancelled.length,
    running: running.length,
    successRate: runs.length > 0 ? Math.round((success.length / runs.length) * 100) : 0,
    avgDurationMs: Math.round(avgDurationMs),
    maxDurationMs,
    minDurationMs,
  };
};

const formatDuration = (ms: number): string => {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
};

// ==================== Component ====================

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

  useEffect(() => {
    loadRuns();
    loadPipelines();
  }, [selectedPipeline, selectedStatus]);

  const loadPipelines = async () => {
    try {
      const res = await getPipelines();
      const list = res.data as { data?: PipelineSummary[]; pipelines?: PipelineSummary[] } | PipelineSummary[];
      const pipelines = Array.isArray(list) ? list : (list as { data?: PipelineSummary[] })?.data ?? (list as { pipelines?: PipelineSummary[] })?.pipelines ?? [];
      setPipelines(pipelines);
    } catch {
      // Pipeline list optional
    }
  };

  const buildParams = useCallback((): GetAllPipelineRunsParams => {
    const params: GetAllPipelineRunsParams = { limit: 200 };
    if (selectedPipeline) params.pipelineId = selectedPipeline;
    if (selectedStatus) params.status = selectedStatus;
    if (dateRange && dateRange[0] && dateRange[1]) {
      // Server-side filtering optional; client-side fallback below
    }
    return params;
  }, [selectedPipeline, selectedStatus]);

  const loadRuns = async () => {
    setLoading(true);
    try {
      const res = await getAllPipelineRuns(buildParams());
      let data = (res.data as { data?: RunRecord[]; runs?: RunRecord[] })?.data ?? (res.data as { runs?: RunRecord[] })?.runs ?? (res.data as RunRecord[]) ?? [];
      if (!Array.isArray(data)) data = [];

      // Client-side date filtering
      if (dateRange && dateRange[0] && dateRange[1]) {
        const start = dateRange[0].startOf('day');
        const end = dateRange[1].endOf('day');
        data = data.filter((r) => {
          const ts = r.startedAt || r.createdAt;
          const d = dayjs(ts);
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

  const stats = useMemo(() => computeStats(runs), [runs]);
  const successRateProgress = stats.total > 0
    ? { percent: stats.successRate, status: stats.successRate >= 80 ? 'normal' : stats.successRate >= 50 ? 'active' : 'exception' }
    : { percent: 0 };

  // Bottleneck analysis: per-pipeline success rate + failure count
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
        const durations = pruns.filter((r) => r.status === 'success')
          .map((r) => typeof r.durationMs === 'string' ? parseInt(r.durationMs, 10) : r.durationMs)
          .filter((d): d is number => d > 0);
        const avgMs = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
        const pname = pipelines.find((p) => p.id === pid)?.name || pid;
        return {
          stageName: `${pname}`,
          failureCount: failures.length,
          avgDurationMs: Math.round(avgMs),
          pipelineId: pid,
          pipelineName: pname,
        };
      })
      .sort((a, b) => b.failureCount - a.failureCount)
      .slice(0, 10);
  }, [runs, pipelines]);

  // Duration distribution buckets
  const durationBuckets = useMemo((): DurationBucket[] => {
    const buckets: { label: string; items: RunRecord[] }[] = [
      { label: '< 30s', items: [] },
      { label: '30s-2m', items: [] },
      { label: '2m-5m', items: [] },
      { label: '5m-15m', items: [] },
      { label: '> 15m', items: [] },
    ];
    runs.filter((r) => r.status === 'success').forEach((r) => {
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
      avgMs: b.items.length > 0
        ? Math.round(b.items.reduce((sum, r) => {
            const d = typeof r.durationMs === 'string' ? parseInt(r.durationMs, 10) : r.durationMs;
            return sum + (d || 0);
          }, 0) / b.items.length)
        : 0,
    }));
  }, [runs]);

  // Top 5 slowest runs
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

  const runColumns = [
    {
      title: 'Run ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (v: string) => <Text code>{v.slice(0, 12)}…</Text>,
    },
    {
      title: 'Pipeline',
      key: 'pipeline',
      width: 140,
      render: (_: unknown, r: RunRecord) => {
        const p = pipelines.find((pl) => pl.id === r.pipelineId);
        return <Tag>{p?.name || r.pipelineId}</Tag>;
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 80,
      render: (_: unknown, r: RunRecord) => {
        const cfg = statusConfig[r.status] || statusConfig.pending;
        return (
          <Tag color={cfg.color}>
            {cfg.icon} {cfg.label}
          </Tag>
        );
      },
    },
    {
      title: 'Trigger',
      dataIndex: 'triggerType',
      key: 'triggerType',
      width: 80,
      render: (v: string) => <Tag color="default">{v}</Tag>,
    },
    {
      title: '耗时',
      key: 'duration',
      width: 90,
      render: (_: unknown, r: RunRecord) => <Text code>{formatDuration(typeof r.durationMs === 'string' ? parseInt(r.durationMs, 10) : r.durationMs ?? 0)}</Text>,
    },
    {
      title: '开始时间',
      key: 'startedAt',
      width: 150,
      render: (_: unknown, r: RunRecord) => <Text>{r.startedAt ? dayjs(r.startedAt).format('YYYY-MM-DD HH:mm') : '—'}</Text>,
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_: unknown, r: RunRecord) => (
        <Space size="small">
          {r.status === 'running' && (
            <Button size="small" danger onClick={() => { cancelPipelineRun(r.id).then(() => loadRuns()); }}>Cancel</Button>
          )}
          {r.status === 'failed' && (
            <Button size="small" type="primary" onClick={() => { retryPipelineRun(r.id).then(() => loadRuns()); }}>Retry</Button>
          )}
          <Button size="small" onClick={() => openStageDetail(r)}>详情</Button>
        </Space>
      ),
    },
  ];

  const bottleneckColumns = [
    { title: 'Pipeline', dataIndex: 'pipelineName', key: 'pipelineName' },
    { title: '失败次数', dataIndex: 'failureCount', key: 'failureCount', render: (v: number) => <Tag color={v > 0 ? 'red' : 'green'}>{v}</Tag> },
    { title: '平均耗时', dataIndex: 'avgDurationMs', key: 'avgDurationMs', render: (v: number) => formatDuration(v) },
    {
      title: '成功率',
      key: 'rate',
      render: (_: unknown, b: Bottleneck) => {
        const pruns = runs.filter((r) => r.pipelineId === b.pipelineId);
        const rate = pruns.length > 0 ? Math.round(pruns.filter((r) => r.status === 'success').length / pruns.length * 100) : 0;
        return <Progress percent={rate} size="small" status={rate >= 80 ? 'normal' : rate >= 50 ? 'active' : 'exception'} showInfo />;
      },
    },
  ];

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
        Pipeline Run Analytics
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        Run history success rate, duration trends, and bottleneck analysis
      </Text>

      {/* Filters */}
      <Card style={{ marginBottom: spacing.md }}>
        <Space wrap>
          <Select
            placeholder="Pipeline"
            allowClear
            style={{ width: 200 }}
            value={selectedPipeline || undefined}
            onChange={(v) => setSelectedPipeline(v || null)}
          >
            {pipelines.map((p) => <Option key={p.id} value={p.id}>{p.name}</Option>)}
          </Select>
          <Select
            placeholder="Status"
            allowClear
            style={{ width: 120 }}
            value={selectedStatus || undefined}
            onChange={(v) => setSelectedStatus(v || null)}
          >
            {Object.keys(statusConfig).map((s) => (
              <Option key={s} value={s}>{statusConfig[s].label}</Option>
            ))}
          </Select>
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            style={{ width: 250 }}
          />
          <Button icon={<ReloadOutlined />} onClick={loadRuns} loading={loading}>
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Top Stats Row */}
      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        <Col span={4}>
          <Card>
            <Statistic title="总运行" value={stats.total} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="成功" value={stats.success} valueStyle={{ color: colors.success[500] }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="失败" value={stats.failed} valueStyle={{ color: colors.error[500] }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="取消" value={stats.cancelled} valueStyle={{ color: colors.warning[500] }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="成功率" value={stats.successRate} suffix="%" />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="平均耗时" value={formatDuration(stats.avgDurationMs)} valueStyle={{ fontSize: 14 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        <Col span={8}>
          <Card title="成功率分布">
            <div style={{ textAlign: 'center', marginBottom: spacing.md }}>
              <Progress
                type="circle"
                percent={stats.successRate}
                size={120}
                status={successRateProgress.status as any}
                format={(p) => <span><TrophyOutlined /> {p}%</span>}
              />
            </div>
            <Row>
              <Col span={8}><Text>成功</Text> <Text strong>{stats.success}</Text></Col>
              <Col span={8}><Text>失败</Text> <Text strong style={{ color: colors.error[500] }}>{stats.failed}</Text></Col>
              <Col span={8}><Text>取消</Text> <Text strong style={{ color: colors.warning[500] }}>{stats.cancelled}</Text></Col>
            </Row>
          </Card>
        </Col>

        <Col span={8}>
          <Card title="耗时分布" style={{ height: 220 }}>
            {durationBuckets.length > 0 ? (
              <List
                size="small"
                dataSource={durationBuckets}
                renderItem={(bucket) => (
                  <List.Item>
                    <Row style={{ width: '100%' }} align="middle">
                      <Col span={8}>
                        <Text strong>{bucket.label}</Text>
                      </Col>
                      <Col span={12}>
                        <Progress
                          percent={stats.success > 0 ? Math.round((bucket.count / stats.success) * 100) : 0}
                          size="small"
                          showInfo={false}
                          strokeColor={bucket.count > 0 ? colors.primary[500] : colors.neutral[200]}
                        />
                      </Col>
                      <Col span={4}>
                        <Tag>{bucket.count}</Tag>
                      </Col>
                    </Row>
                  </List.Item>
                )}
              />
            ) : <Empty description="无数据" />}
          </Card>
        </Col>

        <Col span={8}>
          <Card title="Top 5 慢速运行" style={{ height: 220 }}>
            {topSlow.length > 0 ? (
              <List
                size="small"
                dataSource={topSlow}
                renderItem={(r) => {
                  const dur = typeof r.durationMs === 'string' ? parseInt(r.durationMs, 10) : r.durationMs ?? 0;
                  const p = pipelines.find((pl) => pl.id === r.pipelineId);
                  return (
                    <List.Item>
                      <Row style={{ width: '100%' }} align="middle">
                        <Col span={10}>
                          <Text strong>{p?.name || r.pipelineId}</Text>
                        </Col>
                        <Col span={6}>
                          <Text code>{formatDuration(dur)}</Text>
                        </Col>
                        <Col span={8}>
                          <Progress
                            percent={stats.maxDurationMs > 0 ? Math.round(dur / stats.maxDurationMs * 100) : 0}
                            size="small"
                            showInfo={false}
                            strokeColor={dur > stats.avgDurationMs * 2 ? colors.error[500] : colors.primary[500]}
                          />
                        </Col>
                      </Row>
                    </List.Item>
                  );
                }}
              />
            ) : <Empty description="无数据" />}
          </Card>
        </Col>
      </Row>

      {/* Bottleneck Analysis */}
      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        <Col span={24}>
          <Card title={<><FireOutlined /> 瓶颈分析 — 按失败次数排序</>}>
            {bottlenecks.length > 0 ? (
              <Table
                columns={bottleneckColumns}
                dataSource={bottlenecks}
                rowKey="pipelineId"
                pagination={false}
                size="small"
              />
            ) : <Empty description="无瓶颈数据" />}
          </Card>
        </Col>
      </Row>

      {/* Run History Table */}
      <Card title="运行历史明细">
        <Table
          columns={runColumns}
          dataSource={runs}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
          size="small"
        />
      </Card>

      {/* Stage Detail Drawer */}
      <Drawer
        title={`Stage Detail — ${selectedRun?.id?.slice(0, 12) || ''}`}
        width={700}
        open={!!selectedRun}
        onClose={() => setSelectedRun(null)}
      >
        {selectedRun && (
          <Descriptions bordered size="small" column={2} style={{ marginBottom: spacing.md }}>
            <Descriptions.Item label="Pipeline">
              {pipelines.find((p) => p.id === selectedRun.pipelineId)?.name || selectedRun.pipelineId}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={(statusConfig[selectedRun.status] || statusConfig.pending).color}>
                {selectedRun.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Trigger">{selectedRun.triggerType}</Descriptions.Item>
            <Descriptions.Item label="耗时">{formatDuration(typeof selectedRun.durationMs === 'string' ? parseInt(selectedRun.durationMs, 10) : selectedRun.durationMs ?? 0)}</Descriptions.Item>
            <Descriptions.Item label="开始">{selectedRun.startedAt ? dayjs(selectedRun.startedAt).format('YYYY-MM-DD HH:mm:ss') : '—'}</Descriptions.Item>
            <Descriptions.Item label="完成">{selectedRun.completedAt ? dayjs(selectedRun.completedAt).format('YYYY-MM-DD HH:mm:ss') : '—'}</Descriptions.Item>
          </Descriptions>
        )}
        {stageLoading ? <Spin /> : (
          <Table
            columns={[
              { title: 'Stage', dataIndex: 'name', key: 'name' },
              { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusConfig[v]?.color || 'default'}>{v}</Tag> },
              { title: 'Started At', dataIndex: 'startedAt', key: 'startedAt' },
              { title: 'Duration', key: 'duration', render: (_: unknown, r: { durationMs?: number | string }) => formatDuration(typeof r.durationMs === 'string' ? parseInt(r.durationMs, 10) : r.durationMs ?? 0) },
            ]}
            dataSource={stageDetails as unknown[]}
            rowKey="id"
            pagination={false}
            size="small"
          />
        )}
      </Drawer>
    </div>
  );
}
