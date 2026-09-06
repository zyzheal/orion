/**
 * DAG View Tab
 * DAG 视图 Tab 内容（抽取自 index.tsx）
 */
import React from 'react';
import { Card, Typography, message } from 'antd';
import { DAGGraph } from '@/components/DAGGraph';
import { spacing } from '@/tokens';
import type { PipelineDisplay, PipelineStage } from './types';

const { Text } = Typography;

export interface DAGTabProps {
  pipeline: PipelineDisplay;
}

export const DAGTab: React.FC<DAGTabProps> = ({ pipeline }) => (
  <Card style={{ marginBottom: spacing.lg }} title="依赖关系图">
    {pipeline.stages && pipeline.stages.length > 0 ? (
      <DAGGraph
        stages={pipeline.stages.map((stage: PipelineStage, idx: number) => ({
          id: `stage-${idx}`,
          name: stage.name,
          type: stage.type || 'custom',
          status: stage.status || 'pending',
          duration: stage.duration as number | undefined,
          dependsOn: stage.dependsOn || [],
          steps: stage.steps as { name: string; status?: string }[] | undefined,
          startTime: stage.startTime,
          endTime: stage.endTime,
        }))}
        height={400}
        showMiniMap={true}
        onNodeClick={(nodeId: string, data: unknown) => {
          const stage = (data as { name?: string; status?: string; steps?: unknown[] }) || {};
          message.info(
            `${stage.name || nodeId} 阶段 - 状态: ${stage.status || '未知'}，共 ${
              stage.steps?.length || 0
            } 个步骤`
          );
        }}
      />
    ) : (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Text type="secondary">暂无阶段数据</Text>
      </div>
    )}
  </Card>
);
