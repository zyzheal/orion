/**
 * PR Trigger Management state hook
 * 抽取自 index.tsx (P2-9 Phase 153)
 */
import { useCallback, useEffect, useState } from 'react';
import { Form, Modal, message } from 'antd';
import {
  getPRTriggerRules,
  createPRTrigger,
  updatePRTrigger,
  deletePRTrigger,
  type PRTriggerRule,
} from '@/api/prTriggers';
import { getPipelines } from '@/api/pipelines';
import type { PRTriggerConfig as PRTriggerConfigType } from '@/components/PRTriggerConfig';
import type { PRTriggerFormValues } from './types';

const DEFAULT_PR_CONFIG: Partial<PRTriggerConfigType> = {
  enabled: true,
  provider: 'github',
  prActions: ['opened', 'synchronize'],
};

export function usePRTriggerManagementState() {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<PRTriggerRule[]>([]);
  const [pipelines, setPipelines] = useState<Array<{ label: string; value: string }>>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<PRTriggerRule | null>(null);
  const [form] = Form.useForm<PRTriggerFormValues>();
  const [prConfig, setPrConfig] = useState<Partial<PRTriggerConfigType>>(DEFAULT_PR_CONFIG);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, pipelinesRes] = await Promise.allSettled([
        getPRTriggerRules(''),
        getPipelines(),
      ]);

      if (rulesRes.status === 'fulfilled') {
        const data = rulesRes.value.data;
        setRules(Array.isArray(data) ? data : []);
      }

      if (pipelinesRes.status === 'fulfilled') {
        const data = pipelinesRes.value.data;
        const list = Array.isArray(data) ? data : [];
        setPipelines(
          list.map((p: { id: string; name: string }) => ({
            label: p.name,
            value: p.id,
          })),
        );
      }
    } catch (error: unknown) {
      message.error(`加载数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = useCallback(
    async (values: PRTriggerFormValues) => {
      try {
        await createPRTrigger(values.pipelineId, {
          provider: prConfig.provider || 'github',
          repository: values.repository,
          enabled: true,
          prActions: prConfig.prActions || ['opened', 'synchronize'],
          branchFilter: prConfig.branchFilter || { targetBranches: ['main'], sourceBranches: [] },
          pathFilter: prConfig.pathFilter || { includePaths: [], excludePaths: [] },
          labelFilter: prConfig.labelFilter || { requiredLabels: [], excludedLabels: [] },
          draftPolicy: (prConfig.draftPolicy || 'skip') as 'skip' | 'run',
          securityLevel: (prConfig.securityLevel || 'safe') as 'safe' | 'trusted' | 'full',
          statusCheckName: prConfig.statusCheckName,
          autoComment: prConfig.autoComment || false,
          commentTemplate: prConfig.commentTemplate,
        } as Omit<PRTriggerRule, 'id' | 'createdAt' | 'updatedAt'>);
        message.success('PR触发规则创建成功');
        setModalVisible(false);
        form.resetFields();
        loadData();
      } catch (error: unknown) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    },
    [prConfig, form, loadData],
  );

  const handleUpdate = useCallback(
    async (ruleId: string, values: PRTriggerFormValues) => {
      try {
        const existingRule = rules.find((r) => r.id === ruleId);
        if (!existingRule) return;

        await updatePRTrigger(existingRule.pipelineId, ruleId, {
          provider: prConfig.provider || existingRule.provider,
          repository: values.repository || existingRule.repository,
          prActions: prConfig.prActions || existingRule.prActions,
          branchFilter: prConfig.branchFilter || existingRule.branchFilter,
          pathFilter: prConfig.pathFilter || existingRule.pathFilter,
          labelFilter: prConfig.labelFilter || existingRule.labelFilter,
          draftPolicy: prConfig.draftPolicy || existingRule.draftPolicy,
          securityLevel: prConfig.securityLevel || existingRule.securityLevel,
          statusCheckName: prConfig.statusCheckName,
          autoComment: prConfig.autoComment ?? existingRule.autoComment,
          commentTemplate: prConfig.commentTemplate,
        });
        message.success('PR触发规则更新成功');
        setModalVisible(false);
        form.resetFields();
        loadData();
      } catch (error: unknown) {
        message.error(`更新失败: ${(error as Error).message}`);
      }
    },
    [rules, prConfig, form, loadData],
  );

  const handleDelete = useCallback(
    (ruleId: string) => {
      const existingRule = rules.find((r) => r.id === ruleId);
      if (!existingRule) return;

      Modal.confirm({
        title: '确认删除',
        content: '确定要删除此PR触发规则吗？',
        onOk: async () => {
          try {
            await deletePRTrigger(existingRule.pipelineId, ruleId);
            message.success('PR触发规则已删除');
            loadData();
          } catch (error: unknown) {
            message.error(`删除失败: ${(error as Error).message}`);
          }
        },
      });
    },
    [rules, loadData],
  );

  const handleToggle = useCallback(
    async (ruleId: string, newEnabledState: boolean) => {
      const existingRule = rules.find((r) => r.id === ruleId);
      if (!existingRule) return;

      try {
        await updatePRTrigger(existingRule.pipelineId, ruleId, { enabled: newEnabledState });
        message.success(newEnabledState ? '规则已启用' : '规则已禁用');
        loadData();
      } catch (error: unknown) {
        message.error(`更新失败: ${(error as Error).message}`);
      }
    },
    [rules, loadData],
  );

  const handleEdit = useCallback(
    (record: PRTriggerRule) => {
      setEditingRule(record);
      setPrConfig({
        enabled: true,
        provider: record.provider,
        prActions: record.prActions,
        branchFilter: record.branchFilter,
        pathFilter: record.pathFilter,
        labelFilter: record.labelFilter,
        draftPolicy: record.draftPolicy,
        securityLevel: record.securityLevel,
        statusCheckName: record.statusCheckName,
        autoComment: record.autoComment,
        commentTemplate: record.commentTemplate,
      });
      form.setFieldsValue({
        pipelineId: record.pipelineId,
        repository: record.repository,
      });
      setModalVisible(true);
    },
    [form],
  );

  const handleModalClose = useCallback(() => {
    setModalVisible(false);
    setEditingRule(null);
    form.resetFields();
    setPrConfig(DEFAULT_PR_CONFIG);
  }, [form]);

  const handleModalOk = useCallback(() => {
    form.validateFields().then((values) => {
      if (editingRule) {
        handleUpdate(editingRule.id!, values);
      } else {
        handleCreate(values);
      }
    });
  }, [form, editingRule, handleUpdate, handleCreate]);

  return {
    loading,
    rules,
    pipelines,
    modalVisible,
    editingRule,
    form,
    prConfig,
    setPrConfig,
    loadData,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleToggle,
    handleEdit,
    handleModalClose,
    handleModalOk,
    setModalVisible,
  };
}

export type PRTriggerManagementState = ReturnType<typeof usePRTriggerManagementState>;
