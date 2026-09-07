/**
 * ExecutionProgress - 执行进度可视化
 * 抽取自 index.tsx (P2-9 Phase 110)
 */
import React from 'react';
import { Steps, Timeline, Space, Tag, Typography, Empty } from 'antd';
import { ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors, spacing, themeVars } from '@/tokens';
import { executionStepStatusColor, executionStepStatusLabel } from '../config';
import type { ChangeRequestManagementState } from '../useChangeRequestManagementState';

const { Text } = Typography;

interface ExecutionProgressProps {
  state: ChangeRequestManagementState;
}

export const ExecutionProgress: React.FC<ExecutionProgressProps> = ({ state }) => {
  if (state.executionLoading)
    return <div style={{ textAlign: 'center', padding: spacing.lg }}>加载中...</div>;
  if (state.executionSteps.length === 0) return <Empty description="暂无执行步骤" />;

  const completedCount = state.executionSteps.filter((s) => s.status === 'completed').length;
  const currentStep = state.executionSteps.findIndex((s) => s.status === 'running');

  return (
    <>
      <Steps
        current={currentStep >= 0 ? currentStep : completedCount}
        status={state.executionSteps.some((s) => s.status === 'failed') ? 'error' : undefined}
        style={{ marginBottom: spacing.lg }}
        items={state.executionSteps.map((step) => ({
          title: step.stepName,
          description: executionStepStatusLabel[step.status],
          icon:
            step.status === 'running' ? (
              <ClockCircleOutlined style={{ color: colors.primary[500] }} />
            ) : step.status === 'failed' ? (
              <ExclamationCircleOutlined style={{ color: colors.error[500] }} />
            ) : undefined,
        }))}
      />
      <Timeline
        items={state.executionSteps.map((step) => ({
          color: executionStepStatusColor[step.status] ?? colors.neutral[400],
          children: (
            <div>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Space>
                  <Text strong>{step.stepName}</Text>
                  <Tag
                    color={
                      step.status === 'completed'
                        ? 'success'
                        : step.status === 'failed'
                          ? 'error'
                          : step.status === 'running'
                            ? 'processing'
                            : 'default'
                    }
                  >
                    {executionStepStatusLabel[step.status]}
                  </Tag>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {step.stepType === 'manual'
                    ? '手动'
                    : step.stepType === 'script'
                      ? '脚本'
                      : '自动'}
                </Text>
              </div>
              {step.output && (
                <div
                  style={{
                    background: themeVars.bgSecondary,
                    borderRadius: 6,
                    padding: `${spacing.xs}px ${spacing.sm}px`,
                    marginTop: spacing.xs,
                    fontSize: 13,
                    fontFamily: 'monospace',
                  }}
                >
                  {step.output}
                </div>
              )}
              {step.error && (
                <Text type="danger" style={{ display: 'block', marginTop: 4, fontSize: 13 }}>
                  {step.error}
                </Text>
              )}
              {step.startedAt && (
                <Text
                  type="secondary"
                  style={{ display: 'block', fontSize: 12, marginTop: 4 }}
                >
                  {dayjs(step.startedAt).format('HH:mm:ss')}
                  {step.completedAt && ` - ${dayjs(step.completedAt).format('HH:mm:ss')}`}
                </Text>
              )}
            </div>
          ),
        }))}
      />
    </>
  );
};
