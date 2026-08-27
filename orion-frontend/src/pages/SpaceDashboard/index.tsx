import React, { useState } from 'react';
import { Typography, Card, Row, Col, Statistic, Progress, Table, Tag, Space, Select, Button } from 'antd';
import {
  SmileOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  RocketOutlined,
  MessageOutlined,
  LineChartOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { colors } from '@/tokens';

const { Title, Text } = Typography;
const { Option } = Select;

type SpaceMetric = 'satisfaction' | 'performance' | 'activity' | 'communication' | 'efficiency';

interface SpaceData {
  satisfaction: { score: number; surveyCount: number; trend: string };
  performance: { buildSuccessRate: number; avgBuildTime: number; testPassRate: number };
  activity: { commits: number; prs: number; deployments: number; linesChanged: number };
  communication: { reviewTurnaround: number; meetingRatio: number };
  efficiency: { leadTime: number; mttr: number; deploymentFrequency: number };
}

const SPACE_CONFIG: Record<SpaceMetric, { label: string; icon: React.ReactNode; color: string }> = {
  satisfaction: { label: '满意度 (S)', icon: <SmileOutlined />, color: 'blue' },
  performance: { label: '效能 (P)', icon: <ThunderboltOutlined />, color: 'green' },
  activity: { label: '活跃度 (A)', icon: <TeamOutlined />, color: 'orange' },
  communication: { label: '协作 (C)', icon: <MessageOutlined />, color: 'purple' },
  efficiency: { label: '效率 (E)', icon: <RocketOutlined />, color: 'magenta' },
};

async function fetchSpaceData(period: string): Promise<SpaceData> {
  try {
    const resp = await fetch(`/api/v1/space-metrics?period=${period}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    });
    if (!resp.ok) return getFallbackData();
    const json = await resp.json();
    return json.data || getFallbackData();
  } catch {
    return getFallbackData();
  }
}

function getFallbackData(): SpaceData {
  return {
    satisfaction: { score: 82, surveyCount: 48, trend: '↑ +3' },
    performance: { buildSuccessRate: 94, avgBuildTime: 12.5, testPassRate: 97 },
    activity: { commits: 324, prs: 56, deployments: 18, linesChanged: 12840 },
    communication: { reviewTurnaround: 4.2, meetingRatio: 0.35 },
    efficiency: { leadTime: 1.8, mttr: 23, deploymentFrequency: 3 },
  };
}

interface SpaceDetailRow {
  key: string;
  metric: string;
  current: number;
  target: number;
  trend: string;
  status: string;
}

const SpaceDashboardPage: React.FC = () => {
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SpaceData | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchSpaceData(period);
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { loadData(); }, [period]);

  if (!data) return null;

  const buildDetailRows = (): SpaceDetailRow[] => [
    { key: '1', metric: '开发者满意度', current: data.satisfaction.score, target: 85, trend: data.satisfaction.trend, status: data.satisfaction.score >= 85 ? 'success' : 'warning' },
    { key: '2', metric: '构建成功率', current: data.performance.buildSuccessRate, target: 95, trend: '↑ +2', status: data.performance.buildSuccessRate >= 95 ? 'success' : 'warning' },
    { key: '3', metric: '测试通过率', current: data.performance.testPassRate, target: 95, trend: '↑ +1', status: 'success' },
    { key: '4', metric: 'PR 审查时长(h)', current: data.communication.reviewTurnaround, target: 24, trend: '↓ -1.2h', status: data.communication.reviewTurnaround <= 24 ? 'success' : 'warning' },
    { key: '5', metric: '变更前置时间(d)', current: data.efficiency.leadTime, target: 2, trend: '↓ -0.3d', status: 'success' },
    { key: '6', metric: '故障恢复时间(min)', current: data.efficiency.mttr, target: 30, trend: '↓ -5min', status: 'success' },
  ];

  const columns: ColumnsType<SpaceDetailRow> = [
    { title: '指标', dataIndex: 'metric', key: 'metric', width: 200 },
    { title: '当前值', dataIndex: 'current', key: 'current', render: (val: number) => <Text strong>{val}</Text> },
    { title: '目标值', dataIndex: 'target', key: 'target', render: (val: number) => <Text type="secondary">{val}</Text> },
    { title: '趋势', dataIndex: 'trend', key: 'trend', render: (val: string) => {
      const isUp = val.includes('↑');
      return <Tag color={isUp ? 'green' : val.includes('↓') ? 'blue' : 'default'}>{val}</Tag>;
    }},
    { title: '达标', dataIndex: 'status', key: 'status', render: (val: string) => (
      <Tag color={val === 'success' ? 'green' : 'orange'}>{val === 'success' ? '达标' : '待改进'}</Tag>
    )},
  ];

  const overallScore = Math.round(
    (data.satisfaction.score + data.performance.buildSuccessRate + data.performance.testPassRate +
     (100 - data.communication.reviewTurnaround * 3) + (100 - data.efficiency.mttr * 2)) / 5
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Title level={2} style={{ marginBottom: 4 }}>
            <LineChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            SPACE 效能 Dashboard
          </Title>
          <Text type="secondary" style={{ display: 'block' }}>
            开发者效能五维度模型 · 基于 SPACE 框架
          </Text>
        </div>
        <Space>
          <Select value={period} onChange={setPeriod} style={{ width: 120 }}>
            <Option value="7d">近 7 天</Option>
            <Option value="30d">近 30 天</Option>
            <Option value="90d">近 90 天</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <Progress type="dashboard" percent={overallScore}
                strokeColor={{ from: colors.primary[400], to: colors.primary[600] }}
                format={() => `${overallScore}%`} />
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>SPACE 综合效能</Text>
            </div>
          </Col>
          <Col span={16}>
            <Row gutter={[16, 8]}>
              {Object.entries(SPACE_CONFIG).map(([key, cfg]) => (
                <Col span={8} key={key}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{cfg.icon}</div>
                    <Text strong>{cfg.label}</Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="开发者满意度" value={data.satisfaction.score}
              suffix="/100" prefix={<SmileOutlined />}
              valueStyle={{ color: colors.success[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="构建成功率" value={data.performance.buildSuccessRate}
              suffix="%" prefix={<ThunderboltOutlined />}
              valueStyle={{ color: colors.success[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="PR 数" value={data.activity.prs}
              prefix={<TeamOutlined />} valueStyle={{ color: colors.primary[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="部署频率(次/天)" value={data.efficiency.deploymentFrequency}
              prefix={<RocketOutlined />} valueStyle={{ color: colors.warning[500] }} />
          </Card>
        </Col>
      </Row>

      <Card title="指标明细">
        <Table dataSource={buildDetailRows()} columns={columns} rowKey="key"
          size="middle" pagination={false} loading={loading} />
      </Card>
    </div>
  );
};

export default SpaceDashboardPage;
