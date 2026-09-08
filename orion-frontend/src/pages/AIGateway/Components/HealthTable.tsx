/**
 * HealthTable - 场景健康监控表
 * 抽取自 index.tsx (P2-9 Phase 219)
 */
import { useMemo } from 'react';
import { Card, Empty, Space, Table, Tag, Progress, Typography } from 'antd';
import {
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import { spacing } from '@/tokens';
import type { AIGatewayHealth } from '@/api/ai-gateway';

const { Text } = Typography;

interface HealthRecord {
  key: string;
  scenario: string;
  circuitState: string;
  isHealthy: boolean;
  totalRequests: number;
  errorRate: string;
  avgLatency: number;
  degradationActive: boolean;
}

const circuitStateColor = (state: string): string => {
  switch (state) {
    case 'CLOSED':
      return 'green';
    case 'OPEN':
      return 'red';
    case 'HALF_OPEN':
      return 'orange';
    default:
      return 'default';
  }
};

interface Props {
  healthData: AIGatewayHealth[];
  loading: boolean;
}

export const HealthTable = ({ healthData, loading }: Props) => {
  const columns = useMemo(
    () => [
      {
        title: '场景',
        dataIndex: 'scenario',
        key: 'scenario',
        render: (text: string) => (
          <Space>
            <ThunderboltOutlined />
            <Text strong>{text}</Text>
          </Space>
        ),
      },
      {
        title: '熔断状态',
        dataIndex: 'circuitState',
        key: 'circuitState',
        render: (state: string) => (
          <Tag color={circuitStateColor(state)}>
            {state === 'CLOSED' ? '正常' : state === 'OPEN' ? '熔断' : '半开'}
          </Tag>
        ),
      },
      {
        title: '健康状态',
        dataIndex: 'isHealthy',
        key: 'isHealthy',
        render: (healthy: boolean) =>
          healthy ? (
            <Tag color="green">
              <CheckCircleOutlined /> 健康
            </Tag>
          ) : (
            <Tag color="red">
              <CloseCircleOutlined /> 异常
            </Tag>
          ),
      },
      {
        title: '总请求数',
        dataIndex: ['metrics', 'totalRequests'],
        key: 'totalRequests',
      },
      {
        title: '错误率',
        dataIndex: ['metrics', 'errorRate'],
        key: 'errorRate',
        render: (rate: number) => (
          <Progress
            percent={(rate || 0) * 100}
            strokeColor={
              rate > 0.15
                ? colors.error[500]
                : rate > 0.05
                  ? colors.warning[500]
                  : colors.success[500]
            }
            format={(percent) => `${((percent ?? 0) / 100).toFixed(2)}`}
            size="small"
          />
        ),
      },
      {
        title: '平均延迟 (ms)',
        dataIndex: ['metrics', 'avgLatency'],
        key: 'avgLatency',
        render: (latency: number) => `${Math.round(latency)}ms`,
      },
      {
        title: '降级状态',
        dataIndex: 'degradationActive',
        key: 'degradationActive',
        render: (active: boolean) =>
          active ? <Tag color="orange">已激活</Tag> : <Tag color="default">未激活</Tag>,
      },
    ],
    []
  );

  const tableData: HealthRecord[] = useMemo(
    () =>
      healthData.map((h) => ({
        key: h.scenario,
        scenario: h.scenario,
        circuitState: h.circuitState,
        isHealthy: h.isHealthy,
        totalRequests: h.metrics?.totalRequests || 0,
        errorRate: ((h.metrics?.errorRate || 0) * 100).toFixed(2) + '%',
        avgLatency: Math.round(h.metrics?.avgLatency || 0),
        degradationActive: h.degradationActive,
      })),
    [healthData]
  );

  return (
    <Card title="场景健康监控" style={{ marginTop: spacing.lg, gridColumn: '1 / -1' }}>
      {tableData.length > 0 ? (
        <Table columns={columns} dataSource={tableData} loading={loading} pagination={false} />
      ) : (
        !loading && <Empty description="暂无场景健康数据" />
      )}
    </Card>
  );
};
