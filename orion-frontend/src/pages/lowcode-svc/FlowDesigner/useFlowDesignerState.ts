/**
 * FlowDesigner state hook
 * 抽取自 index.tsx (P2-9 Phase 190)
 */
import { useState, useEffect } from 'react';
import { Form, message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import { lowcodeApi, type LowcodeFlow } from '@/api/lowcode';

export const useFlowDesignerState = () => {
  const [selectedFlow, setSelectedFlow] = useState<LowcodeFlow | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [executeVisible, setExecuteVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [aiVisible, setAiVisible] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [form] = Form.useForm();
  const [aiForm] = Form.useForm();

  const {
    data: flows = [] as LowcodeFlow[],
    isLoading: loading,
    isError,
    error: queryError,
    refetch: loadFlows,
  } = useQuery<LowcodeFlow[]>({
    queryKey: ['lowcode-flows'],
    queryFn: async () => {
      const result = await lowcodeApi.listFlows();
      return result.flows || [];
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!isError) return;
    message.error(
      queryError instanceof Error ? `加载流程列表失败：${queryError.message}` : '加载流程列表失败'
    );
  }, [isError, queryError]);

  const handleCreate = async (values: { name: string; description?: string; type?: string }) => {
    try {
      await lowcodeApi.createFlow({
        name: values.name,
        description: values.description,
        type: values.type,
      });
      message.success('流程创建成功');
      setCreateVisible(false);
      form.resetFields();
      loadFlows();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '创建失败');
    }
  };

  const handleAiGenerate = async (values: { prompt: string; name?: string }) => {
    setAiLoading(true);
    try {
      const result = (await lowcodeApi.generateFlow({
        prompt: values.prompt,
        workflowName: values.name,
      })) as { intent: string };
      message.success(`AI 生成成功，意图识别为「${result.intent}」`);
      setAiVisible(false);
      aiForm.resetFields();
      loadFlows();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'AI 生成失败');
    } finally {
      setAiLoading(false);
    }
  };

  const handleExecute = async (values: { input?: string }) => {
    if (!selectedFlow) return;
    try {
      let input: Record<string, unknown> = {};
      if (values.input && values.input.trim()) {
        try {
          input = JSON.parse(values.input);
        } catch {
          message.error('输入参数 JSON 格式错误');
          return;
        }
      }
      const result = (await lowcodeApi.executeFlow(selectedFlow.id, input)) as {
        id?: string;
        status?: string;
      };
      message.success(
        `流程执行成功，实例ID: ${result?.id || 'unknown'}，状态: ${result?.status || 'running'}`
      );
      setExecuteVisible(false);
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '执行失败');
    }
  };

  const handleDelete = async (flow: LowcodeFlow) => {
    try {
      await lowcodeApi.deleteFlow(flow.id);
      message.success('流程删除成功');
      loadFlows();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handlePublish = async (flow: LowcodeFlow) => {
    try {
      await lowcodeApi.publishFlow(flow.id);
      message.success(`流程已发布 (${flow.version})`);
      loadFlows();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '发布失败');
    }
  };

  const handleViewDetail = (flow: LowcodeFlow) => {
    setSelectedFlow(flow);
    setDetailVisible(true);
  };
  const handleExecuteFlow = (flow: LowcodeFlow) => {
    setSelectedFlow(flow);
    setExecuteVisible(true);
  };
  const openCreate = () => {
    form.resetFields();
    setCreateVisible(true);
  };
  const openAi = () => {
    aiForm.resetFields();
    setAiVisible(true);
  };
  const closeCreate = () => setCreateVisible(false);
  const closeAi = () => setAiVisible(false);
  const closeExecute = () => setExecuteVisible(false);
  const closeDetail = () => setDetailVisible(false);
  const detailToExecute = () => {
    setDetailVisible(false);
    setExecuteVisible(true);
  };

  return {
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
  };
};
