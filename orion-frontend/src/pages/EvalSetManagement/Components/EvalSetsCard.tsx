import { Button, Space, Card, Table, Empty } from 'antd';
import { RocketOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';

interface Props {
  sets: any[];
  setColumns: any;
  loading: boolean;
  seeding: boolean;
  onSeed: () => void;
  onRefresh: () => void;
  onCreate: () => void;
}

export function EvalSetsCard({ sets, setColumns, loading, seeding, onSeed, onRefresh, onCreate }: Props) {
  return (
    <Card
      title="评测集列表"
      extra={
        <Space>
          {sets.length === 0 && (
            <Button icon={<RocketOutlined />} loading={seeding} onClick={onSeed}>
              初始化演示数据
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={onRefresh}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            新建评测集
          </Button>
        </Space>
      }
      style={{ marginBottom: spacing.md }}
    >
      <Table
        dataSource={sets}
        columns={setColumns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={false}
        locale={{ emptyText: <Empty description="暂无评测集，点击「新建评测集」创建" /> }}
      />
    </Card>
  );
}
