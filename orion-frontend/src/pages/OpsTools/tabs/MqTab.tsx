/**
 * 运维工具 - MQ 消息队列监控 Tab
 */
import React from 'react';
import { Card, Table, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { mqColumns } from '../columns';

interface MqTabProps {
  onRefresh: () => void;
}

export const MqTab: React.FC<MqTabProps> = ({ onRefresh }) => (
  <Card
    title="MQ 消息队列监控"
    extra={
      <Button icon={<ReloadOutlined />} onClick={onRefresh}>
        刷新
      </Button>
    }
    style={{ marginTop: spacing.md }}
  >
    <Table columns={mqColumns} dataSource={[]} rowKey="name" size="middle" pagination={false} />
  </Card>
);
