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
      role="region"
      aria-label="评测集列表"
      aria-busy={loading || seeding}
      extra={
        <Space>
          {sets.length === 0 && (
            <Button
              icon={<RocketOutlined />}
              loading={seeding}
              onClick={onSeed}
              aria-label="初始化演示数据"
              tabIndex={0}
            >
              初始化演示数据
            </Button>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={onRefresh}
            aria-label="刷新评测集列表"
            tabIndex={0}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onCreate}
            aria-label="新建评测集"
            tabIndex={0}
          >
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
        locale={
          {
            emptyText: (
              <div role="status" aria-live="polite" aria-atomic="true">
                <Empty description="暂无评测集，点击「新建评测集」创建" />
              </div>
            ),
          } as any
        }
      />
    </Card>
  );
}
