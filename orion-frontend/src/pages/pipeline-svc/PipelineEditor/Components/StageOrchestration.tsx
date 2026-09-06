/**
 * StageOrchestration.tsx - 阶段编排卡片 (列表 + 画布双模式)
 * 抽取自 pipeline-svc/PipelineEditor/index.tsx (P2-9 Phase 102)
 */
import React from 'react';
import { Card, Button, Space, Tag, Alert } from 'antd';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { PlusOutlined, DragOutlined, LayoutOutlined } from '@ant-design/icons';
import type { StageConfig } from '../types';
import StageItem from '../StageItem';
import { PipelineCanvas } from '../canvas';

interface StageOrchestrationProps {
  stages: StageConfig[];
  viewMode: 'list' | 'canvas';
  onStagesChange: (stages: StageConfig[]) => void;
  onOpenStageModal: (stage?: StageConfig, index?: number) => void;
  onDeleteStage: (index: number) => void;
  getAvailableDependencies: (index: number) => Array<{ label: string; value: string }>;
  handleDragEnd: (event: any) => void;
}

export const StageOrchestration: React.FC<StageOrchestrationProps> = ({
  stages,
  viewMode,
  onStagesChange,
  onOpenStageModal,
  onDeleteStage,
  getAvailableDependencies,
  handleDragEnd,
}) => (
  <Card
    title={
      <Space>
        {viewMode === 'list' ? <DragOutlined /> : <LayoutOutlined />}
        阶段编排
        <Tag color="blue">{stages.length} 个阶段</Tag>
      </Space>
    }
    extra={
      viewMode === 'list' && (
        <Button type="primary" icon={<PlusOutlined />} onClick={() => onOpenStageModal()}>
          添加阶段
        </Button>
      )
    }
  >
    {stages.length === 0 ? (
      <Alert
        type="info"
        message="暂无阶段"
        description={
          viewMode === 'canvas'
            ? '点击右上角「添加阶段」按钮在画布上添加节点'
            : '点击上方「添加阶段」按钮开始编排流水线'
        }
        showIcon
      />
    ) : viewMode === 'canvas' ? (
      <PipelineCanvas
        stages={stages}
        onStagesChange={onStagesChange}
        onNodeClick={(nodeId, stage) => {
          const index = stages.findIndex((s) => s.id === nodeId);
          if (index !== -1) {
            onOpenStageModal(stage, index);
          }
        }}
        onAddStage={(type, position) => {
          const newStage: StageConfig = {
            id: `stage-${Date.now()}`,
            name: `新阶段-${stages.length + 1}`,
            type,
            config: {},
          };
          // 附加 canvas 位置（PipelineCanvas 内部使用 position 字段布局节点）
          Object.assign(newStage, { position });
          onStagesChange([...stages, newStage]);
          onOpenStageModal(newStage, stages.length);
        }}
      />
    ) : (
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {stages.map((stage, index) => (
              <StageItem
                key={stage.id}
                id={stage.id}
                stage={stage}
                index={index}
                onEdit={() => onOpenStageModal(stage, index)}
                onDelete={() => onDeleteStage(index)}
                availableDependencies={getAvailableDependencies(index)}
              />
            ))}
          </Space>
        </SortableContext>
      </DndContext>
    )}
  </Card>
);
