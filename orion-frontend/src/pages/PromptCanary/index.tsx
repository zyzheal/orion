/**
 * Prompt Canary Management Page (TR-06)
 *
 * RAG Prompt 灰度发布管理 — 发布 Prompt 新版本为 Canary，
 * 按 callerID 稳定散列分流，支持灰度状态查看和版本管理。
 * 后端 /api/v1/knowledge/rag/prompt/canary 已实现。
 *
 * P2-9 Phase 183: Extracted to types.ts + api.ts + columns.tsx +
 * usePromptCanaryState.ts + Components/*.tsx (5 components). 421 → 62 行 (-85%).
 */
import React from 'react';
import { spacing } from '@/tokens';
import { usePromptCanaryState } from './usePromptCanaryState';
import { buildVersionColumns, buildPromptColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { StatsRow } from './Components/StatsRow';
import { PromptTable } from './Components/PromptTable';
import { PublishCanaryModal, type PublishFormValues } from './Components/PublishCanaryModal';
import { DetailModal } from './Components/DetailModal';
import type { FormInstance } from 'antd';

const PromptCanary: React.FC = () => {
  const {
    loading,
    statuses,
    createModalOpen,
    setCreateModalOpen,
    detailModalOpen,
    setDetailModalOpen,
    selectedPrompt,
    createForm,
    loadPrompts,
    handlePublishCanary,
    handleViewDetail,
  } = usePromptCanaryState();

  const promptColumns = buildPromptColumns({ onViewDetail: handleViewDetail });
  const versionColumns = buildVersionColumns();

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader />
      <StatsRow statuses={statuses} />
      <PromptTable
        columns={promptColumns}
        dataSource={statuses}
        loading={loading}
        onRefresh={loadPrompts}
        onPublish={() => setCreateModalOpen(true)}
      />
      <PublishCanaryModal
        open={createModalOpen}
        form={createForm as FormInstance<PublishFormValues>}
        onOk={handlePublishCanary}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
      />
      <DetailModal
        open={detailModalOpen}
        selected={selectedPrompt}
        columns={versionColumns}
        onClose={() => setDetailModalOpen(false)}
      />
    </div>
  );
};

export default PromptCanary;
