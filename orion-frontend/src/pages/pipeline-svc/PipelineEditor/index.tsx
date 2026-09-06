/**
 * Pipeline Editor Page - 可视化 Pipeline 编辑器
 * 支持拖拽式 Stage 编排、Stage 增删改、依赖配置、YAML 预览
 *
 * 主入口 (P2-9 Phase 102 refactor: 已抽取
 *   - types.ts (StageConfig/CacheConfig/ArtifactConfig/PipelineForm)
 *   - constants.ts (STAGE_TYPES)
 *   - yaml.ts (generatePipelineYaml)
 *   - usePipelineEditorState.ts (state + handlers + effects)
 *   - Components/Header.tsx
 *   - Components/BasicInfoCard.tsx
 *   - Components/StageOrchestration.tsx
 *   - Components/DagPreviewCard.tsx
 *   - Components/StageTypesCard.tsx
 *   - Components/YamlPreviewDrawer.tsx
 * )
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

  return (
    <div style={{ padding: 0 }}>
      <Header
        id={state.id}
        viewMode={state.viewMode}
        dagPreviewVisible={state.dagPreviewVisible}
        saving={state.saving}
        stagesCount={state.stages.length}
        onViewModeChange={state.setViewMode}
        onToggleDag={() => state.setDagPreviewVisible(!state.dagPreviewVisible)}
        onPreviewYaml={state.handlePreviewYaml}
        onReset={state.handleReset}
        onSave={state.handleSavePipeline}
        onBack={() => state.navigate('/pipelines')}
      />

      <BasicInfoCard
        form={state.form}
        pipelineInfo={state.pipelineInfo}
        onInfoChange={state.setPipelineInfo}
      />

      <StageOrchestration
        stages={state.stages}
        viewMode={state.viewMode}
        onStagesChange={state.setStages}
        onOpenStageModal={state.openStageModal}
        onDeleteStage={state.handleDeleteStage}
        getAvailableDependencies={state.getAvailableDependencies}
        handleDragEnd={state.handleDragEnd}
      />

      {state.dagPreviewVisible && state.stages.length > 0 && (
        <DagPreviewCard stages={state.stages} />
      )}

      <StageTypesCard />

      {state.stageModalVisible && (
        <StageModal
          visible={state.stageModalVisible}
          stage={state.editingStage}
          availableDependencies={
            state.editingIndex !== null
              ? state.getAvailableDependencies(state.editingIndex)
              : state.stages.map((s) => ({ label: s.name, value: s.name }))
          }
          onSave={state.handleSaveStage}
          onCancel={() => {
            state.setStageModalVisible(false);
            state.setEditingStage(null);
            state.setEditingIndex(null);
          }}
        />
      )}

      <YamlPreviewDrawer
        open={state.yamlPreviewVisible}
        yaml={state.generatedYaml}
        onClose={() => state.setYamlPreviewVisible(false)}
      />
    </div>
  );
};

export default PipelineEditor;
