/**
 * EventRegistry Subscriptions tab
 * 抽取自 index.tsx (P2-9 Phase 166)
 */
import { Badge, Button, Card, Empty, Table, Tag, Tooltip, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens/spacing';
import type { Subscription } from '@/api/event-registry';

const { Text } = Typography;

interface SubscriptionsTabProps {
  subscriptions: Subscription[];
  loading: boolean;
  onTestMatch: () => void;
}

export const SubscriptionsTab = ({ subscriptions, loading, onTestMatch }: SubscriptionsTabProps) => (
  <div>
    <Text type="secondary" style={{ marginBottom: spacing.md, display: 'block' }}>
      当前已订阅事件触发的触发器列表
    </Text>
    <Card>
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
            key: 'eventType',
            title: '事件类型',
            dataIndex: 'eventType',
            width: 220,
            render: (v: unknown) => <Tag color="blue">{String(v)}</Tag>,
          },
          {
            key: 'workflowId',
            title: '工作流 ID',
            dataIndex: 'workflowId',
            width: 150,
            render: (v: unknown) => (
              <Text code style={{ fontSize: 11 }}>
                {String(v)}
              </Text>
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
            key: 'eventFilter',
            title: '事件过滤器',
            dataIndex: 'eventFilter',
            render: (v: unknown) =>
              v ? (
                <Tooltip title={JSON.stringify(v)}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {JSON.stringify(v).slice(0, 50)}...
                  </Text>
                </Tooltip>
              ) : (
                <Text type="secondary">无</Text>
              ),
          },
        ]}
        dataSource={subscriptions}
        loading={loading}
        rowKey="triggerId"
        size="middle"
        locale={
          {
            emptyText: (
              <Empty description="暂无订阅">
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
