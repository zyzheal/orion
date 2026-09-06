/**
 * 运维工具 - 日志管理 Tab
 */
import React from 'react';
import { Card, Table, Button, Space, Typography, Select } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { logColumns } from '../columns';
import { LOG_LEVEL_OPTIONS, LOG_SERVICE_OPTIONS } from '../config';
import type { LogEntry } from '@/api/ops-tools';

const { Text } = Typography;

interface LogTabProps {
  logs: LogEntry[];
  logTotal: number;
  logLevel: string | undefined;
  onLogLevelChange: (v: string | undefined) => void;
  logService: string | undefined;
  onLogServiceChange: (v: string | undefined) => void;
  onRefresh: () => void;
}

export const LogTab: React.FC<LogTabProps> = ({
  logs,
  logTotal,
  logLevel,
  onLogLevelChange,
  logService,
  onLogServiceChange,
  onRefresh,
}) => (
  <Card
    title="日志管理"
    extra={
      <Button icon={<ReloadOutlined />} onClick={onRefresh}>
        刷新
      </Button>
    }
    style={{ marginTop: spacing.md }}
  >
    <Space style={{ marginBottom: spacing.md }}>
      <Text>级别:</Text>
      <Select
        style={{ width: 120 }}
        placeholder="全部"
        allowClear
        value={logLevel}
        onChange={onLogLevelChange}
        options={[LOG_LEVEL_OPTIONS].slice()}
      />
      <Text style={{ marginLeft: 16 }}>服务:</Text>
      <Select
        style={{ width: 200 }}
        placeholder="全部"
        allowClear
        value={logService}
        onChange={onLogServiceChange}
        options={[LOG_SERVICE_OPTIONS].slice()}
      />
    </Space>
    <Table
      columns={logColumns}
      dataSource={logs}
      rowKey="id"
      size="middle"
      pagination={{ total: logTotal, pageSize: 10 }}
    />
  </Card>
);
