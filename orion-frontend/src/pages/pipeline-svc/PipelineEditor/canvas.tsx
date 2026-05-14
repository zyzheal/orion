/**
 * PipelineCanvas - Stub for pipeline visual editor canvas
 * TODO: 实现完整的可视化画布功能，包括：
 * - 拖拽式 Stage 编排
 * - 节点连线与依赖关系可视化
 * - 缩放和平移视图
 * - 节点点击编辑
 */
import React from 'react';

interface PipelineCanvasProps {
  stages: any[];
  onStagesChange?: (stages: any[]) => void;
  onNodeClick?: (nodeId: string, stage: any) => void;
  onAddStage?: (type: string, position: { x: number; y: number }) => void;
  readOnly?: boolean;
  initialViewport?: { x: number; y: number; zoom: number };
  onSaveLayout?: (nodes: any[], edges: any[], viewport: { x: number; y: number; zoom: number }) => void;
}

export const PipelineCanvas: React.FC<PipelineCanvasProps> = ({ stages }) => {
  return (
    <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
      Canvas mode - {stages.length} stages
    </div>
  );
};

export default PipelineCanvas;