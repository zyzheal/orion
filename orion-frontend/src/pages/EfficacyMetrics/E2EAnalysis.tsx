import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Spin, Typography, Select, Table, Button, message } from 'antd';
import {
  CloudUploadOutlined,
  RocketOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  ReloadOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import MetricCard from '@/components/MetricCard';
import {
  getAllPipelineRuns,
  getPipelineRunStages,
  type PipelineRunSummary,
} from '@/api/pipelineRuns';
import { safePercent } from '@/utils/efficacyScore';

const { Title, Text } = Typography;
const { Option } = Select;

const E2EAnalysis: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<PipelineRunSummary[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadRuns();
  }, [refreshKey]);

  useEffect(() => {
    if (selectedRunId) loadStages(selectedRunId);
  }, [selectedRunId]);

  const loadRuns = async () => {
    setLoading(true);
    try {
      const res = await getAllPipelineRuns({ limit: 50 });
      const list = (res as any).data?.runs ?? (res as any).data ?? [];
      const sorted = (list as PipelineRunSummary[]).sort(
        (a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? '')
      );
      setRuns(sorted);
      if (sorted.length > 0 && !selectedRunId) {
        setSelectedRunId(sorted[0].id);
      }
    } catch {
      message.error('Failed to load pipeline runs');
    } finally {
      setLoading(false);
    }
  };

  const loadStages = async (runId: string) => {
    try {
      const res = await getPipelineRunStages(runId);
      const list = (res as any).data?.stages ?? (res as any).data ?? [];
      setStages(list as any[]);
    } catch {
      setStages([]);
    }
  };

  const totalRuns = runs.length;
  const successCount = runs.filter((r) => r.status === 'success').length;
  const successRate = safePercent(successCount, totalRuns, 0);
  const failedCount = runs.filter((r) => r.status === 'failed').length;

  const durations = runs.map((r) => Number(r.durationMs ?? 0)).filter((d) => d > 0);
  const avgDuration =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60000 * 10) / 10
      : 0;

  const topSlow = [...runs]
    .filter((r) => Number(r.durationMs ?? 0) > 0)
    .sort((a, b) => Number(b.durationMs ?? 0) - Number(a.durationMs ?? 0))
    .slice(0, 5);

  const runColumns = [
    { title: 'Pipeline', dataIndex: 'pipelineId', key: 'pipelineId', render: (v: string) => <Text code>{v}</Text> },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (v: string) => {
        const color = v === 'succeeded' ? colors.success[500] : v === 'failed' ? colors.error[500] : colors.warning[500];
        return <span style={{ color }}>{v}</span>;
      },
    },
    {
      title: '耗时', dataIndex: 'durationMs', key: 'durationMs',
      render: (v: number) =>
        v > 0 ? `${Math.round(v / 60000)}m ${Math.round((v % 60000) / 1000)}s` : '—',
    },
    { title: '触发', dataIndex: 'triggerType', key: 'triggerType' },
    { title: '开始时间', dataIndex: 'startedAt', key: 'startedAt' },
  ];

  const stageColumns = [
    { title: '阶段', dataIndex: 'stageName', key: 'stageName', render: (v: string) => v || '—' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (v: string) => {
        const color =
          v === 'succeeded' ? colors.success[500] : v === 'failed' ? colors.error[500] : colors.warning[500];
        return <span style={{ color }}>{v}</span>;
      },
    },
    { title: '耗时', dataIndex: 'durationMs', key: 'durationMs', render: (v: number) => (v > 0 ? `${Math.round(v / 1000)}s` : '—') },
  ];

  if (loading && refreshKey === 0) {
    return <div style={{ padding: spacing.lg, textAlign: 'center' }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <CloudUploadOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            端到端链路分析
          </Title>
          <Text type="secondary">Commit → Build → Test → Deploy → Production 全链路周期</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => setRefreshKey((k) => k + 1)} loading={loading}>
          刷新
        </Button>
      </div>

      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <MetricCard
            title="交付成功率"
            value={successRate}
            unit="%"
            icon={<RocketOutlined />}
            color={successRate > 90 ? colors.success[500] : colors.warning[500]}
            trend="up"
            trendPercent={3}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="平均交付周期"
            value={avgDuration}
            unit="分钟"
            icon={<ClockCircleOutlined />}
            color={colors.primary[500]}
            trend="down"
            trendPercent={5}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="总执行次数"
            value={totalRuns}
            icon={<ExperimentOutlined />}
            color={colors.info[500]}
            trend="up"
            trendPercent={8}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="失败次数"
            value={failedCount}
            icon={<AlertOutlined />}
            color={colors.error[500]}
            trend="down"
            trendPercent={2}
          />
        </Col>
      </Row>

      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={8}>
          <Card title="选择 Pipeline 查看链路">
            <Select
              style={{ width: '100%' }}
              value={selectedRunId || undefined}
              onChange={(v) => setSelectedRunId(v)}
              placeholder="选择最近执行的 Pipeline"
              loading={loading}
            >
              {runs.map((r) => (
                <Option key={r.id} value={r.id}>
                  {r.pipelineId} · {r.status} · {Number(r.durationMs ?? 0) > 0 ? `${Math.round(Number(r.durationMs ?? 0) / 60000)}m` : ''}
                </Option>
              ))}
            </Select>
          </Card>
        </Col>
        <Col span={16}>
          <Card title="链路阶段">
            <Table
              columns={stageColumns}
              dataSource={stages}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: <Text type="secondary">请选择 Pipeline 查看阶段详情</Text> }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Top 5 慢速交付" style={{ marginBottom: spacing.md }}>
        <Table columns={runColumns} dataSource={topSlow} rowKey="id" pagination={false} size="small" />
      </Card>

      <Card title="最近 Pipeline 执行记录">
        <Table
          columns={runColumns}
          dataSource={runs.slice(0, 15)}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: false }}
          size="small"
        />
      </Card>
    </div>
  );
};

export default E2EAnalysis;
