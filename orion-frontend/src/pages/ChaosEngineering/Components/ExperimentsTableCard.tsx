/**
 * ExperimentsTableCard.tsx - 实验列表卡
 * 抽取自 index.tsx (P2-9 Phase 232)
 */
import React from 'react';
import { Button, Card, Space, Table } from 'antd';
import type { TableProps } from 'antd';
import { PlusOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';

interface Props {
  columns: TableProps<any>['columns'];
  dataSource: any[];
  loading: boolean;
  onCreate: () => void;
  onRefresh: () => void;
}

export const ExperimentsTableCard: React.FC<Props> = ({
  columns,
  dataSource,
  loading,
  onCreate,
  onRefresh,
}) => (
  <Card
    title={
      <>
        <ThunderboltOutlined style={{ marginRight: spacing.sm }} />
        混沌实验列表
      </>
    }
    extra={
      <Space>
        <Button icon={<PlusOutlined />} type="primary" onClick={onCreate}>
          创建实验
        </Button>
        <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
          刷新
        </Button>
      </Space>
    }
  >
    <Table
      columns={columns}
      dataSource={dataSource}
      rowKey="id"
      loading={loading}
      pagination={{ pageSize: 10, showSizeChanger: true }}
    />
  </Card>
);
