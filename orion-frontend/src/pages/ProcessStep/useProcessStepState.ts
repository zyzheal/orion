/**
 * useProcessStepState.ts - 流程引擎状态钩子
 * 抽取自 ProcessStep/index.tsx (P2-9 Phase 96)
 */
import { useState, useEffect, useCallback } from 'react';
import { Form, message } from 'antd';
import {
  listDefinitions,
  getDefinition,
  createDefinition,
  updateDefinition,
  deleteDefinition,
  listInstances,
  getInstance,
  startInstance,
  getStepHistory,
  advanceStep,
  type ProcessDefinition,
  type ProcessInstance,
  type ProcessStepInstance,
  type ProcessStepDef,
  type CreateDefinitionInput,
} from '@/api/process-steps';
import { actionLabel } from './constants';

export const useProcessStepState = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState('definitions');

  // Definition state
  const [definitions, setDefinitions] = useState<ProcessDefinition[]>([]);
  const [defLoading, setDefLoading] = useState(false);
  const [defTotal, setDefTotal] = useState(0);
  const [defPage, setDefPage] = useState(1);
  const [defFilter, setDefFilter] = useState<{ entityType?: string; enabled?: boolean }>({});

  // Instance state
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [instLoading, setInstLoading] = useState(false);
  const [instTotal, setInstTotal] = useState(0);
  const [instPage, setInstPage] = useState(1);
  const [instFilter, setInstFilter] = useState<{ status?: string; definitionId?: string }>({});

  // Definition form modal
  const [defModalOpen, setDefModalOpen] = useState(false);
  const [defModalLoading, setDefModalLoading] = useState(false);
  const [editingDef, setEditingDef] = useState<ProcessDefinition | null>(null);
  const [defForm] = Form.useForm();

  // Instance start modal
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [startModalLoading, setStartModalLoading] = useState(false);
  const [startForm] = Form.useForm();

  // Detail drawer
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [detailInstance, setDetailInstance] = useState<ProcessInstance | null>(null);
  const [stepHistory, setStepHistory] = useState<ProcessStepInstance[]>([]);
  const [stepLoading, setStepLoading] = useState(false);

  // Definition detail drawer
  const [defDetailOpen, setDefDetailOpen] = useState(false);
  const [defDetail, setDefDetail] = useState<ProcessDefinition | null>(null);

  /* ==================== Data Loading ==================== */

  const fetchDefinitions = useCallback(async () => {
    setDefLoading(true);
    try {
      const res = await listDefinitions({
        ...defFilter,
        limit: 20,
        offset: (defPage - 1) * 20,
      });
      setDefinitions(res.data.data || []);
      setDefTotal(res.data.total || 0);
    } catch {
      message.error('加载流程定义失败');
    } finally {
      setDefLoading(false);
    }
  }, [defFilter, defPage]);

  const fetchInstances = useCallback(async () => {
    setInstLoading(true);
    try {
      const res = await listInstances({
        ...instFilter,
        limit: 20,
        offset: (instPage - 1) * 20,
      });
      setInstances(res.data.data || []);
      setInstTotal(res.data.total || 0);
    } catch {
      message.error('加载流程实例失败');
    } finally {
      setInstLoading(false);
    }
  }, [instFilter, instPage]);

  useEffect(() => {
    if (activeTab === 'definitions') fetchDefinitions();
    else fetchInstances();
  }, [activeTab, fetchDefinitions, fetchInstances]);

  /* ==================== Definition CRUD ==================== */

  const handleCreateDef = () => {
    setEditingDef(null);
    defForm.resetFields();
    defForm.setFieldsValue({ enabled: true, steps: [{}], transitions: [] });
    setDefModalOpen(true);
  };

  const handleEditDef = (def: ProcessDefinition) => {
    setEditingDef(def);
    defForm.setFieldsValue({
      name: def.name,
      description: def.description,
      entityType: def.entityType,
      enabled: def.enabled,
      steps: def.steps.length > 0 ? def.steps : [{}],
    });
    setDefModalOpen(true);
  };

  const handleSaveDef = async () => {
    try {
      const values = await defForm.validateFields();
      setDefModalLoading(true);

      const steps = (values.steps || [])
        .filter((s: ProcessStepDef) => s.name)
        .map((s: ProcessStepDef, i: number) => ({
          id: s.id || `step-${i + 1}`,
          name: s.name,
          type: s.type || 'auto',
          handler: s.handler,
        }));

      const input: CreateDefinitionInput = {
        name: values.name,
        description: values.description,
        entityType: values.entityType,
        steps,
        enabled: values.enabled ?? true,
      };

      if (editingDef) {
        await updateDefinition(editingDef.id, input);
        message.success('流程定义已更新');
      } else {
        await createDefinition(input);
        message.success('流程定义已创建');
      }

      setDefModalOpen(false);
      fetchDefinitions();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return; // form validation
      message.error('保存流程定义失败');
    } finally {
      setDefModalLoading(false);
    }
  };

  const handleDeleteDef = async (id: string) => {
    try {
      await deleteDefinition(id);
      message.success('流程定义已删除');
      fetchDefinitions();
    } catch {
      message.error('删除流程定义失败');
    }
  };

  const handleViewDefDetail = async (id: string) => {
    try {
      const res = await getDefinition(id);
      setDefDetail(res.data.data);
      setDefDetailOpen(true);
    } catch {
      message.error('加载流程定义详情失败');
    }
  };

  /* ==================== Instance Management ==================== */

  const handleStartInstance = (defId?: string) => {
    startForm.resetFields();
    if (defId) startForm.setFieldsValue({ definitionId: defId });
    setStartModalOpen(true);
  };

  const handleConfirmStart = async () => {
    try {
      const values = await startForm.validateFields();
      setStartModalLoading(true);
      await startInstance({
        definitionId: values.definitionId,
        entityType: values.entityType || 'default',
        entityId: values.entityId || `entity-${Date.now()}`,
      });
      message.success('流程实例已启动');
      setStartModalOpen(false);
      fetchInstances();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('启动流程实例失败');
    } finally {
      setStartModalLoading(false);
    }
  };

  const handleViewInstance = async (id: string) => {
    try {
      setStepLoading(true);
      setDetailDrawerOpen(true);
      const [instRes, historyRes] = await Promise.all([getInstance(id), getStepHistory(id)]);
      setDetailInstance(instRes.data.data);
      setStepHistory(historyRes.data.data || []);
    } catch {
      message.error('加载实例详情失败');
    } finally {
      setStepLoading(false);
    }
  };

  const handleAdvanceStep = async (instanceId: string, stepId: string, action: string) => {
    try {
      await advanceStep(instanceId, stepId, { action });
      message.success(`步骤已${actionLabel[action] || action}`);
      // Refresh detail
      handleViewInstance(instanceId);
      fetchInstances();
    } catch {
      message.error('操作失败');
    }
  };

  return {
    // Tab
    activeTab,
    setActiveTab,
    // Definition
    definitions,
    setDefinitions,
    defLoading,
    defTotal,
    defPage,
    setDefPage,
    defFilter,
    setDefFilter,
    // Instance
    instances,
    setInstances,
    instLoading,
    instTotal,
    instPage,
    setInstPage,
    instFilter,
    setInstFilter,
    // Def modal
    defModalOpen,
    setDefModalOpen,
    defModalLoading,
    setDefModalLoading,
    editingDef,
    setEditingDef,
    defForm,
    // Start modal
    startModalOpen,
    setStartModalOpen,
    startModalLoading,
    setStartModalLoading,
    startForm,
    // Detail drawer
    detailDrawerOpen,
    setDetailDrawerOpen,
    detailInstance,
    setDetailInstance,
    stepHistory,
    setStepHistory,
    stepLoading,
    setStepLoading,
    // Def detail drawer
    defDetailOpen,
    setDefDetailOpen,
    defDetail,
    setDefDetail,
    // Loaders
    fetchDefinitions,
    fetchInstances,
    // Handlers
    handleCreateDef,
    handleEditDef,
    handleSaveDef,
    handleDeleteDef,
    handleViewDefDetail,
    handleStartInstance,
    handleConfirmStart,
    handleViewInstance,
    handleAdvanceStep,
  };
};

export type ProcessStepState = ReturnType<typeof useProcessStepState>;
