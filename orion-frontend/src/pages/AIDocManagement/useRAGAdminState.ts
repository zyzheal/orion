/**
 * useRAGAdminState.ts - RAG 管理页状态钩子
 * 抽取自 AIDocManagement/RAGAdmin.tsx (P2-9 Phase 98)
 */
import { useState, useEffect, useCallback } from 'react';
import { Form, message } from 'antd';
import {
  getRAGAdminConfig,
  updateRAGAdminConfig,
  getRAGPromptTemplates,
  saveRAGPromptTemplate,
  deleteRAGPromptTemplate,
  triggerRAGIndex,
} from '@/api/ai-docs';
import {
  type RAGConfig,
  type PromptTemplate,
  DEFAULT_CONFIG,
} from './RAGAdminConstants';

export const useRAGAdminState = () => {
  const [activeTab, setActiveTab] = useState('config');
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [config, setConfig] = useState<RAGConfig | null>(null);
  const [configForm] = Form.useForm();

  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [templateForm] = Form.useForm();
  const [templateSaving, setTemplateSaving] = useState(false);

  const [indexRebuilding, setIndexRebuilding] = useState(false);

  const loadConfig = useCallback(
    async () => {
      setConfigLoading(true);
      try {
        const res = await getRAGAdminConfig();
        const data = (res.data ?? {}) as RAGConfig;
        setConfig(data);
        configForm.setFieldsValue(data);
      } catch (error: unknown) {
        message.error(`加载配置失败: ${(error as Error).message}`);
        setConfig(DEFAULT_CONFIG);
        configForm.setFieldsValue(DEFAULT_CONFIG);
      } finally {
        setConfigLoading(false);
      }
    },
    [configForm],
  );

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await getRAGPromptTemplates();
      const data = res.data;
      const list = Array.isArray(data) ? data : [];
      setTemplates(list);
    } catch (error: unknown) {
      message.error(`加载 Prompt 模板失败: ${(error as Error).message}`);
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadTemplates();
  }, [loadConfig, loadTemplates]);

  const handleSaveConfig = async () => {
    try {
      const values = await configForm.validateFields();
      setConfigSaving(true);
      await updateRAGAdminConfig(values as Record<string, unknown>);
      message.success('配置保存成功');
      setConfig(values as RAGConfig);
    } catch (error: unknown) {
      if ((error as Record<string, unknown>).errorFields) return;
      message.error(`保存配置失败: ${(error as Error).message}`);
    } finally {
      setConfigSaving(false);
    }
  };

  const openNewTemplate = () => {
    setEditingTemplate(null);
    templateForm.resetFields();
    setTemplateModalVisible(true);
  };

  const openEditTemplate = (record: PromptTemplate) => {
    setEditingTemplate(record);
    templateForm.setFieldsValue({
      name: record.name,
      version: record.version,
      content: record.content,
    });
    setTemplateModalVisible(true);
  };

  const handleSaveTemplate = async () => {
    try {
      const values = await templateForm.validateFields();
      setTemplateSaving(true);
      await saveRAGPromptTemplate(values as { name: string; version: string; content: string });
      message.success(editingTemplate ? '模板更新成功' : '模板创建成功');
      setTemplateModalVisible(false);
      templateForm.resetFields();
      await loadTemplates();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      message.error(`保存模板失败: ${(error as Error).message}`);
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleDeleteTemplate = async (record: PromptTemplate) => {
    if (!record.id) {
      message.error('模板 ID 缺失，无法删除');
      return;
    }
    try {
      await deleteRAGPromptTemplate(record.id);
      message.success('模板删除成功');
      await loadTemplates();
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  const handleTriggerIndex = async () => {
    setIndexRebuilding(true);
    try {
      await triggerRAGIndex();
      message.success('索引重建已触发，请稍后查看结果');
    } catch (error: unknown) {
      message.error(`触发索引重建失败: ${(error as Error).message}`);
    } finally {
      setIndexRebuilding(false);
    }
  };

  return {
    activeTab,
    setActiveTab,
    configLoading,
    setConfigLoading,
    configSaving,
    setConfigSaving,
    config,
    setConfig,
    configForm,
    templates,
    setTemplates,
    templatesLoading,
    setTemplatesLoading,
    templateModalVisible,
    setTemplateModalVisible,
    editingTemplate,
    setEditingTemplate,
    templateForm,
    templateSaving,
    setTemplateSaving,
    indexRebuilding,
    loadConfig,
    loadTemplates,
    handleSaveConfig,
    openNewTemplate,
    openEditTemplate,
    handleSaveTemplate,
    handleDeleteTemplate,
    handleTriggerIndex,
  };
};

export type RAGAdminState = ReturnType<typeof useRAGAdminState>;
