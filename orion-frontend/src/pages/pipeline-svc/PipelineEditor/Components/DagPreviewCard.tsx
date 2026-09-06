/**
 * DagPreviewCard.tsx - DAG 依赖关系可视化卡片
 * 抽取自 pipeline-svc/PipelineEditor/index.tsx (P2-9 Phase 102)
 */
import React from 'react';
import { Card, Alert } from 'antd';
import { spacing } from '@/tokens';
import { DAGGraph, validateDAG } from '@/components/DAGGraph';
import type { StageConfig } from '../types';

interface DagPreviewCardProps {
  stages: StageConfig[];
}

export const DagPreviewCard: React.FC<DagPreviewCardProps> = ({ stages }) => {
  const dagValidation = validateDAG(stages);
  return (
    <Card style={{ marginTop: spacing.lg }} title="DAG 依赖关系">
      <Alert
        type={dagValidation.valid ? 'success' : 'error'}
        message={dagValidation.valid ? '依赖关系有效，无循环依赖' : '依赖关系存在问题'}
        description={
          dagValidation.valid
            ? '拓扑结构正确，Pipeline 可以正常执行'
            : dagValidation.errors.join('; ')
        }
        showIcon
        style={{ marginBottom: spacing.md }}
      />
      <DAGGraph stages={stages} height={350} showMiniMap={false} />
    </Card>
  );
};
