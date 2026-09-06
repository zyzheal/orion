/**
 * ExecutionHistoryDrawer - 执行历史 Drawer
 * 显示作业详情 (Descriptions) + 执行记录表 (Table)
 */
import React from 'react';
import {
  Drawer,
  Button,
  Typography,
  Descriptions,
  Tag,
  Switch,
  Table,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { AutoJob, JobExecutionRecord } from '@/api/automation';
import { spacing } from '@/tokens';
import { JOB_TYPE_MAP, JOB_STATUS_MAP } from './constants';
import { execColumns } from './ExecutionHistoryColumns';

const { Text } = Typography;

export interface ExecutionHistoryDrawerProps {
  open: boolean;
  currentJob: AutoJob | null;
  executions: JobExecutionRecord[];
  execLoading: boolean;
  onClose: () => void;
  onRefresh: (job: AutoJob) => void;
}

export const ExecutionHistoryDrawer: React.FC<ExecutionHistoryDrawerProps> = ({
  open,
  currentJob,
  executions,
  execLoading,
  onClose,
  onRefresh,
}) => (
  <Drawer
    title={
      <div>
        <Text strong>{currentJob?.name}</Text> <Text type="secondary">— 执行历史</Text>
      </div>
    }
    open={open}
    onClose={onClose}
    width={720}
    extra={
      <Button
        icon={<ReloadOutlined />}
        loading={execLoading}
        disabled={execLoading}
        onClick={() => {
          if (currentJob) onRefresh(currentJob);
        }}
      >
        刷新
      </Button>
    }
  >
    {/* Job Detail */}
    {currentJob && (
      <div style={{ marginBottom: spacing.md }}>
        <Descriptions size="small" bordered column={2}>
          <Descriptions.Item label="作业 ID">{currentJob.id}</Descriptions.Item>
          <Descriptions.Item label="类型">
            <Tag color={JOB_TYPE_MAP[currentJob.type]?.color}>
              {JOB_TYPE_MAP[currentJob.type]?.label}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={JOB_STATUS_MAP[currentJob.status]?.color}>
              {JOB_STATUS_MAP[currentJob.status]?.label}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="启用状态">
            <Switch size="small" checked={currentJob.enabled} disabled />
          </Descriptions.Item>
          {currentJob.description && (
            <Descriptions.Item label="描述" span={2}>
              {currentJob.description}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="创建时间" span={2}>
            {new Date(currentJob.createdAt).toLocaleString('zh-CN')}
          </Descriptions.Item>
        </Descriptions>
      </div>
    )}

    {/* Executions Table */}
    <Table
      dataSource={executions}
      columns={execColumns}
      rowKey="id"
      loading={execLoading}
      size="small"
      pagination={{
        pageSize: 10,
        showTotal: (total) => `共 ${total} 条`,
      }}
      scroll={{ x: 800 }}
    />
  </Drawer>
);
