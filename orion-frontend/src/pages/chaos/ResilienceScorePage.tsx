/**
 * Resilience Score Page
 * Displays resilience scores, trends, and MTTR metrics per service
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Statistic,
  Row,
  Col,
  Select,
  Typography,
  Progress,
} from 'antd';
import {
  SafetyOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  FallOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import { resilienceApi, ResilienceScore } from '@/api/chaos';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title } = Typography;

const trendConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  improving: { color: colors.success[500], icon: <RiseOutlined />, label: '提升中' },
  stable: { color: colors.info[500], icon: <MinusOutlined />, label: '稳定' },
  degrading: { color: colors.error[500], icon: <FallOutlined />, label: '下降中' },
};

export default function ResilienceScorePage() {
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<ResilienceScore | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [days, setDays] = useState(30);

  const fetchScore = async () => {
    setLoading(true);
    try {
      const data = await resilienceApi.getScore();
      setScore(data);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await resilienceApi.getHistory({ days });
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      // silently handle
    }
  };

  useEffect(() => {
    fetchScore();
    fetchHistory();
  }, [days]);

  const getScoreColor = (s: number) => {
    if (s >= 90) return colors.success[500];
    if (s >= 70) return colors.warning[500];
    return colors.error[500];
  };

  const historyColumns = [
    {
      title: '日期',
      dataIndex: 'calculated_at',
      key: 'calculated_at',
      render: (v: string) => v ? new Date(v).toLocaleDateString() : '-',
    },
    {
      title: '弹性评分',
      dataIndex: 'score',
      key: 'score',
      render: (v: number) => (
        <Progress
          percent={v}
          size="small"
          strokeColor={getScoreColor(v)}
          format={(p) => `${p}`}
        />
      ),
    },
    {
      title: 'MTTR',
      dataIndex: 'mttr_ms',
      key: 'mttr_ms',
      render: (v: number) => v ? `${(v / 1000).toFixed(1)}s` : '-',
    },
    {
      title: '成功率',
      dataIndex: 'success_rate',
      key: 'success_rate',
      render: (v: number) => v ? `${(v * 100).toFixed(1)}%` : '-',
    },
    {
      title: '趋势',
      dataIndex: 'trend',
      key: 'trend',
      render: (v: string) => {
        const cfg = trendConfig[v] || trendConfig.stable;
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <SafetyOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        弹性评分
      </Title>

      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="当前弹性评分"
              value={score?.score ?? 0}
              suffix="/ 100"
              valueStyle={{ color: getScoreColor(score?.score ?? 0) }}
              prefix={<SafetyOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均恢复时间"
              value={score?.mttr_ms ? (score.mttr_ms / 1000).toFixed(1) : 0}
              suffix="秒"
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="实验成功率"
              value={score?.success_rate ? (score.success_rate * 100).toFixed(1) : 0}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="错误预算"
              value={score?.error_budget ?? 0}
              suffix="%"
              valueStyle={{ color: (score?.error_budget ?? 0) > 10 ? colors.success[500] : colors.error[500] }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="弹性评分趋势"
        extra={
          <Select value={days} onChange={setDays} style={{ width: 120 }}>
            <Select.Option value={7}>近 7 天</Select.Option>
            <Select.Option value={30}>近 30 天</Select.Option>
            <Select.Option value={90}>近 90 天</Select.Option>
          </Select>
        }
      >
        <Table
          dataSource={history}
          columns={historyColumns}
          rowKey={(_r, i) => i?.toString() ?? '0'}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}
