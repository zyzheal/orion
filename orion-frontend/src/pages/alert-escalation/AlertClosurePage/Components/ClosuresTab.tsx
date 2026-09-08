/**
 * ClosuresTab.tsx - 告警闭环 Tab（含状态筛选）
 * 抽取自 index.tsx (P2-9 Phase 235)
 */
import React from 'react';
import { Button, Card, Empty, Select, Space, Table } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { TableProps } from 'antd';

const { Option } = Select;

interface Props {
  columns: TableProps<any>['columns'];
  dataSource: any[];
  loading: boolean;
  policyStatus?: string;
  setPolicyStatus: (v: string) => void;
  onLoadClosures: () => void;
}

export const ClosuresTab: React.FC<Props> = ({
  columns,
  dataSource,
  loading,
  policyStatus,
  setPolicyStatus,
  onLoadClosures,
}) => (
  <Card
    title="告警闭环"
    extra={
      <Space>
        <Select
          style={{ width: 120 }}
          value={policyStatus}
          onChange={setPolicyStatus}
          allowClear
          placeholder="状态"
        >
          <Option value="pending">待确认</Option>
          <Option value="acknowledged">已确认</Option>
          <Option value="resolved">已解决</Option>
        </Select>
        <Button
          icon={<ReloadOutlined />}
          size="small"
          onClick={onLoadClosures}
          loading={loading}
        >
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
      size="small"
      locale={{ emptyText: <Empty description="暂无告警记录" /> }}
      pagination={{ pageSize: 10 }}
    />
  </Card>
);
