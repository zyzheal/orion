/**
 * StageOrchestration - 阶段编排卡片 (DnD + 阶段列表)
 * 抽取自 index.tsx (P2-9 Phase 104)
 */
import React from 'react';
import { Card, Button, Space, Tag, Alert } from 'antd';
import { PlusOutlined, DragOutlined } from '@ant-design/icons';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import StageItem from '../StageItem';
import type { PipelineEditorState } from '../usePipelineEditorState';

interface StageOrchestrationProps {
  state: PipelineEditorState;
}

export const StageOrchestration: React.FC<StageOrchestrationProps> = ({ state }) => {
  const {
    stages,
    handleDragEnd,
    openStageModal,
    handleDeleteStage,
    getAvailableDependencies,
  } = state;

  return (
    <Card
      title={
        <Space>
          <DragOutlined />
          阶段编排
          <Tag color="blue">{stages.length} 个阶段</Tag>
        </Space>
      }
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openStageModal()}>
          添加阶段
        </Button>
      }
    >
      {stages.length === 0 ? (
        <Alert
          type="info"
          message="暂无阶段"
          description="点击上方「添加阶段」按钮开始编排流水线"
          showIcon
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
                  onEdit={() => openStageModal(stage, index)}
                  onDelete={() => handleDeleteStage(index)}
                  availableDependencies={getAvailableDependencies(index)}
                />
              ))}
            </Space>
          </SortableContext>
        </DndContext>
      )}
    </Card>
  );
};
