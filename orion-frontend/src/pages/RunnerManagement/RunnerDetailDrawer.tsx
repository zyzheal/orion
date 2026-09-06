/**
 * RunnerDetailDrawer.tsx - Runner 详情 Drawer
 * 抽取自 RunnerManagement/index.tsx (P2-9 Phase 59)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Tag,
  message,
  Drawer,
  Descriptions,
  Tooltip,
} from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';
import { STATUS_CONFIG, isHeartbeatStale } from './constants';
import { getRunnerJobs, type Runner, type RunnerJob } from '@/api/runners';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text, Title } = Typography;

interface RunnerDetailDrawerProps {
  visible: boolean;
  runner: Runner | null;
  onClose: () => void;
}

export const RunnerDetailDrawer: React.FC<RunnerDetailDrawerProps> = ({
  visible,
  runner,
  onClose,
}) => {
  const [jobs, setJobs] = useState<RunnerJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  const loadJobs = useCallback(async (runnerId: string) => {
    setJobsLoading(true);
    try {
      const response = await getRunnerJobs(runnerId);
      const apiData = response.data;
      setJobs(Array.isArray(apiData) ? apiData : []);
    } catch {
      message.error('加载任务列表失败');
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible && runner) {
      loadJobs(runner.id);
    }
  }, [visible, runner?.id, loadJobs]);

  if (!runner) return null;

  const statusCfg = STATUS_CONFIG[runner.status];
  const stale = isHeartbeatStale(runner.lastHeartbeat);
  const utilization =
    runner.maxConcurrent > 0 ? Math.round((runner.currentJobs / runner.maxConcurrent) * 100) : 0;

  return (
    <Drawer title={`Runner: ${runner.name}`} open={visible} onClose={onClose} width={640}>
      <Descriptions bordered column={2} size="small" style={{ marginBottom: spacing.lg }}>
        <Descriptions.Item label="状态" span={2}>
          <Tag color={statusCfg.color}>{statusCfg.label}</Tag>
          {stale && (
            <Tooltip title="心跳超时超过 5 分钟">
              <Tag color="orange" icon={<ClockCircleOutlined />} style={{ marginLeft: spacing.sm }}>
                心跳超时
              </Tag>
            </Tooltip>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Runner ID">{runner.id}</Descriptions.Item>
        <Descriptions.Item label="端点">{runner.endpoint || '-'}</Descriptions.Item>
        <Descriptions.Item label="操作系统">{runner.metadata?.os || '-'}</Descriptions.Item>
        <Descriptions.Item label="CPU 架构">{runner.metadata?.arch || '-'}</Descriptions.Item>
        <Descriptions.Item label="当前任务">{runner.currentJobs}</Descriptions.Item>
        <Descriptions.Item label="最大并发">{runner.maxConcurrent}</Descriptions.Item>
        <Descriptions.Item label="利用率" span={2}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
            <div
              style={{
                width: 120,
                height: 8,
                background: colors.neutral[200],
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.min(utilization, 100)}%`,
                  height: '100%',
                  background:
                    utilization > 80
                      ? colors.error[400]
                      : utilization > 50
                        ? colors.warning[500]
                        : colors.success[500],
                  borderRadius: 4,
                  transition: 'width 0.3s',
                }}
              />
            </div>
            <Text>{utilization}%</Text>
          </div>
        </Descriptions.Item>
        <Descriptions.Item label="标签" span={2}>
          {runner.labels.length > 0
            ? runner.labels.map((label) => (
                <Tag key={label} color="blue" style={{ marginBottom: 4 }}>
                  {label}
                </Tag>
              ))
            : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="最后心跳">
          {dayjs(runner.lastHeartbeat).fromNow()}
        </Descriptions.Item>
        <Descriptions.Item label="注册时间">{dayjs(runner.createdAt).fromNow()}</Descriptions.Item>
      </Descriptions>

      <Title level={5} style={{ marginBottom: spacing[3] }}>
        最近任务
      </Title>
      {jobsLoading ? (
        <Text type="secondary">加载中...</Text>
      ) : jobs.length === 0 ? (
        <Text type="secondary">暂无任务记录</Text>
      ) : (
        <Table
          columns={
            [
              {
                key: 'taskId',
                title: 'Task ID',
                dataIndex: 'taskId',
                width: 180,
                ellipsis: true,
              },
              {
                key: 'status',
                title: '状态',
                dataIndex: 'status',
                width: 100,
                render: (value: unknown) => {
                  const statusMap: Record<string, { color: string; label: string }> = {
                    pending: { color: 'default', label: '等待中' },
                    running: { color: 'processing', label: '运行中' },
                    completed: { color: 'success', label: '已完成' },
                    failed: { color: 'error', label: '失败' },
                    cancelled: { color: 'default', label: '已取消' },
                  };
                  const cfg = statusMap[String(value)] || {
                    color: 'default',
                    label: String(value),
                  };
                  return <Tag color={cfg.color}>{cfg.label}</Tag>;
                },
              },
              {
                key: 'createdAt',
                title: '创建时间',
                dataIndex: 'createdAt',
                width: 140,
                render: (value: unknown) => (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(String(value)).fromNow()}
                  </Text>
                ),
              },
              {
                key: 'completedAt',
                title: '完成时间',
                dataIndex: 'completedAt',
                width: 140,
                render: (value: unknown) =>
                  value ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(String(value)).fromNow()}
                    </Text>
                  ) : (
                    <Text type="secondary">-</Text>
                  ),
              },
            ] as TableColumn<RunnerJob>[]
          }
          dataSource={jobs.slice(0, 20)}
          rowKey="id"
          size="small"
          pagination={false}
        />
      )}
    </Drawer>
  );
};
