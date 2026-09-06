/**
 * DagTab.tsx - DAG 视图 Tab
 * 抽取自 pipeline-svc/PipelineDetail/index.tsx (P2-9 Phase 103)
 */
import React from 'react';
import { Typography } from 'antd';
import CardPanel from '@/components/CardPanel';
import { DAGGraph } from '@/components/DAGGraph';
import type { PipelineDetailModel, StageDetail } from '../types';

const { Text } = Typography;

interface DagTabProps {
  pipeline: PipelineDetailModel;
}

export const DagTab: React.FC<DagTabProps> = ({ pipeline }) => (
  <CardPanel title="依赖关系图">
    {pipeline.stages && pipeline.stages.length > 0 ? (
      <DAGGraph
        stages={pipeline.stages.map((stage: StageDetail, idx: number) => ({
          id: `stage-${idx}`,
          name: stage.name,
          type: stage.type || 'custom',
          status: stage.status || 'pending',
          duration: stage.duration,
          dependsOn: stage.dependsOn || [],
          steps: stage.steps,
          startTime: stage.startTime,
          endTime: stage.endTime,
        }))}
        height={400}
        showMiniMap={true}
        onNodeClick={() => {}}
      />
    ) : (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Text type="secondary">暂无阶段数据</Text>
      </div>
    )}
  </CardPanel>
);
