/**
 * Internal Library Management Page
 * M30 - 二方库管理：列表、创建、版本管理、依赖追踪
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography, Button, Space, Modal, Form, Input, Select, message, Alert,
  Tabs, Descriptions, Drawer, Tag, DatePicker, Card,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, TeamOutlined,
} from '@ant-design/icons';
import PageSkeleton from '@/components/PageSkeleton';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getInternalLibraries, createInternalLibrary, deleteInternalLibrary,
  activateInternalLibrary, deprecateInternalLibrary,
  publishVersion, getVersions, deprecateVersion,
  getDependents, addDependent, updateDependent,
  updateDependentStats,
  type InternalLibrary, type LibraryVersion, type LibraryDependent,
  type CreateLibraryInput, type PublishVersionInput, type DeprecateLibraryInput,
  type AddDependentInput, type LibraryLanguage,
} from '@/api/internal-library';
import LibraryTable from './LibraryTable';
import CreateLibraryModal from './CreateLibraryModal';
import { getLibraryTabItems } from './LibraryDetail';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ---- Constants ----

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

// ---- Mock data ----

const MOCK_LIBRARIES: InternalLibrary[] = [
  {
    id: 'lib-1', name: '@orion/auth', displayName: 'Orion 认证库', description: '统一认证与权限管理',
    language: 'node', status: 'active', owner: 'platform-team', maintainers: ['heal', 'alice'],
    repository: 'https://github.com/orion/auth-lib', documentation: 'https://docs.orion.io/auth',
    currentVersion: '2.3.0', latestStableVersion: '2.3.0',
    versions: [
      { version: '2.3.0', status: 'stable', releasedAt: '2024-03-15T10:00:00Z', changelog: 'Add OIDC support', testCoverage: 85, securityScore: 92 },
      { version: '2.2.1', status: 'stable', releasedAt: '2024-02-20T10:00:00Z', changelog: 'Fix token refresh bug', testCoverage: 82, securityScore: 90 },
      { version: '2.1.0', status: 'deprecated', releasedAt: '2024-01-10T10:00:00Z', changelog: 'Add JWT support', deprecationReason: 'Replaced by 2.3.0', eolDate: '2024-06-01T00:00:00Z' },
    ],
    dependents: { totalRepos: 12, totalTeams: 4, reposUsingLatest: 8, reposNeedingUpgrade: 4 },
    quality: { testCoverage: 85, securityScore: 92, openIssues: 3, openPRs: 1, lastReleaseAge: 10 },
    createdAt: '2023-06-01T08:00:00Z', updatedAt: '2024-03-15T10:00:00Z',
  },
  {
    id: 'lib-2', name: '@orion/utils', displayName: 'Orion 工具库', description: '通用工具函数集合',
    language: 'node', status: 'active', owner: 'frontend-team', maintainers: ['bob'],
    repository: 'https://github.com/orion/utils-lib',
    currentVersion: '1.5.2', latestStableVersion: '1.5.2',
    versions: [
      { version: '1.5.2', status: 'stable', releasedAt: '2024-03-10T10:00:00Z', changelog: 'Add date utils', testCoverage: 90, securityScore: 95 },
      { version: '1.4.0', status: 'stable', releasedAt: '2024-01-20T10:00:00Z', changelog: 'Add string utils', testCoverage: 88, securityScore: 94 },
    ],
    dependents: { totalRepos: 20, totalTeams: 6, reposUsingLatest: 15, reposNeedingUpgrade: 5 },
    quality: { testCoverage: 90, securityScore: 95, openIssues: 1, openPRs: 0, lastReleaseAge: 15 },
    createdAt: '2023-03-15T08:00:00Z', updatedAt: '2024-03-10T10:00:00Z',
  },
  {
    id: 'lib-3', name: 'orion-db-core', displayName: 'Orion 数据库核心', description: '数据库连接池与 ORM 封装',
    language: 'java', status: 'active', owner: 'data-team', maintainers: ['charlie', 'dave'],
    repository: 'https://github.com/orion/db-core',
    currentVersion: '3.0.0', latestStableVersion: '3.0.0',
    versions: [
      { version: '3.0.0', status: 'stable', releasedAt: '2024-03-01T10:00:00Z', changelog: 'Migrate to Hibernate 6', testCoverage: 78, securityScore: 88 },
      { version: '2.8.0', status: 'deprecated', releasedAt: '2023-11-15T10:00:00Z', deprecationReason: 'Breaking changes in 3.0', eolDate: '2024-09-01T00:00:00Z' },
    ],
    dependents: { totalRepos: 8, totalTeams: 3, reposUsingLatest: 5, reposNeedingUpgrade: 3 },
    quality: { testCoverage: 78, securityScore: 88, openIssues: 5, openPRs: 2, lastReleaseAge: 24 },
    createdAt: '2022-09-01T08:00:00Z', updatedAt: '2024-03-01T10:00:00Z',
  },
  {
    id: 'lib-4', name: 'orion-config-go', displayName: 'Orion Go 配置库', description: 'Go 微服务配置管理',
    language: 'go', status: 'development', owner: 'infra-team', maintainers: ['eve'],
    repository: 'https://github.com/orion/config-go',
    currentVersion: '0.5.0', latestStableVersion: '0.4.2',
    versions: [
      { version: '0.5.0', status: 'beta', releasedAt: '2024-03-18T10:00:00Z', changelog: 'Add hot-reload support', testCoverage: 60 },
      { version: '0.4.2', status: 'stable', releasedAt: '2024-02-05T10:00:00Z', changelog: 'Bug fixes', testCoverage: 58 },
    ],
    dependents: { totalRepos: 3, totalTeams: 1, reposUsingLatest: 1, reposNeedingUpgrade: 2 },
    quality: { testCoverage: 60, securityScore: 75, openIssues: 8, openPRs: 3, lastReleaseAge: 7 },
    createdAt: '2024-01-10T08:00:00Z', updatedAt: '2024-03-18T10:00:00Z',
  },
];

const MOCK_DEPENDENTS: LibraryDependent[] = [
  { repoName: 'orion-platform-service', teamName: 'platform-team', currentVersion: '2.2.1', latestCompatibleVersion: '2.3.0', upgradeAvailable: true, upgradeType: 'minor', lastUpdated: '2024-03-01T10:00:00Z' },
  { repoName: 'orion-api-gateway', teamName: 'platform-team', currentVersion: '2.3.0', latestCompatibleVersion: '2.3.0', upgradeAvailable: false, lastUpdated: '2024-03-10T10:00:00Z' },
  { repoName: 'orion-frontend', teamName: 'frontend-team', currentVersion: '2.1.0', latestCompatibleVersion: '2.3.0', upgradeAvailable: true, upgradeType: 'major', lastUpdated: '2024-02-15T10:00:00Z' },
];

// ---- Main Component ----

const InternalLibraryManagement: React.FC = () => {
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
  const [usingMockData, setUsingMockData] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getInternalLibraries();
      setLibraries(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error: unknown) {
      setUsingMockData(true);
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          message.error('权限不足，请重新登录或联系管理员');
        } else if (error.message.includes('fetch') || error.message.includes('network')) {
          message.error('网络异常，请检查连接');
        } else {
          message.error(`加载二方库数据失败：${error.message}`);
        }
      } else {
        message.error('加载二方库数据失败，请稍后重试');
      }
      setLibraries(MOCK_LIBRARIES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredData = useMemo(() => {
    return libraries.filter((lib) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!lib.name.toLowerCase().includes(q) && !(lib.displayName && lib.displayName.toLowerCase().includes(q)) && !(lib.description && lib.description.toLowerCase().includes(q))) return false;
      }
      if (filters.language && filters.language !== 'all' && lib.language !== filters.language) return false;
      if (filters.status && filters.status !== 'all' && lib.status !== filters.status) return false;
      if (filters.owner && filters.owner !== 'all' && lib.owner !== filters.owner) return false;
      return true;
    });
  }, [searchQuery, filters, libraries]);

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
        maintainers: values.maintainers ? values.maintainers.split(',').map((s: string) => s.trim()) : [],
        repository: values.repository,
        documentation: values.documentation,
        sla: values.sla,
        publishConfig: values.requireApproval ? {
          requireApproval: true,
          approvers: values.approvers ? values.approvers.split(',').map((s: string) => s.trim()) : [],
        } : undefined,
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
        publishedTo: values.publishedTo ? values.publishedTo.split(',').map((s: string) => s.trim()) : undefined,
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
      await deprecateVersion(selectedLib.id, targetVersion, values.reason, values.eolDate.format('YYYY-MM-DD'), values.migrationGuide);
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
      const [verRes, depRes] = await Promise.all([
        getVersions(lib.id).catch(() => null),
        getDependents(lib.id).catch(() => null),
      ]);
      setVersions(verRes?.data?.data || lib.versions || MOCK_LIBRARIES.find((m) => m.id === lib.id)?.versions || []);
      setDependents(depRes?.data?.data || lib.dependents?.list || MOCK_DEPENDENTS);
    } catch (error: unknown) {
      setVersions(lib.versions || []);
      setDependents(lib.dependents?.list || MOCK_DEPENDENTS);
    }
  };

  const filterDefs: FilterDefinition[] = [
    { key: 'language', label: '语言', options: [
      { label: '全部', value: 'all' },
      ...languageOptions,
    ]},
    { key: 'status', label: '状态', options: statusOptions },
  ];

  // ---- Detail Tabs ----

  const { items: detailTabItems, activeKey: detailActiveKey, onChange: detailTabChange } = getLibraryTabItems(
    selectedLib,
    versions,
    dependents,
    activeTab,
    setActiveTab,
    () => {
      versionForm.resetFields();
      setVersionModalVisible(true);
    },
    (targetVersion: string) => {
      versionForm.setFieldValue('_targetVersion', targetVersion);
      setDeprecateVersionModalVisible(true);
    },
    handleUpdateStats,
    () => {
      addDependentForm.resetFields();
      setAddDependentModalVisible(true);
    },
    handleUpdateDependent,
  );

  const isInitialLoading = loading && libraries.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {/* Page loading skeleton (initial load) */}
      {isInitialLoading && <PageSkeleton rows={8} />}

      {isInitialLoading ? null : (
        <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>二方库管理</Title>
          <Text type="secondary">管理内部二方库的生命周期、版本发布和依赖追踪</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateModalVisible(true); }}>创建二方库</Button>
        </Space>
      </div>

      {/* Mock data warning banner */}
      {usingMockData && (
        <Alert
          message="使用模拟数据"
          description="后端服务暂时不可用，当前显示的是模拟数据，可能不是最新状态。"
          type="warning"
          showIcon
          closable
          style={{ marginBottom: 16 }}
          onClose={() => setUsingMockData(false)}
        />
      )}

      {/* Library List */}
      <Card>
        <div style={{ marginBottom: 16 }}>
          <SearchFilterBar onSearch={setSearchQuery} onFilter={setFilters} filters={filterDefs} searchPlaceholder="搜索二方库..." />
        </div>
        <LibraryTable
          dataSource={filteredData}
          loading={loading}
          onDetail={openDetail}
          onActivate={handleActivate}
          onDeprecate={(record) => { setSelectedLib(record); setDeprecateModalVisible(true); }}
          onDelete={handleDelete}
        />
      </Card>

      {/* Create Modal (extracted sub-component) */}
      <CreateLibraryModal
        visible={createModalVisible}
        form={createForm}
        submitting={submitting}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
      />

      {/* Deprecate Library Modal */}
      <Modal
        title="废弃二方库" open={deprecateModalVisible} onCancel={() => setDeprecateModalVisible(false)}
        onOk={handleDeprecate} confirmLoading={submitting} width={520}
      >
        <Form form={deprecateForm} layout="vertical">
          <Form.Item name="reason" label="废弃原因" rules={[{ required: true, message: '请输入废弃原因' }]}>
            <Input.TextArea rows={3} placeholder="为什么废弃此二方库..." />
          </Form.Item>
          <Form.Item name="eolDate" label="EOL 日期" rules={[{ required: true, message: '请选择 EOL 日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="migrationGuide" label="迁移指南">
            <Input placeholder="https://docs.example.com/migrate" />
          </Form.Item>
          <Form.Item name="replacementLibrary" label="替代二方库">
            <Input placeholder="如: @orion/auth-v2" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Publish Version Modal */}
      <Modal
        title="发布新版本" open={versionModalVisible} onCancel={() => setVersionModalVisible(false)}
        onOk={handlePublishVersion} confirmLoading={submitting} width={520}
      >
        <Form form={versionForm} layout="vertical">
          <Form.Item name="version" label="版本号" rules={[{ required: true, message: '请输入版本号' }]}>
            <Input placeholder="如: 2.4.0" />
          </Form.Item>
          <Form.Item name="status" label="版本状态">
            <Select options={[
              { label: 'Snapshot', value: 'snapshot' },
              { label: 'Alpha', value: 'alpha' },
              { label: 'Beta', value: 'beta' },
              { label: 'RC', value: 'rc' },
              { label: 'Stable', value: 'stable' },
            ]} defaultValue="stable" />
          </Form.Item>
          <Form.Item name="changelog" label="变更说明">
            <Input.TextArea rows={3} placeholder="版本变更说明..." />
          </Form.Item>
          <Form.Item name="artifactId" label="制品 ID">
            <Input placeholder="关联的制品 ID" />
          </Form.Item>
          <Form.Item name="securityScore" label="安全评分">
            <Input type="number" min={0} max={100} placeholder="0-100" />
          </Form.Item>
          <Form.Item name="testCoverage" label="测试覆盖率">
            <Input type="number" min={0} max={100} placeholder="0-100" />
          </Form.Item>
          <Form.Item name="publishedTo" label="发布仓库 (逗号分隔)">
            <Input placeholder="如: npm, maven-central" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Deprecate Version Modal */}
      <Modal
        title="废弃版本" open={deprecateVersionModalVisible} onCancel={() => setDeprecateVersionModalVisible(false)}
        onOk={handleDeprecateVersion} confirmLoading={submitting} width={520}
      >
        <Form form={deprecateVersionForm} layout="vertical">
          <Form.Item name="targetVersion" label="目标版本" rules={[{ required: true, message: '请输入版本号' }]}>
            <Input placeholder="版本号" />
          </Form.Item>
          <Form.Item name="reason" label="废弃原因" rules={[{ required: true, message: '请输入废弃原因' }]}>
            <Input.TextArea rows={3} placeholder="为什么废弃此版本..." />
          </Form.Item>
          <Form.Item name="eolDate" label="EOL 日期" rules={[{ required: true, message: '请选择 EOL 日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="migrationGuide" label="迁移指南">
            <Input placeholder="https://docs.example.com/migrate" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Dependent Modal */}
      <Modal
        title="添加依赖关系" open={addDependentModalVisible} onCancel={() => setAddDependentModalVisible(false)}
        onOk={handleAddDependent} confirmLoading={submitting} width={520}
      >
        <Form form={addDependentForm} layout="vertical">
          <Form.Item name="repoName" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="如: orion-platform-service" />
          </Form.Item>
          <Form.Item name="teamName" label="团队名称" rules={[{ required: true, message: '请输入团队名称' }]}>
            <Input placeholder="如: platform-team" />
          </Form.Item>
          <Form.Item name="version" label="使用版本" rules={[{ required: true, message: '请输入版本号' }]}>
            <Input placeholder="如: 2.3.0" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={selectedLib ? `${selectedLib.displayName || selectedLib.name}` : '详情'}
        open={detailDrawerVisible} onClose={() => setDetailDrawerVisible(false)} width={900} destroyOnClose
      >
        {selectedLib && (
          <Descriptions size="small" style={{ marginBottom: 16 }} column={3} bordered>
            <Descriptions.Item label="名称"><Text code>{selectedLib.name}</Text></Descriptions.Item>
            <Descriptions.Item label="语言"><Tag color="cyan">{
              ({ java: 'Java', node: 'Node.js', python: 'Python', go: 'Go', rust: 'Rust', dotnet: '.NET' } as Record<string, string>)[selectedLib.language] || selectedLib.language
            }</Tag></Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={
              { active: 'green', deprecated: 'orange', archived: 'default', development: 'blue' }[selectedLib.status] || 'default'
            }>{selectedLib.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="当前版本"><Text code>{selectedLib.currentVersion}</Text></Descriptions.Item>
            <Descriptions.Item label="团队"><TeamOutlined /> {selectedLib.owner}</Descriptions.Item>
            <Descriptions.Item label="依赖项目">{selectedLib.dependents?.totalRepos ?? 0}</Descriptions.Item>
          </Descriptions>
        )}
        <Tabs activeKey={detailActiveKey} onChange={detailTabChange} items={detailTabItems} />
      </Drawer>
        </>
      )}
    </div>
  );
};

export default InternalLibraryManagement;
