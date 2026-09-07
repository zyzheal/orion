/**
 * ConfigManagement state hook
 * 抽取自 index.tsx (P2-9 Phase 174)
 */
import { useState, useEffect } from 'react';
import { Form, Modal, message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import {
  getConfigs,
  createConfig,
  updateConfig,
  deleteConfig,
  getGitOpsConfig,
  syncFromGit,
  submitForApproval,
  compareEnvironments,
  compareConfigs,
  getDiffReport,
  detectDrift,
  type ConfigItem,
  type GitOpsConfig,
  type ConfigDiff,
  type EnvDiffResult,
  type DriftResult,
} from '@/api/config';
import type { DiffReportData } from './DiffTab';

export function useConfigManagementState() {
  const [selectedConfig, setSelectedConfig] = useState<ConfigItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ConfigItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [form] = Form.useForm();

  // === Diff Tab state ===
  const [activeTab, setActiveTab] = useState('overview');
  const [sourceEnv, setSourceEnv] = useState<string>('dev');
  const [targetEnv, setTargetEnv] = useState<string>('staging');
  const [envDiffLoading, setEnvDiffLoading] = useState(false);
  const [envDiffResult, setEnvDiffResult] = useState<EnvDiffResult | null>(null);
  const [versionDiffConfigId, setVersionDiffConfigId] = useState<string>('');
  const [versionA, setVersionA] = useState<number>(1);
  const [versionB, setVersionB] = useState<number>(2);
  const [versionDiffLoading, setVersionDiffLoading] = useState(false);
  const [versionDiffResult, setVersionDiffResult] = useState<ConfigDiff | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [diffReport, setDiffReport] = useState<DiffReportData | null>(null);

  // === Drift Detection state ===
  const [driftLoading, setDriftLoading] = useState(false);
  const [driftResult, setDriftResult] = useState<DriftResult | null>(null);

  const {
    data: initialData,
    isLoading: loading,
    isError,
    error,
    refetch: loadData,
  } = useQuery<{ configs: ConfigItem[]; gitOpsConfig: GitOpsConfig | null }>({
    queryKey: ['config-management'],
    queryFn: async () => {
      const [configsRes, gitOpsRes] = await Promise.all([
        getConfigs({ pageSize: 50 }),
        getGitOpsConfig(),
      ]);
      return {
        configs: configsRes.data.configs || [],
        gitOpsConfig: gitOpsRes.data || null,
      };
    },
    staleTime: 30_000,
  });

  const configs = initialData?.configs ?? [];
  const gitOpsConfig = initialData?.gitOpsConfig ?? null;

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  useEffect(() => {
    if (!isError) return;
    if (error instanceof Error) {
      message.error(`加载配置失败：${error.message}`);
    } else {
      message.error('加载配置失败，请稍后重试');
    }
  }, [isError, error]);

  const handleCreate = async (values: any) => {
    setSubmitting(true);
    try {
      if (editingConfig) {
        await updateConfig(editingConfig.id, values);
        message.success('配置更新成功');
      } else {
        await createConfig(values);
        message.success('配置创建成功');
      }
      setCreateModalOpen(false);
      setEditingConfig(null);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`${editingConfig ? '更新' : '创建'}配置失败：${error.message}`);
      } else {
        message.error(`${editingConfig ? '更新' : '创建'}配置失败，请稍后重试`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (record: ConfigItem) => {
    setEditingConfig(record);
    form.setFieldsValue({
      key: record.key,
      value: record.value,
      environment: record.environment,
      category: record.category,
      sensitive: record.sensitive,
      encrypted: record.encrypted,
      description: record.description,
    });
    setCreateModalOpen(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '删除配置',
      content: '确定要删除此配置项吗？此操作不可撤销。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteConfig(id);
          message.success('配置已删除');
          loadData();
        } catch (error: unknown) {
          if (error instanceof Error) {
            message.error(`删除失败：${error.message}`);
          } else {
            message.error('删除失败');
          }
        }
      },
    });
  };

  const handleSync = async () => {
    try {
      await syncFromGit();
      message.success('Git 同步成功');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`同步失败：${error.message}`);
      } else {
        message.error('同步失败，请稍后重试');
      }
    }
  };

  const handleApproval = async (id: string) => {
    try {
      await submitForApproval(id, ['admin']);
      message.success('已提交审批');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`提交失败：${error.message}`);
      } else {
        message.error('提交失败，请稍后重试');
      }
    }
  };

  const handleEnvCompare = async () => {
    if (!sourceEnv || !targetEnv) {
      message.warning('请选择源环境和目标环境');
      return;
    }
    if (sourceEnv === targetEnv) {
      message.warning('源环境和目标环境不能相同');
      return;
    }
    setEnvDiffLoading(true);
    try {
      const res = await compareEnvironments(sourceEnv, targetEnv);
      setEnvDiffResult(res.data);
      message.success('环境对比完成');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`环境对比失败：${error.message}`);
      } else {
        message.error('环境对比失败，请稍后重试');
      }
    } finally {
      setEnvDiffLoading(false);
    }
  };

  const handleVersionCompare = async () => {
    if (!versionDiffConfigId) {
      message.warning('请选择配置项');
      return;
    }
    if (!versionA || !versionB) {
      message.warning('请选择对比版本');
      return;
    }
    if (versionA === versionB) {
      message.warning('两个版本不能相同');
      return;
    }
    setVersionDiffLoading(true);
    try {
      const res = await compareConfigs(versionDiffConfigId, versionA, versionB);
      setVersionDiffResult(res.data);
      message.success('版本对比完成');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`版本对比失败：${error.message}`);
      } else {
        message.error('版本对比失败，请稍后重试');
      }
    } finally {
      setVersionDiffLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      const res = await getDiffReport();
      const data = res.data;
      setDiffReport({
        totalConfigs: data.totalConfigs,
        totalDifferences: data.summary.totalDifferences,
        items: data.items.map((item) => ({
          key: item.key,
          environment: item.environment,
          changes: item.changes,
        })),
      });
      message.success('报告生成成功');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`生成报告失败：${error.message}`);
      } else {
        message.error('生成报告失败，请稍后重试');
      }
    } finally {
      setReportLoading(false);
    }
  };

  const handleDriftDetect = async () => {
    setDriftLoading(true);
    try {
      const res = await detectDrift();
      setDriftResult(res.data);
      if (res.data.driftDetected) {
        message.warning(`发现 ${res.data.itemCount} 处配置漂移`);
      } else {
        message.success('未检测到配置漂移');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`漂移检测失败：${error.message}`);
      } else {
        message.error('漂移检测失败，请稍后重试');
      }
    } finally {
      setDriftLoading(false);
    }
  };

  const handleModalClose = () => {
    setCreateModalOpen(false);
    setEditingConfig(null);
    form.resetFields();
  };

  const openViewDetail = (record: ConfigItem) => {
    setSelectedConfig(record);
    setDetailDrawerOpen(true);
  };

  return {
    // data
    configs,
    gitOpsConfig,
    loading,
    form,
    // UI state
    selectedConfig,
    createModalOpen,
    setCreateModalOpen,
    editingConfig,
    submitting,
    detailDrawerOpen,
    setDetailDrawerOpen,
    activeTab,
    setActiveTab,
    sourceEnv,
    setSourceEnv,
    targetEnv,
    setTargetEnv,
    envDiffLoading,
    envDiffResult,
    versionDiffConfigId,
    setVersionDiffConfigId,
    versionA,
    setVersionA,
    versionB,
    setVersionB,
    versionDiffLoading,
    versionDiffResult,
    reportLoading,
    diffReport,
    driftLoading,
    driftResult,
    // actions
    loadData,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSync,
    handleApproval,
    handleEnvCompare,
    handleVersionCompare,
    handleGenerateReport,
    handleDriftDetect,
    handleModalClose,
    openViewDetail,
  };
}
