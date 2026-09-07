/**
 * PromptCanary PromptTable
 * 抽取自 index.tsx (P2-9 Phase 183)
 */
import { Card, Table, Button, Space, Empty } from 'antd';
import { ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { PromptCanaryStatus } from '../types';

interface PromptTableProps {
  columns: ColumnsType<PromptCanaryStatus>;
  dataSource: PromptCanaryStatus[];
  loading: boolean;
  onRefresh: () => void;
  onPublish: () => void;
}

export const PromptTable = ({ columns, dataSource, loading, onRefresh, onPublish }: PromptTableProps) => (
  <Card
    title="Prompt 列表"
    extra={
      <Space>
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          刷新
        </Button>
        <Button type="primary" icon={<ThunderboltOutlined />} onClick={onPublish}>
          发布 Canary
        </Button>
      </Space>
    }
  >
    <Table
      dataSource={dataSource}
      columns={columns}
      rowKey="name"
      loading={loading}
      size="small"
      pagination={false}
      locale={{ emptyText: <Empty description="暂无 Prompt 配置" /> }}
    />
  </Card>
);
