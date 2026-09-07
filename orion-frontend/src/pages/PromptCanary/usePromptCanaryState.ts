/**
 * PromptCanary usePromptCanaryState
 * 抽取自 index.tsx (P2-9 Phase 183)
 */
import { useState, useCallback } from 'react';
import { Form, message } from 'antd';
import { apiCall } from './api';
import type { PromptCanaryStatus, PromptVersionInfo } from './types';

const KNOWN_PROMPTS = ['rag-retrieve', 'rag-summarize', 'rag-question-answer', 'incident-rca'];

export const usePromptCanaryState = () => {
  const [loading, setLoading] = useState(false);
  const [statuses, setStatuses] = useState<PromptCanaryStatus[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptCanaryStatus | null>(null);
  const [createForm] = Form.useForm<{
    name: string;
    content: string;
    version: string;
    traffic_percent: number;
  }>();

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        KNOWN_PROMPTS.map((name) => apiCall<PromptCanaryStatus>(`/rag/prompt/canary/${name}`))
      );
      const loaded = results
        .filter((r): r is PromiseFulfilledResult<PromptCanaryStatus> => r.status === 'fulfilled')
        .map((r) => r.value);
      setStatuses(loaded);
    } catch (error: unknown) {
      message.error(`加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePublishCanary = async () => {
    const values = await createForm.validateFields();
    try {
      await apiCall<PromptVersionInfo>('/rag/prompt/canary', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          content: values.content,
          version: values.version,
          traffic_percent: values.traffic_percent,
        }),
      });
      message.success(`Prompt "${values.name}" 已发布为 Canary (v${values.version})`);
      setCreateModalOpen(false);
      createForm.resetFields();
      loadPrompts();
    } catch (error: unknown) {
      message.error(`发布失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleViewDetail = async (name: string) => {
    try {
      const status = await apiCall<PromptCanaryStatus>(`/rag/prompt/canary/${name}`);
      setSelectedPrompt(status);
      setDetailModalOpen(true);
    } catch (error: unknown) {
      message.error(`加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  return {
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
  };
};
