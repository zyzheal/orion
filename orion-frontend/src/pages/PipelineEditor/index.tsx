/**
 * Pipeline Editor Page - 可视化 Pipeline 编辑器
 * 支持拖拽式 Stage 编排、Stage 增删改、依赖配置、YAML 预览
 *
 * 主入口 (P2-9 Phase 104 refactor: 已抽取 Header / BasicInfoCard / StageOrchestration
 * DagPreviewCard / StageTypesCard / YamlPreviewDrawer / usePipelineEditorState)
 */
import React from 'react';
import StageModal from './StageModal';
import { usePipelineEditorState } from './usePipelineEditorState';
import { Header } from './Components/Header';
import { BasicInfoCard } from './Components/BasicInfoCard';
import { StageOrchestration } from './Components/StageOrchestration';
import { DagPreviewCard } from './Components/DagPreviewCard';
import { StageTypesCard } from './Components/StageTypesCard';
import { YamlPreviewDrawer } from './Components/YamlPreviewDrawer';

const PipelineEditor: React.FC = () => {
  const state = usePipelineEditorState();
  const {
    dagPreviewVisible,
    stages,
    stageModalVisible,
    editingStage,
    editingIndex,
    getAvailableDependencies,
    handleSaveStage,
    setStageModalVisible,
    setEditingStage,
    setEditingIndex,
  } = state;

  return (
    <div style={{ padding: 0 }} className="pipeline-editor-page">
      <Header state={state} />

      <BasicInfoCard
        form={state.form}
        pipelineInfo={state.pipelineInfo}
        setPipelineInfo={state.setPipelineInfo}
      />

      <StageOrchestration state={state} />

      {/* DAG 依赖关系可视化 */}
      {dagPreviewVisible && stages.length > 0 && <DagPreviewCard stages={stages} />}

      {/* 阶段类型说明 */}
      <StageTypesCard />

      {/* Stage 编辑弹窗 */}
      {stageModalVisible && (
        <StageModal
          visible={stageModalVisible}
          stage={editingStage}
          availableDependencies={
            editingIndex !== null
              ? getAvailableDependencies(editingIndex)
              : stages.map((s) => ({ label: s.name, value: s.name }))
          }
          onSave={handleSaveStage}
          onCancel={() => {
            setStageModalVisible(false);
            setEditingStage(null);
            setEditingIndex(null);
          }}
        />
      )}

      {/* YAML 预览弹窗 */}
      <YamlPreviewDrawer
        open={state.yamlPreviewVisible}
        generatedYaml={state.generatedYaml}
        onClose={() => state.setYamlPreviewVisible(false)}
      />
    </div>
  );
};

export default PipelineEditor;
