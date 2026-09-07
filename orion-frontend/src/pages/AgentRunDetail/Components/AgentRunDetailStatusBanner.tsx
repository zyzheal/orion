/**
 * AgentRunDetailStatusBanner - 运行状态横幅 (状态徽章 + 操作按钮 + 进度条)
 * 抽取自 index.tsx (P2-9 Phase 120)
 */
import React from 'react';
import { Card, Space, Tag, Typography, Button, Progress } from 'antd';
import {
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import StatusBadge from '@/components/StatusBadge';
import { statusToBadge } from '../constants';
import type { AgentRunDetailState } from '../useAgentRunDetailState';

const { Title, Text } = Typography;

interface AgentRunDetailStatusBannerProps {
  state: AgentRunDetailState;
}

export const AgentRunDetailStatusBanner: React.FC<AgentRunDetailStatusBannerProps> = ({ state }) => {
  const { run, duration, isRunning, actionLoading, handleCancel, handleRetry, loadData, id, loading, progress } =
    state;

  if (!run) return null;

  return (
    <Card
      style={{
        marginBottom: spacing.lg,
        borderLeft: `4px solid ${
          run.status === 'completed'
            ? colors.success[500]
            : run.status === 'failed'
              ? colors.error[500]
              : run.status === 'running'
                ? colors.primary[500]
                : run.status === 'waiting_approval'
                  ? colors.warning[500]
                  : colors.neutral[400]
        }`,
      }}
    >
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <div>
          <Space style={{ marginBottom: spacing.sm }}>
            <Title level={4} style={{ margin: 0 }}>
              运行 {run.id.slice(0, 8)}...
            </Title>
            <StatusBadge status={statusToBadge[run.status] || 'unknown'} />
          </Space>
          <Text type="secondary">
            触发事件: <Tag>{run.triggerEvent}</Tag>
            {run.currentAgent && ` · 当前 Agent: ${run.currentAgent.slice(0, 8)}`}
            &nbsp;· 耗时: {duration}s
          </Text>
        </div>
        <Space>
          {isRunning && (
            <Button
              danger
              icon={<PauseCircleOutlined />}
              loading={actionLoading === 'cancel'}
              onClick={handleCancel}
            >
              取消运行
            </Button>
          )}
          {(run.status === 'failed' || run.status === 'cancelled') && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={actionLoading === 'retry'}
              onClick={handleRetry}
            >
              重试
            </Button>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={() => id && loadData(id)}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: spacing.md }}>
        <Space>
          <Text style={{ fontSize: spacing[3] }}>进度</Text>
          <Progress
            percent={progress}
            size="small"
            style={{ width: 300 }}
            strokeColor={{
              '0%': colors.primary[500],
              '100%': colors.success[500],
            }}
          />
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            {run.currentStep} / {run.totalSteps} 步骤
          </Text>
        </Space>
      </div>
    </Card>
  );
};
