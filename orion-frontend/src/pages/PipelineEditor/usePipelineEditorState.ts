/**
 * Pipeline Editor 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 104)
 */
import { useState, useCallback, useEffect, Form } from 'react';
import { message, Modal } from 'antd';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { arrayMove } from '@dnd-kit/sortable';
import { getPipeline, createPipeline, updatePipeline } from '@/api/pipelines';
import { pipelineTemplates } from '@/api/pipeline-templates';
import type { StageConfig } from './types';
import type { PipelineForm } from './pipelineForm';
import { generatePipelineYaml } from './yaml';

export const usePipelineEditorState = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template');
  const [form] = Form.useForm();

  // Pipeline 基本信息
  const [pipelineInfo, setPipelineInfo] = useState<PipelineForm>({
    name: '',
    version: '1.0.0',
    description: '',
  });

  // Stage 列表
  const [stages, setStages] = useState<StageConfig[]>([]);

  // Stage 编辑弹窗
  const [stageModalVisible, setStageModalVisible] = useState(false);
  const [editingStage, setEditingStage] = useState<StageConfig | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // YAML 预览
  const [yamlPreviewVisible, setYamlPreviewVisible] = useState(false);
  const [generatedYaml, setGeneratedYaml] = useState('');

  // DAG 预览
  const [dagPreviewVisible, setDagPreviewVisible] = useState(false);

  // 保存中状态
  const [saving, setSaving] = useState(false);

  // 加载现有 Pipeline（编辑模式）
  useEffect(() => {
    if (id) {
      getPipeline(id)
        .then((response) => {
          const rawBody = response.data as { data?: unknown };
          const pipeline = rawBody?.data ?? rawBody;
          if (pipeline) {
            const info = {
              name: (pipeline as any).name,
              version: String((pipeline as any).version || '1.0.0'),
              description: (pipeline as any).description || '',
            };
            setPipelineInfo(info);
            form.setFieldsValue(info);
            // 从 spec.stages 加载 Stage，支持后端格式和前端格式
            if ((pipeline as any).spec?.stages) {
              const loadedStages: StageConfig[] = (pipeline as any).spec.stages.map(
                (s: any, idx: number) => {
                  // 后端格式: { name, runsOn, steps: [{ name, uses, with }], timeout, retries, ... }
                  const stepType =
                    s.steps?.[0]?.uses?.split('@')[0]?.replace('orion/', '') || s.type || 'custom';
                  const stepConfig = s.steps?.[0]?.with || s.config || {};
                  return {
                    id: `stage-${idx}-${Date.now()}`,
                    name: s.name,
                    type: stepType,
                    timeout: s.timeout,
                    retryCount: s.retries ?? s.retryCount,
                    dependsOn: s.dependsOn || [],
                    config: stepConfig,
                    cache: s.cache,
                    artifacts: s.artifacts,
                  };
                }
              );
              setStages(loadedStages);
            }
          }
        })
        .catch((error: unknown) => {
          if (error instanceof Error) {
            message.error(`加载 Pipeline 失败：${error.message}`);
          } else {
            message.error('加载 Pipeline 失败');
          }
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load template stages (when creating from template)
  useEffect(() => {
    if (templateId && !id) {
      const tpl = pipelineTemplates.find((t) => t.id === templateId);
      if (tpl) {
        setPipelineInfo({
          name: tpl.name,
          version: '1.0.0',
          description: tpl.description,
        });
        const loadedStages: StageConfig[] = tpl.stages.map((s, idx) => ({
          id: `stage-${idx}-${Date.now()}`,
          name: s.name,
          type: s.type,
          timeout: 300,
          retryCount: 0,
          dependsOn: [],
          config: s.config || {},
        }));
        setStages(loadedStages);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, id]);

  // 生成 YAML
  const generateYaml = useCallback(() => {
    return generatePipelineYaml({ pipelineInfo, stages });
  }, [pipelineInfo, stages]);

  // 处理拖拽结束
  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setStages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  // 打开 Stage 编辑弹窗
  const openStageModal = useCallback((stage?: StageConfig, index?: number) => {
    setEditingStage(stage || null);
    setEditingIndex(index ?? null);
    setStageModalVisible(true);
  }, []);

  // 保存 Stage
  const handleSaveStage = useCallback(
    (values: StageConfig) => {
      if (editingIndex !== null && editingStage) {
        // 编辑现有 Stage
        const newStages = [...stages];
        newStages[editingIndex] = values;
        setStages(newStages);
        message.success('阶段已更新');
      } else {
        // 添加新 Stage
        setStages([...stages, values]);
        message.success('阶段已添加');
      }
      setStageModalVisible(false);
      setEditingStage(null);
      setEditingIndex(null);
    },
    [stages, editingIndex, editingStage]
  );

  // 删除 Stage
  const handleDeleteStage = useCallback(
    (index: number) => {
      const stage = stages[index];
      Modal.confirm({
        title: '确认删除',
        content: `确定要删除阶段 "${stage.name}" 吗？`,
        onOk: () => {
          const newStages = stages.filter((_, i) => i !== index);
          // 同时更新其他 Stage 的依赖关系
          newStages.forEach((s) => {
            if (s.dependsOn?.includes(stage.name)) {
              s.dependsOn = s.dependsOn.filter((d) => d !== stage.name);
            }
          });
          setStages(newStages);
          message.success('阶段已删除');
        },
      });
    },
    [stages]
  );

  // 验证 Stage 依赖
  const validateDependencies = useCallback((): boolean => {
    const stageNames = new Set(stages.map((s) => s.name));
    for (const stage of stages) {
      if (stage.dependsOn) {
        for (const dep of stage.dependsOn) {
          if (!stageNames.has(dep)) {
            message.error(`阶段 "${stage.name}" 依赖了不存在的阶段 "${dep}"`);
            return false;
          }
          // 检查循环依赖
          if (dep === stage.name) {
            message.error(`阶段 "${stage.name}" 不能依赖自己`);
            return false;
          }
        }
      }
    }
    return true;
  }, [stages]);

  // 保存 Pipeline
  const handleSavePipeline = useCallback(async () => {
    if (!pipelineInfo.name.trim()) {
      message.error('请输入 Pipeline 名称');
      return;
    }
    if (!pipelineInfo.version.trim()) {
      message.error('请输入版本号');
      return;
    }

    if (stages.length === 0) {
      message.error('请至少添加一个阶段');
      return;
    }

    if (!validateDependencies()) {
      return;
    }

    setSaving(true);
    try {
      const yaml = generateYaml();

      // 调用真实 API
      if (id) {
        await updatePipeline(id, { yamlDefinition: yaml });
        message.success('Pipeline 已更新');
      } else {
        await createPipeline({
          name: pipelineInfo.name,
          version: pipelineInfo.version,
          description: pipelineInfo.description,
          yamlDefinition: yaml,
        });
        message.success('Pipeline 已创建');
      }

      navigate('/pipelines');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`保存失败：${error.message}`);
      } else {
        message.error('保存失败，请重试');
      }
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, stages, pipelineInfo, generateYaml, validateDependencies, id, navigate]);

  // 预览 YAML
  const handlePreviewYaml = useCallback(() => {
    const yaml = generateYaml();
    setGeneratedYaml(yaml);
    setYamlPreviewVisible(true);
  }, [generateYaml]);

  // 可用的依赖选项（当前 Stage 之前的所有 Stage）
  const getAvailableDependencies = useCallback(
    (currentIndex: number) => {
      return stages
        .filter((_, index) => index < currentIndex)
        .map((s) => ({ label: s.name, value: s.name }));
    },
    [stages]
  );

  // 重置
  const handleReset = useCallback(() => {
    setStages([]);
    setPipelineInfo({ name: '', version: '1.0.0', description: '' });
    message.success('已重置');
  }, []);

  return {
    // state
    pipelineInfo,
    setPipelineInfo,
    stages,
    setStages,
    stageModalVisible,
    setStageModalVisible,
    editingStage,
    setEditingStage,
    editingIndex,
    setEditingIndex,
    yamlPreviewVisible,
    setYamlPreviewVisible,
    generatedYaml,
    setGeneratedYaml,
    dagPreviewVisible,
    setDagPreviewVisible,
    saving,
    setSaving,
    form,
    id,
    navigate,
    // callbacks
    generateYaml,
    handleDragEnd,
    openStageModal,
    handleSaveStage,
    handleDeleteStage,
    validateDependencies,
    handleSavePipeline,
    handlePreviewYaml,
    getAvailableDependencies,
    handleReset,
  };
};

export type PipelineEditorState = ReturnType<typeof usePipelineEditorState>;
