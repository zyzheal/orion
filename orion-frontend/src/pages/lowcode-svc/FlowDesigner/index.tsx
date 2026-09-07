/**
 * FlowDesigner - 低代码流程设计器页面
 *
 * 功能：流程列表展示、新建流程、AI 生成流程、执行流程、查看流程详情
 * API: /api/v1/lowcode/flows  +  POST /api/v1/lowcode/generate (TR-10)
 *
 * 拆分自 index.tsx (P2-9 Phase 190)
 */
import { spacing } from '@/tokens/spacing';
import { useFlowDesignerState } from './useFlowDesignerState';
import { PageHeader } from './Components/PageHeader';
import { FlowGrid } from './Components/FlowGrid';
import { CreateFlowModal } from './Components/CreateFlowModal';
import { AiGenerateModal } from './Components/AiGenerateModal';
import { ExecuteFlowModal } from './Components/ExecuteFlowModal';
import { FlowDetailModal } from './Components/FlowDetailModal';

export default function FlowDesigner() {
  const {
    selectedFlow,
    createVisible,
    executeVisible,
    detailVisible,
    aiVisible,
    aiLoading,
    form,
    aiForm,
    flows,
    loading,
    handleCreate,
    handleAiGenerate,
    handleExecute,
    handleDelete,
    handlePublish,
    handleViewDetail,
    handleExecuteFlow,
    loadFlows,
    openCreate,
    openAi,
    closeCreate,
    closeAi,
    closeExecute,
    closeDetail,
    detailToExecute,
  } = useFlowDesignerState();

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader />

      <FlowGrid
        flows={flows}
        loading={loading}
        onSearch={loadFlows}
        onAiGenerate={openAi}
        onCreate={openCreate}
        onViewDetail={handleViewDetail}
        onExecute={handleExecuteFlow}
        onPublish={handlePublish}
        onDelete={handleDelete}
      />

      <CreateFlowModal
        form={form}
        open={createVisible}
        onSubmit={handleCreate}
        onClose={closeCreate}
      />

      <AiGenerateModal
        form={aiForm}
        open={aiVisible}
        loading={aiLoading}
        onSubmit={handleAiGenerate}
        onClose={closeAi}
      />

      <ExecuteFlowModal
        open={executeVisible}
        flowName={selectedFlow?.name || ''}
        onSubmit={handleExecute}
        onClose={closeExecute}
      />

      <FlowDetailModal
        open={detailVisible}
        flow={selectedFlow}
        onClose={closeDetail}
        onExecute={detailToExecute}
      />
    </div>
  );
}
