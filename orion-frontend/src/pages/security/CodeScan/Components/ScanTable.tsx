/**
 * CodeScan scan tasks table
 */
import React from 'react';
import { Button, Card, Empty, Space, Table } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { spacing } from '@/tokens';
import type { ScanRecord } from '../types';

interface ScanTableProps {
  dataSource: ScanRecord[];
  columns: ColumnsType<ScanRecord>;
  loading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
}

export const ScanTable: React.FC<ScanTableProps> = ({
  dataSource,
  columns,
  loading,
  onRefresh,
  onCreate,
}) => (
  <Card
    title="扫描任务列表"
    extra={
      <Space>
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          刷新
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          新建扫描
        </Button>
      </Space>
    }
    style={{ marginBottom: spacing.md }}
  >
    <Table
      dataSource={dataSource}
      columns={columns}
      rowKey="id"
      loading={loading}
      size="small"
      pagination={false}
      locale={{
        emptyText: <Empty description="暂无代码扫描任务，请创建扫描任务执行 SAST 分析" />,
      }}
    />
  </Card>
);
