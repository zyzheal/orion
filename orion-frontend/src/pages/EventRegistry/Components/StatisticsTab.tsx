/**
 * EventRegistry Statistics tab
 * 抽取自 index.tsx (P2-9 Phase 166)
 */
import { Badge, Button, Card, Empty, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import MetricCard from '@/components/MetricCard';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import type { StatisticsData } from '../types';
import { triggerTypeIconMap, getTypeColor } from '../constants';

const { Text } = Typography;

interface StatisticsTabProps {
  statistics: StatisticsData | null;
  loading: boolean;
  onTestMatch: () => void;
}

const colorMap: Record<string, string> = {
  blue: colors.primary[500],
  purple: colors.purple[500],
  orange: colors.warning[500],
  green: colors.success[500],
  default: colors.neutral[500],
};

export const StatisticsTab = ({ statistics, loading, onTestMatch }: StatisticsTabProps) => (
  <div>
    {statistics && (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: spacing.md,
          marginBottom: spacing.lg,
        }}
      >
        <MetricCard
          title="总触发器"
          value={statistics.totalTriggers}
          color={colors.primary[500]}
          size="medium"
        />
        {Object.entries(statistics.byType).map(([type, count]) => {
          const colorKey = getTypeColor(type);
          return (
            <MetricCard
              key={type}
              title={`${type} 触发器`}
              value={count.enabled}
              unit={`/ ${count.total}`}
              icon={triggerTypeIconMap[type]}
              color={colorMap[colorKey] || colors.neutral[500]}
              size="medium"
            />
          );
        })}
      </div>
    )}

    <Card
      title={
        <Space>
          <Text strong>触发器详情</Text>
          <Text type="secondary">({statistics?.triggers.length || 0})</Text>
        </Space>
      }
    >
      <Table
        columns={[
          {
            key: 'triggerName',
            title: '触发器名称',
            dataIndex: 'triggerName',
            width: 200,
            render: (v: unknown) => <Text strong>{String(v)}</Text>,
          },
          {
            key: 'type',
            title: '类型',
            dataIndex: 'type',
            width: 120,
            render: (v: unknown) => (
              <Space>
                {triggerTypeIconMap[String(v)]}
                <Tag color={getTypeColor(String(v))}>{String(v)}</Tag>
              </Space>
            ),
          },
          {
            key: 'enabled',
            title: '状态',
            dataIndex: 'enabled',
            width: 100,
            render: (v: unknown) =>
              v ? (
                <Badge status="success" text="启用" />
              ) : (
                <Badge status="default" text="禁用" />
              ),
          },
          {
            key: 'eventType',
            title: '事件类型',
            dataIndex: 'eventType',
            width: 200,
            render: (v: unknown) =>
              v ? <Tag color="blue">{String(v)}</Tag> : <Text type="secondary">-</Text>,
          },
          {
            key: 'cronExpression',
            title: 'Cron 表达式',
            dataIndex: 'cronExpression',
            width: 150,
            render: (v: unknown) =>
              v ? <Text code>{String(v)}</Text> : <Text type="secondary">-</Text>,
          },
        ]}
        dataSource={statistics?.triggers || []}
        loading={loading}
        rowKey="triggerId"
        size="middle"
        pagination={
          {
            pageSize: 10,
          } as any
        }
        locale={
          {
            emptyText: (
              <Empty description="暂无触发器">
                <Button type="primary" icon={<PlusOutlined />} onClick={onTestMatch}>
                  测试事件匹配
                </Button>
              </Empty>
            ),
          } as any
        }
      />
    </Card>
  </div>
);
