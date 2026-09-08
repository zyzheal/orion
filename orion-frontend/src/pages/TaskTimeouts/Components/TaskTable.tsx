/**
 * TaskTimeouts TaskTable
 * 抽取自 index.tsx (P2-9 Phase 200)
 */
import { Button, Card, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ClockCircleOutlined, SyncOutlined } from '@ant-design/icons';
import type { TimedOutTask } from '@/api/task-timeout';

interface Props {
  timedOutTasks: TimedOutTask[];
  loading: boolean;
  columns: ColumnsType<TimedOutTask>;
  onRefresh: () => void;
}

export const TaskTable = ({ timedOutTasks, loading, columns, onRefresh }: Props) => (
  <Card
    title={
      <Space>
        <ClockCircleOutlined />
        <span>超时任务列表</span>
        <Tag color={timedOutTasks.length > 0 ? 'error' : 'success'}>{timedOutTasks.length}</Tag>
      </Space>
    }
    style={{ borderRadius: 12 }}
    extra={
      <Button icon={<SyncOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    }
  >
    <Table
      columns={columns}
      dataSource={timedOutTasks}
      rowKey={(record) => record.task.id}
      loading={loading}
      pagination={{
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total) => `共 ${total} 个超时任务`,
      }}
      locale={{
        emptyText: timedOutTasks.length === 0 ? '暂无超时任务' : '加载中...',
      }}
    />
  </Card>
);
