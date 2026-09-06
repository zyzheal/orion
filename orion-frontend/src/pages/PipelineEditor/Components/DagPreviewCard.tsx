/**
 * DagPreviewCard - DAG 依赖关系可视化
 * 抽取自 index.tsx (P2-9 Phase 104)
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
  const validation = validateDAG(stages);
  return (
    <Card style={{ marginTop: spacing.lg }} title="DAG 依赖关系">
      <Alert
        type={validation.valid ? 'success' : 'error'}
        message={validation.valid ? '依赖关系有效，无循环依赖' : '依赖关系存在问题'}
        description={
          validation.valid
            ? '拓扑结构正确，Pipeline 可以正常执行'
            : validation.errors.join('; ')
        }
        showIcon
        style={{ marginBottom: spacing.md }}
      />
      <DAGGraph stages={stages} height={350} showMiniMap={false} />
    </Card>
  );
};
