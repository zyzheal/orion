/**
 * useInternalLibraryState.ts - 二方库管理状态 Hook
 * 抽取自 InternalLibrary/index.tsx (P2-9 Phase 74)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { message, Form } from 'antd';
import type { FilterDefinition } from '@/components/SearchFilterBar';
import {
  getInternalLibraries,
  createInternalLibrary,
  deleteInternalLibrary,
  activateInternalLibrary,
  deprecateInternalLibrary,
  publishVersion,
  getVersions,
  deprecateVersion,
  getDependents,
  addDependent,
  updateDependent,
  updateDependentStats,
  type InternalLibrary,
  type LibraryVersion,
  type LibraryDependent,
  type CreateLibraryInput,
  type PublishVersionInput,
  type DeprecateLibraryInput,
  type AddDependentInput,
  type LibraryLanguage,
} from '@/api/internal-library';

const languageOptions = Object.entries({
  java: 'Java',
  node: 'Node.js',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  dotnet: '.NET',
} as Record<LibraryLanguage, string>).map(([value, label]) => ({ label, value }));

const statusOptions = [
  { label: '全部', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Development', value: 'development' },
  { label: 'Deprecated', value: 'deprecated' },
  { label: 'Archived', value: 'archived' },
];

export const useInternalLibraryState = () => {
  const [loading, setLoading] = useState(false);
  const [libraries, setLibraries] = useState<InternalLibrary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedLib, setSelectedLib] = useState<InternalLibrary | null>(null);
  const [versions, setVersions] = useState<LibraryVersion[]>([]);
  const [dependents, setDependents] = useState<LibraryDependent[]>([]);
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [deprecateModalVisible, setDeprecateModalVisible] = useState(false);
  const [deprecateVersionModalVisible, setDeprecateVersionModalVisible] = useState(false);
  const [addDependentModalVisible, setAddDependentModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [versionForm] = Form.useForm();
  const [deprecateForm] = Form.useForm();
  const [deprecateVersionForm] = Form.useForm();
  const [addDependentForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('info');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getInternalLibraries();
      setLibraries(Array.isArray(res.data) ? res.data : []);
    } catch (error: unknown) {
      setLibraries([]);
      message.error(`加载二方库数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredData = useMemo(() => {
    return libraries.filter((lib) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !lib.name.toLowerCase().includes(q) &&
          !(lib.displayName && lib.displayName.toLowerCase().includes(q)) &&
          !(lib.description && lib.description.toLowerCase().includes(q))
        )
          return false;
      }
      if (filters.language && filters.language !== 'all' && lib.language !== filters.language)
        return false;
      if (filters.status && filters.status !== 'all' && lib.status !== filters.status) return false;
      if (filters.owner && filters.owner !== 'all' && lib.owner !== filters.owner) return false;
      return true;
    });
  }, [searchQuery, filters, libraries]);

  // ---- Handlers ----

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload: CreateLibraryInput = {
        name: values.name,
        displayName: values.displayName,
        description: values.description,
        language: values.language,
        owner: values.owner,
        maintainers: values.maintainers
          ? values.maintainers.split(',').map((s: string) => s.trim())
          : [],
        repository: values.repository,
        documentation: values.documentation,
        sla: values.sla,
        publishConfig: values.requireApproval
          ? {
              requireApproval: true,
              approvers: values.approvers
                ? values.approvers.split(',').map((s: string) => s.trim())
                : [],
            }
          : undefined,
      };
      await createInternalLibrary(payload);
      message.success('二方库创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`二方库创建失败：${error.message}`);
        } else {
          message.error('二方库创建失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInternalLibrary(id);
      message.success('二方库已删除');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败：${error.message}`);
      } else {
        message.error('删除失败');
      }
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await activateInternalLibrary(id);
      message.success('二方库已激活');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`激活失败：${error.message}`);
      } else {
        message.error('激活失败');
      }
    }
  };

  const handleDeprecate = async () => {
    if (!selectedLib) return;
    try {
      const values = await deprecateForm.validateFields();
      setSubmitting(true);
      const payload: DeprecateLibraryInput = {
        reason: values.reason,
        eolDate: values.eolDate.format('YYYY-MM-DD'),
        migrationGuide: values.migrationGuide,
        replacementLibrary: values.replacementLibrary,
      };
      await deprecateInternalLibrary(selectedLib.id, payload);
      message.success('二方库已废弃');
      setDeprecateModalVisible(false);
      deprecateForm.resetFields();
      loadData();
      if (detailDrawerVisible) openDetail(selectedLib);
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`废弃失败：${error.message}`);
        } else {
          message.error('废弃失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishVersion = async () => {
    if (!selectedLib) return;
    try {
      const values = await versionForm.validateFields();
      setSubmitting(true);
      const payload: PublishVersionInput = {
        version: values.version,
        status: values.status || 'stable',
        changelog: values.changelog,
        artifactId: values.artifactId,
        securityScore: values.securityScore ? Number(values.securityScore) : undefined,
        testCoverage: values.testCoverage ? Number(values.testCoverage) : undefined,
        publishedTo: values.publishedTo
          ? values.publishedTo.split(',').map((s: string) => s.trim())
          : undefined,
      };
      await publishVersion(selectedLib.id, payload);
      message.success(`版本 ${values.version} 发布成功`);
      setVersionModalVisible(false);
      versionForm.resetFields();
      if (detailDrawerVisible) openDetail(selectedLib);
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`发布失败：${error.message}`);
        } else {
          message.error('发布失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeprecateVersion = async () => {
    if (!selectedLib) return;
    try {
      const values = await deprecateVersionForm.validateFields();
      setSubmitting(true);
      const targetVersion = versionForm.getFieldValue('_targetVersion') || values.targetVersion;
      await deprecateVersion(
        selectedLib.id,
        targetVersion,
        values.reason,
        values.eolDate.format('YYYY-MM-DD'),
        values.migrationGuide
      );
      message.success('版本已废弃');
      setDeprecateVersionModalVisible(false);
      deprecateVersionForm.resetFields();
      if (detailDrawerVisible) openDetail(selectedLib);
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`废弃失败：${error.message}`);
        } else {
          message.error('废弃失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddDependent = async () => {
    if (!selectedLib) return;
    try {
      const values = await addDependentForm.validateFields();
      setSubmitting(true);
      const payload: AddDependentInput = {
        repoName: values.repoName,
        teamName: values.teamName,
        version: values.version,
      };
      await addDependent(selectedLib.id, payload);
      message.success('依赖关系已添加');
      setAddDependentModalVisible(false);
      addDependentForm.resetFields();
      if (detailDrawerVisible) openDetail(selectedLib);
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`添加失败：${error.message}`);
        } else {
          message.error('添加失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateDependent = async (repoName: string, version: string) => {
    if (!selectedLib) return;
    try {
      await updateDependent(selectedLib.id, repoName, version);
      message.success('依赖版本已更新');
      if (detailDrawerVisible) openDetail(selectedLib);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`更新失败：${error.message}`);
      } else {
        message.error('更新失败');
      }
    }
  };

  const handleUpdateStats = async () => {
    if (!selectedLib) return;
    try {
      await updateDependentStats(selectedLib.id);
      message.success('依赖统计已更新');
      if (detailDrawerVisible) openDetail(selectedLib);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`更新依赖统计失败：${error.message}`);
      } else {
        message.error('更新依赖统计失败');
      }
    }
  };

  const openDetail = async (lib: InternalLibrary) => {
    setSelectedLib(lib);
    setDetailDrawerVisible(true);
    setActiveTab('info');
    try {
      const [verRes, depRes] = await Promise.all([getVersions(lib.id), getDependents(lib.id)]);
      setVersions(verRes?.data || []);
      setDependents(depRes?.data || []);
    } catch {
      setVersions([]);
      setDependents([]);
    }
  };

  // ---- Filter definitions ----

  const filterDefs: FilterDefinition[] = [
    {
      key: 'language',
      label: '语言',
      options: [{ label: '全部', value: 'all' }, ...languageOptions],
    },
    { key: 'status', label: '状态', options: statusOptions },
  ];

  return {
    loading,
    libraries,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    createModalVisible,
    setCreateModalVisible,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedLib,
    setSelectedLib,
    versions,
    dependents,
    versionModalVisible,
    setVersionModalVisible,
    deprecateModalVisible,
    setDeprecateModalVisible,
    deprecateVersionModalVisible,
    setDeprecateVersionModalVisible,
    addDependentModalVisible,
    setAddDependentModalVisible,
    createForm,
    versionForm,
    deprecateForm,
    deprecateVersionForm,
    addDependentForm,
    submitting,
    activeTab,
    setActiveTab,
    filteredData,
    filterDefs,
    loadData,
    handleCreate,
    handleDelete,
    handleActivate,
    handleDeprecate,
    handlePublishVersion,
    handleDeprecateVersion,
    handleAddDependent,
    handleUpdateDependent,
    handleUpdateStats,
    openDetail,
  };
};
