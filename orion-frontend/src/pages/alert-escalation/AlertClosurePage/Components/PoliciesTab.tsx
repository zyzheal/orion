/**
 * PoliciesTab.tsx - 升级策略 Tab（策略表 + 触发器表）
 * 抽取自 index.tsx (P2-9 Phase 235)
 */
import React from 'react';
import { Button, Card, Empty, Space, Table } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { TableProps } from 'antd';

interface Props {
  policyColumns: TableProps<any>['columns'];
  triggerColumns: TableProps<any>['columns'];
  policies: any[];
  triggers: any[];
  loading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
  onLoadTriggers: () => void;
}

export const PoliciesTab: React.FC<Props> = ({
  policyColumns,
  triggerColumns,
  policies,
  triggers,
  loading,
  onRefresh,
  onCreate,
  onLoadTriggers,
}) => (
  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
    <Card
      title="升级策略"
      extra={
        <Space>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={onRefresh}
            loading={loading}
          >
            刷新
          </Button>
          <Button type="primary" size="small" onClick={onCreate}>
            新建策略
          </Button>
        </Space>
      }
    >
      <Table
        columns={policyColumns}
        dataSource={policies}
        rowKey="id"
        loading={loading}
        size="small"
        locale={{ emptyText: <Empty description="暂无升级策略" /> }}
        pagination={{ pageSize: 10 }}
      />
    </Card>
    <Card
      title="升级触发器"
      extra={
        <Button icon={<ReloadOutlined />} size="small" onClick={onLoadTriggers}>
          刷新
        </Button>
      }
    >
      <Table
        columns={triggerColumns}
        dataSource={triggers}
        rowKey="id"
        size="small"
        locale={{ emptyText: <Empty description="暂无触发记录" /> }}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  </Space>
);
