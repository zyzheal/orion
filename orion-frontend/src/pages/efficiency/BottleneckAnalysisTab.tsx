/**
 * BottleneckAnalysisTab.tsx - 瓶颈分析 Tab
 * 抽取自 efficiency/EfficiencyPage.tsx (P2-9 Phase 76)
 */
import React from 'react';
import { Typography, Table, Tag, Space, Card, Button, Alert } from 'antd';
import {
  WarningOutlined,
  ReloadOutlined,
  TeamOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { useQuery } from '@/providers/QueryProvider';
import { getBottlenecks, getTeamComparison, getTeams, type TeamMetrics } from '@/api/efficiency';

const { Text } = Typography;

interface BottleneckItem {
  id: string;
  category: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  metric: string;
  currentValue: string;
  targetValue: string;
  suggestion: string;
}

const BottleneckAnalysisTab: React.FC = () => {
  const {
    data: bottlenecks = [] as BottleneckItem[],
    isLoading: loading,
  } = useQuery<BottleneckItem[]>({
    queryKey: ['efficiency-bottlenecks'],
    queryFn: async () => {
      const res = await getBottlenecks();
      return res.data?.bottlenecks || [];
    },
    staleTime: 30_000,
  });

  const {
    data: teamComparison = [] as TeamMetrics[],
    isLoading: teamLoading,
    refetch: refetchTeamComparison,
  } = useQuery<TeamMetrics[]>({
    queryKey: ['efficiency-team-comparison'],
    queryFn: async () => {
      const [teamsRes, comparisonRes] = await Promise.all([
        getTeams(),
        getTeamComparison({ interval: 'weekly' }),
      ]);
      const teamIds = teamsRes.data?.teams?.map((t: { teamId: string }) => t.teamId) || [];
      return teamIds.length > 0 ? comparisonRes.data?.teams || [] : [];
    },
    staleTime: 30_000,
  });

  const impactColorMap: Record<string, string> = {
    high: 'error',
    medium: 'warning',
    low: 'info',
  };

  const impactLabelMap: Record<string, string> = {
    high: '高',
    medium: '中',
    low: '低',
  };

  const bottleneckColumns = [
    {
      title: '瓶颈类别',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (v: string) => <Tag color="purple">{v}</Tag>,
    },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '影响度',
      dataIndex: 'impact',
      key: 'impact',
      width: 80,
      render: (v: string) => <Tag color={impactColorMap[v]}>{impactLabelMap[v]}</Tag>,
    },
    {
      title: '当前值',
      dataIndex: 'currentValue',
      key: 'currentValue',
      width: 80,
      render: (v: string) => <Text type="danger">{v}</Text>,
    },
    {
      title: '目标值',
      dataIndex: 'targetValue',
      key: 'targetValue',
      width: 80,
      render: (v: string) => <Text type="success">{v}</Text>,
    },
    { title: '优化建议', dataIndex: 'suggestion', key: 'suggestion' },
  ];

  const teamColumns = [
    {
      title: '团队',
      dataIndex: 'teamName',
      key: 'teamName',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: '等级',
      dataIndex: 'level',
      key: 'level',
      render: (v: string) => (
        <Tag
          color={
            v === 'elite'
              ? 'success'
              : v === 'high'
                ? 'blue'
                : v === 'medium'
                  ? 'warning'
                  : 'default'
          }
        >
          {v}
        </Tag>
      ),
    },
    {
      title: '评分',
      dataIndex: 'score',
      key: 'score',
      render: (v: number) => <Text strong>{v}</Text>,
    },
    {
      title: '部署频率',
      key: 'depFreq',
      render: (r: TeamMetrics) => `${r.metrics.deploymentFrequency?.toFixed(1)} 次/周`,
    },
    {
      title: '前置时间',
      key: 'leadTime',
      render: (r: TeamMetrics) =>
        r.metrics.leadTimeMinutes ? `${r.metrics.leadTimeMinutes} min` : '-',
    },
    {
      title: 'MTTR',
      key: 'mttr',
      render: (r: TeamMetrics) => (r.metrics.mttrMinutes ? `${r.metrics.mttrMinutes} min` : '-'),
    },
    {
      title: '失败率',
      key: 'failRate',
      render: (r: TeamMetrics) => `${r.metrics.changeFailureRate?.toFixed(1)}%`,
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Bottleneck Table */}
      <Card
        title={
          <span>
            <WarningOutlined style={{ color: colors.warning[500] }} /> 效能瓶颈分析
          </span>
        }
      >
        <Table
          columns={bottleneckColumns}
          dataSource={bottlenecks}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={false}
        />
      </Card>

      {/* Team Comparison */}
      <Card
        title={
          <span>
            <TeamOutlined /> 团队效能对比
          </span>
        }
        extra={
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => refetchTeamComparison()}
            loading={teamLoading}
          >
            刷新
          </Button>
        }
      >
        <Table
          columns={teamColumns}
          dataSource={teamComparison}
          rowKey="teamId"
          loading={teamLoading}
          size="middle"
          pagination={false}
        />
      </Card>

      {/* Recommendations */}
      <Card
        title={
          <span>
            <LineChartOutlined /> 改进建议
          </span>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            message="优先处理高影响度瓶颈"
            description="建议优先解决「代码评审等待时间」和「构建失败率」两个高影响度瓶颈，预计可提升整体交付效率 30% 以上"
            type="warning"
            showIcon
          />
          <Alert
            message="持续改进"
            description="建议建立定期效能回顾机制，每月分析 DORA 指标趋势，识别新的瓶颈"
            type="info"
            showIcon
          />
        </Space>
      </Card>
    </Space>
  );
};

export default BottleneckAnalysisTab;
