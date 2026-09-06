/**
 * Stage Timeline
 * 阶段详情 Tab 内容（抽取自 index.tsx）
 */
import React from 'react';
import { Card, Space, Typography, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import StatusBadge, { type StatusType } from '@/components/StatusBadge';
import { colors, spacing, themeVars } from '@/tokens';
import { stageStatusColors } from './constants';
import type { PipelineStage, PipelineStep, PipelineDisplay } from './types';

const { Text } = Typography;

export interface StageTimelineProps {
  pipeline: PipelineDisplay;
  retryingStageId: string | null;
  formatDuration: (value?: number | string) => string;
  onRetryFromStage: (stageId: string, stageName: string) => void;
}

export const StageTimeline: React.FC<StageTimelineProps> = ({
  pipeline,
  retryingStageId,
  formatDuration,
  onRetryFromStage,
}) => (
  <Card style={{ marginBottom: spacing.lg }} title="执行阶段">
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      {/* Stage progress bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '8px 0',
        }}
      >
        {pipeline.stages?.map((stage: PipelineStage, index: number) => (
          <React.Fragment key={stage.name}>
            {/* Stage node */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                flex: 1,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: stageStatusColors[stage.status] || colors.neutral[300],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.neutral[0],
                  fontSize: spacing[4],
                  fontWeight: 600,
                  boxShadow:
                    stage.status === 'running' ? '0 0 0 4px rgba(24,144,255,0.2)' : 'none',
                  animation: stage.status === 'running' ? 'status-pulse 1.5s ease-in-out infinite' : 'none',
                }}
              >
                {stage.status === 'success'
                  ? '✓'
                  : stage.status === 'failed'
                    ? '✗'
                    : index + 1}
              </div>
              <Text
                style={
                  {
                    fontSize: spacing[2],
                    textAlign: 'center',
                    maxWidth: 80,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  } as React.CSSProperties
                }
                title={stage.name}
              >
                {stage.name}
              </Text>
              {stage.duration && (
                <Text type="secondary" style={{ fontSize: spacing[2] }}>
                  {formatDuration(stage.duration as number)}
                </Text>
              )}
            </div>
            {/* Connector line */}
            {index < (pipeline.stages?.length || 0) - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 3,
                  backgroundColor:
                    pipeline.stages![index + 1].status === 'pending'
                      ? themeVars.borderLight
                      : stageStatusColors[pipeline.stages![index].status] || colors.neutral[300],
                  borderRadius: 2,
                  marginTop: -16,
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Stage details table */}
      {pipeline.stages && pipeline.stages.length > 0 && (
        <div style={{ marginTop: spacing.sm }}>
          {pipeline.stages.map((stage: PipelineStage, index: number) => (
            <Card
              key={stage.name}
              size="small"
              style={{ marginBottom: spacing.sm }}
              title={
                <Space>
                  <StatusBadge status={stage.status as StatusType} size="small" />
                  <Text strong>
                    {index + 1}. {stage.name}
                  </Text>
                </Space>
              }
              extra={
                <Space>
                  {stage.duration && (
                    <Text type="secondary" style={({ fontSize: spacing[3] } as React.CSSProperties)}>
                      耗时: {formatDuration(stage.duration as number)}
                    </Text>
                  )}
                  {/* Per-stage retry button: only show for failed/completed runs */}
                  {(pipeline.status === 'failed' || pipeline.status === 'success') && (
                    <Button
                      type="link"
                      size="small"
                      icon={<ReloadOutlined />}
                      loading={retryingStageId === stage.id || retryingStageId === stage.name}
                      onClick={() => onRetryFromStage(stage.id || stage.name, stage.name)}
                    >
                      从该阶段重跑
                    </Button>
                  )}
                </Space>
              }
            >
              {/* Steps within the stage */}
              {stage.steps && stage.steps.length > 0 && (
                <Space direction="vertical" size={4}>
                  {stage.steps.map((step: PipelineStep) => (
                    <div
                      key={step.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing.sm,
                        fontSize: spacing[3],
                      }}
                    >
                      <StatusBadge status={step.status as StatusType} size="small" variant="subtle" />
                      <Text>{step.name}</Text>
                      {step.duration && (
                        <Text
                          type="secondary"
                          style={{ fontSize: spacing[2], marginLeft: 'auto' } as React.CSSProperties}
                        >
                          {formatDuration(step.duration as number)}
                        </Text>
                      )}
                    </div>
                  ))}
                </Space>
              )}
            </Card>
          ))}
        </div>
      )}
    </Space>
  </Card>
);
