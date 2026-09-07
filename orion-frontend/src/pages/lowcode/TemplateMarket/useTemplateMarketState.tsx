/**
 * TemplateMarket state hook
 * 抽取自 index.tsx (P2-9 Phase 141)
 */
import { useEffect, useState } from 'react';
import { Form, message } from 'antd';
import { lowcodeApi, type LowcodeTemplate, type LowcodeFlow } from '@/api/lowcode';
import type { ApplyTemplateInput, PublishFormValues } from './types';

export const useTemplateMarketState = () => {
  const [templates, setTemplates] = useState<LowcodeTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [_page, setPage] = useState(1);
  const [_pageSize] = useState(12);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // Selected template for detail
  const [selectedTemplate, setSelectedTemplate] = useState<LowcodeTemplate | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // Apply template modal
  const [applyVisible, setApplyVisible] = useState(false);
  const [templateToApply, setTemplateToApply] = useState<LowcodeTemplate | null>(null);
  const [applyForm] = Form.useForm();
  const [applying, setApplying] = useState(false);

  // Create template modal (publish flow as template)
  const [publishVisible, setPublishVisible] = useState(false);
  const [publishForm] = Form.useForm();
  const [publishing, setPublishing] = useState(false);
  const [flows, setFlows] = useState<LowcodeFlow[]>([]);

  // Load templates
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = (await lowcodeApi.listTemplates()) as unknown as LowcodeTemplate[];
      let templates = data || [];
      if (categoryFilter) {
        templates = templates.filter((t: LowcodeTemplate) => t.category === categoryFilter);
      }
      if (searchText) {
        const lower = searchText.toLowerCase();
        templates = templates.filter(
          (t: LowcodeTemplate) =>
            t.name.toLowerCase().includes(lower) || t.description?.toLowerCase().includes(lower)
        );
      }
      setTemplates(templates);
      setTotal(templates.length);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载模板列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [categoryFilter, searchText]);

  // Load flows for publishing
  const loadFlows = async () => {
    try {
      const result = await lowcodeApi.listFlows();
      setFlows(result.flows || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载流程列表失败';
      message.error(msg);
    }
  };

  // Apply template
  const handleOpenApply = (template: LowcodeTemplate) => {
    setTemplateToApply(template);
    applyForm.resetFields();
    setApplyVisible(true);
  };

  const handleApplyTemplate = async (values: ApplyTemplateInput) => {
    if (!templateToApply) return;
    setApplying(true);
    try {
      await lowcodeApi.applyTemplate(templateToApply.id, {
        workflowName: values.workflowName,
        description: values.description,
      });
      message.success(`流程 "${values.workflowName}" 已创建`);
      setApplyVisible(false);
      setTemplateToApply(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '应用模板失败';
      message.error(msg);
    } finally {
      setApplying(false);
    }
  };

  // View template detail
  const handleViewDetail = (template: LowcodeTemplate) => {
    setSelectedTemplate(template);
    setDetailVisible(true);
  };

  // Publish flow as template
  const handleOpenPublish = () => {
    loadFlows();
    publishForm.resetFields();
    setPublishVisible(true);
  };

  const handlePublish = async (values: PublishFormValues) => {
    setPublishing(true);
    try {
      const flow = flows.find((f) => f.id === values.flowId);
      if (!flow) {
        message.error('请选择流程');
        return;
      }

      await lowcodeApi.createTemplate({
        name: values.name,
        description: values.description || flow.description,
        category: values.category || 'custom',
      });

      message.success(`模板 "${values.name}" 发布成功`);
      setPublishVisible(false);
      publishForm.resetFields();
      loadTemplates();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '发布模板失败';
      message.error(msg);
    } finally {
      setPublishing(false);
    }
  };

  const closeDetail = () => {
    setDetailVisible(false);
    setSelectedTemplate(null);
  };

  const closeApply = () => {
    setApplyVisible(false);
    setTemplateToApply(null);
    applyForm.resetFields();
  };

  const closePublish = () => {
    setPublishVisible(false);
    publishForm.resetFields();
  };

  return {
    // templates
    templates,
    loading,
    total,
    setPage,
    // filters
    searchText,
    setSearchText,
    categoryFilter,
    setCategoryFilter,
    // detail
    selectedTemplate,
    detailVisible,
    closeDetail,
    // apply
    applyVisible,
    templateToApply,
    applyForm,
    applying,
    handleOpenApply,
    handleApplyTemplate,
    closeApply,
    // publish
    publishVisible,
    publishForm,
    publishing,
    flows,
    handleOpenPublish,
    handlePublish,
    closePublish,
    loadTemplates,
  };
};

export type TemplateMarketState = ReturnType<typeof useTemplateMarketState>;
