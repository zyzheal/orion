/**
 * StageProgress - 阶段进度 + 阶段详情
 * 抽取自 index.tsx（P2-9 Phase 36）
 */
import React from 'react';
import { Typography, Space, Tag, Card, Divider } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { colors, spacing, themeVars } from '@/tokens';
import StatusBadge from '@/components/StatusBadge';
import type { StageState } from './types';
import { stageStatusColors } from './constants';

const { Text } = Typography;

const statusIcon = (status: string) => {
  switch (status) {
    case 'success':
      return <CheckCircleOutlined style={{ color: colors.success[500] }} />;
    case 'failed':
      return <CloseCircleOutlined style={{ color: colors.error[500] }} />;
    case 'running':
      return <LoadingOutlined style={{ color: colors.primary[500] }} />;
    default:
      return <span style={{ color: colors.neutral[400] }}>&#9679;</span>;
  }
};

const stageStatusLabel = (status: string) =>
  status === 'running'
    ? '运行中'
    : status === 'success'
      ? '成功'
      : status === 'failed'
        ? '失败'
        : '等待中';

export interface StageProgressProps {
  stages: StageState[];
  currentStageId?: string;
}

export const StageProgress: React.FC<StageProgressProps> = ({ stages, currentStageId }) => {
  if (stages.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: spacing.lg, color: colors.neutral[500] }}>
        <Text>暂无阶段数据</Text>
      </div>
    );
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 0' }}>
        {stages.map((stage, index) => (
          <React.Fragment key={stage.id || index}>
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
                  boxShadow: stage.status === 'running' ? '0 0 0 4px rgba(24,144,255,0.2)' : 'none',
                  animation:
                    stage.status === 'running' ? 'status-pulse 1.5s ease-in-out infinite' : 'none',
                }}
              >
                {statusIcon(stage.status)}
              </div>
              <Text
                style={{
                  fontSize: 12,
                  textAlign: 'center',
                  maxWidth: 80,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={stage.name}
              >
                {stage.name}
              </Text>
            </div>
            {index < stages.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 3,
                  backgroundColor:
                    stages[index + 1].status === 'pending'
                      ? themeVars.borderLight
                      : stageStatusColors[stages[index].status] || colors.neutral[300],
                  borderRadius: 2,
                  marginTop: -16,
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      <Divider style={{ margin: '8px 0' }} />
      {stages.map((stage, index) => (
        <Card
          key={stage.id || index}
          size="small"
          style={{
            marginBottom: spacing.sm,
            borderColor:
              stage.id === currentStageId && stage.status === 'running'
                ? colors.primary[300]
                : undefined,
          }}
          title={
            <Space>
              {statusIcon(stage.status)}
              <Text strong>
                {index + 1}. {stage.name}
              </Text>
            </Space>
          }
          extra={<StatusBadge status={stage.status} size="small" label={stageStatusLabel(stage.status)} />}
        >
          {stage.steps && stage.steps.length > 0 ? (
            <Space direction="vertical" size={4}>
              {stage.steps.map((step) => (
                <div
                  key={step.id || step.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                    fontSize: spacing[3],
                  }}
                >
                  <span style={{ color: stageStatusColors[step.status] || colors.neutral[300] }}>
                    {statusIcon(step.status)}
                  </span>
                  <Text>{step.name}</Text>
                  <Tag
                    color={
                      step.status === 'success'
                        ? 'success'
                        : step.status === 'failed'
                          ? 'error'
                          : step.status === 'running'
                            ? 'processing'
                            : 'default'
                    }
                    style={{ marginLeft: 'auto' }}
                  >
                    {step.status}
                  </Tag>
                </div>
              ))}
            </Space>
          ) : (
            <Text type="secondary">暂无步骤数据</Text>
          )}
        </Card>
      ))}
    </Space>
  );
};
