/**
 * 运维工具 - 定时调度 Tab
 */
import React from 'react';
import { Card, Table, Button, Space } from 'antd';
import { ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { CronJob, TableColumnsType } from 'antd';

interface CronTabProps {
  cronColumns: TableColumnsType<CronJob>;
  cronJobs: CronJob[];
  cronLoading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
}

export const CronTab: React.FC<CronTabProps> = ({
  cronColumns,
  cronJobs,
  cronLoading,
  onRefresh,
  onCreate,
}) => (
  <Card
    title="系统定时调度管理"
    extra={
      <Space>
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          刷新
        </Button>
        <Button icon={<PlusOutlined />} onClick={onCreate}>
          新建定时任务
        </Button>
      </Space>
    }
    style={{ marginTop: spacing.md }}
  >
    <Table
      columns={cronColumns}
      dataSource={cronJobs}
      loading={cronLoading}
      rowKey="id"
      size="middle"
      pagination={{ pageSize: 10 }}
    />
  </Card>
);
