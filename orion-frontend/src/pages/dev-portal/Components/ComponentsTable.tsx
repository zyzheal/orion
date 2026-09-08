/**
 * ComponentsTable.tsx - 组件目录表格
 * 抽取自 index.tsx (P2-9 Phase 241)
 */
import { Card, Table, Tag, Button, Space, Progress, Empty, Typography } from 'antd';
import {
  AppstoreOutlined,
  StarOutlined,
  FileTextOutlined,
  GithubOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import type { ColumnsType } from 'antd/es/table';
import type { ServiceComponent } from '../useDevPortalState';

const { Text } = Typography;

interface Props {
  components: ServiceComponent[];
  onView: (c: ServiceComponent) => void;
  onOpenRepo: (c: ServiceComponent) => void;
}

export function ComponentsTable({ components, onView, onOpenRepo }: Props) {
  const columns: ColumnsType<ServiceComponent> = [
    {
      title: '组件名称',
      key: 'name',
      render: (_: unknown, r: ServiceComponent) => (
        <Space>
          <AppstoreOutlined style={{ color: colors.primary[500] }} />
          <Text strong style={{ cursor: 'pointer' }} onClick={() => onView(r)}>
            {r.name}
          </Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (v: string) => (
        <Tag color={v === 'service' ? 'blue' : v === 'library' ? 'green' : v === 'site' ? 'purple' : 'orange'}>{v}</Tag>
      ),
    },
    {
      title: '拥有团队',
      dataIndex: 'owner',
      key: 'owner',
      width: 120,
      render: (v: string) => <Tag color="default">{v}</Tag>,
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      key: 'lifecycle',
      width: 100,
      render: (v: string) => (
        <Tag color={v === 'production' ? 'green' : v === 'experimental' ? 'orange' : 'red'}>{v}</Tag>
      ),
    },
    {
      title: '健康度',
      key: 'health',
      width: 100,
      render: (_: unknown, r: ServiceComponent) => (
        <Progress
          type="line"
          size="small"
          percent={r.health}
          format={() => `${r.health}%`}
          strokeColor={r.health >= 90 ? colors.success[500] : r.health >= 70 ? colors.warning[500] : colors.error[500]}
        />
      ),
    },
    {
      title: '文档',
      dataIndex: 'techDocs',
      key: 'techDocs',
      width: 60,
      render: (v: boolean) =>
        v ? <StarOutlined style={{ color: colors.success[500] }} /> : <FileTextOutlined style={{ color: '#d9d9d9' }} />,
    },
    { title: '最后部署', dataIndex: 'lastDeployed', key: 'lastDeployed', width: 120 },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, r: ServiceComponent) => (
        <Space size="small">
          <Button size="small" icon={<GithubOutlined />} onClick={() => onOpenRepo(r)}>Repo</Button>
        </Space>
      ),
    },
  ];

  return (
    <Card title="组件目录">
      <Table
        dataSource={components}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="暂无组件" /> }}
      />
    </Card>
  );
}
