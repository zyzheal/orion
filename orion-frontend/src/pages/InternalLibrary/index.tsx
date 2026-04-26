/**
 * Internal Library Management Page
 * M30 - 二方库管理：列表、创建、版本管理、依赖追踪
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography, Button, Space, Tag, Card, Modal, Form, Input, Select, message, Alert,
  Popconfirm, Tabs, Table as AntTable, Descriptions, Drawer, Tooltip, Switch,
  DatePicker,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, DeleteOutlined,
  PlayCircleOutlined, SearchOutlined,
  CodeOutlined, TeamOutlined,
  RocketOutlined, StopOutlined, LinkOutlined,
  CheckCircleOutlined, WarningOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getInternalLibraries, createInternalLibrary, deleteInternalLibrary,
  activateInternalLibrary, deprecateInternalLibrary,
  publishVersion, getVersions, deprecateVersion,
  getDependents, addDependent, updateDependent,
  checkDependencies, updateDependentStats,
  type InternalLibrary, type LibraryVersion, type LibraryDependent,
  type CreateLibraryInput, type PublishVersionInput, type DeprecateLibraryInput,
  type AddDependentInput, type DependencyCheckResult,
  type LibraryLanguage, type LibraryStatus, type VersionStatus,
} from '@/api/internal-library';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ---- Constants ----

const languageLabels: Record<LibraryLanguage, string> = {
  java: 'Java',
  node: 'Node.js',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  dotnet: '.NET',
};

const statusColorMap: Record<LibraryStatus, string> = {
  active: 'green',
  deprecated: 'orange',
  archived: 'default',
  development: 'blue',
};

const versionStatusColorMap: Record<VersionStatus, string> = {
  snapshot: 'default',
  alpha: 'orange',
  beta: 'gold',
  rc: 'purple',
  stable: 'green',
  deprecated: 'red',
};

const upgradeTypeColorMap: Record<string, string> = {
  patch: 'green',
  minor: 'blue',
  major: 'orange',
  breaking: 'red',
};

const languageOptions = Object.entries(languageLabels).map(([value, label]) => ({ label, value }));
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

const MOCK_DEP_CHECK: DependencyCheckResult[] = [
  { libraryName: '@orion/auth', currentVersion: '2.1.0', latestVersion: '2.3.0', status: 'upgrade_available', upgradeType: 'minor', securityScore: 92, breakingChanges: [] },
  { libraryName: '@orion/utils', currentVersion: '1.5.2', latestVersion: '1.5.2', status: 'latest', securityScore: 95, breakingChanges: [] },
  { libraryName: 'orion-db-core', currentVersion: '2.8.0', latestVersion: '3.0.0', status: 'breaking_change', upgradeType: 'major', securityScore: 88, breakingChanges: ['API signature change', 'Migration required'], migrationGuide: 'https://docs.orion.io/db/migrate-v3' },
];

// ---- Dependency Check Tool ----

const DependencyCheckTool: React.FC = () => {
  const [repoName, setRepoName] = useState('');
  const [results, setResults] = useState<DependencyCheckResult[] | null>(null);
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    if (!repoName) { message.warning('请输入项目名称'); return; }
    setChecking(true);
    try {
      const res = await checkDependencies(repoName);
      setResults(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setResults(MOCK_DEP_CHECK);
    } finally {
      setChecking(false);
    }
  };

  const statusTag = (status: DependencyCheckResult['status']) => {
    const map: Record<string, { color: string; text: string }> = {
      latest: { color: 'green', text: '最新' },
      upgrade_available: { color: 'blue', text: '可升级' },
      breaking_change: { color: 'orange', text: 'Breaking' },
      deprecated: { color: 'red', text: '已废弃' },
    };
    const { color, text } = map[status] || { color: 'default', text: status };
    return <Tag color={color}>{text}</Tag>;
  };

  return (
    <Card size="small" title={<Space><LinkOutlined /> 依赖检查工具</Space>} style={{ marginBottom: 16 }}>
      <Space wrap>
        <Input
          placeholder="项目名称 (如: orion-platform-service)"
          style={{ width: 300 }}
          value={repoName}
          onChange={(e) => setRepoName(e.target.value)}
          onPressEnter={handleCheck}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={handleCheck} loading={checking}>检查</Button>
      </Space>
      {results && results.length > 0 && (
        <AntTable
          dataSource={results}
          rowKey="libraryName"
          size="small"
          pagination={false}
          style={{ marginTop: 12 }}
          columns={[
            { key: 'libraryName', title: '二方库', dataIndex: 'libraryName', width: 160, render: (v: unknown) => <Text code>{String(v)}</Text> },
            { key: 'versions', title: '当前 -> 最新', width: 160,
              render: (_: unknown, record: DependencyCheckResult) => (
                <Text><Tag>{record.currentVersion}</Tag> <Text type="secondary">→</Text> <Tag color="blue">{record.latestVersion}</Tag></Text>
              ),
            },
            { key: 'status', title: '状态', width: 120, render: (_: unknown, record: DependencyCheckResult) => statusTag(record.status) },
            { key: 'upgradeType', title: '升级类型', width: 90,
              render: (_: unknown, record: DependencyCheckResult) => record.upgradeType ? <Tag color={upgradeTypeColorMap[record.upgradeType]}>{record.upgradeType}</Tag> : <Text type="secondary">-</Text>,
            },
            { key: 'securityScore', title: '安全评分', width: 90,
              render: (_: unknown, record: DependencyCheckResult) => record.securityScore ? <Tag color={record.securityScore >= 90 ? 'green' : record.securityScore >= 70 ? 'orange' : 'red'}>{record.securityScore}</Tag> : <Text type="secondary">-</Text>,
            },
            { key: 'breakingChanges', title: 'Breaking Changes', width: 200,
              render: (_: unknown, record: DependencyCheckResult) => record.breakingChanges && record.breakingChanges.length > 0
                ? record.breakingChanges.map((c, i) => <div key={i}><WarningOutlined /> <Text type="danger">{c}</Text></div>)
                : <Text type="secondary">无</Text>,
            },
          ]}
        />
      )}
    </Card>
  );
};

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
    } catch {
      setUsingMockData(true);
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
    } catch {
      message.error('二方库创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInternalLibrary(id);
      message.success('二方库已删除');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await activateInternalLibrary(id);
      message.success('二方库已激活');
      loadData();
    } catch {
      message.error('激活失败');
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
    } catch {
      message.error('废弃失败');
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
    } catch {
      message.error('发布失败');
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
    } catch {
      message.error('废弃失败');
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
    } catch {
      message.error('添加失败');
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
    } catch {
      message.error('更新失败');
    }
  };

  const handleUpdateStats = async () => {
    if (!selectedLib) return;
    try {
      await updateDependentStats(selectedLib.id);
      message.success('依赖统计已更新');
      if (detailDrawerVisible) openDetail(selectedLib);
    } catch {
      message.error('更新统计失败');
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
    } catch {
      setVersions(lib.versions || []);
      setDependents(lib.dependents?.list || MOCK_DEPENDENTS);
    }
  };

  // ---- Table columns ----

  const columns: TableColumn<any>[] = [
    {
      key: 'displayName', title: '二方库', dataIndex: 'displayName', width: 180, sortable: true,
      render: (v: unknown, record: InternalLibrary) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>{String(v || record.name)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}><CodeOutlined /> {record.name}</Text>
        </Space>
      ),
    },
    {
      key: 'description', title: '描述', dataIndex: 'description', width: 200,
      render: (v: unknown) => <Text type="secondary">{String(v || '-')}</Text>,
    },
    {
      key: 'language', title: '语言', width: 90,
      render: (_: unknown, record: InternalLibrary) => <Tag color="cyan">{languageLabels[record.language] || record.language}</Tag>,
    },
    {
      key: 'version', title: '当前版本', width: 100,
      render: (_: unknown, record: InternalLibrary) => <Text code>{record.currentVersion}</Text>,
    },
    {
      key: 'owner', title: '团队', width: 120,
      render: (_: unknown, record: InternalLibrary) => <Space><TeamOutlined /> <Text>{record.owner}</Text></Space>,
    },
    {
      key: 'dependents', title: '依赖项目', width: 100,
      render: (_: unknown, record: InternalLibrary) => {
        const d = record.dependents;
        return <Text style={{ fontSize: 12 }}>{d?.totalRepos ?? 0} 个项目<br />{d?.totalTeams ?? 0} 个团队</Text>;
      },
    },
    {
      key: 'quality', title: '质量', width: 90,
      render: (_: unknown, record: InternalLibrary) => {
        const q = record.quality;
        if (!q) return <Text type="secondary">-</Text>;
        return (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>覆盖 {q.testCoverage ?? '-'}%</Text>
            <Text type={q.securityScore && q.securityScore >= 90 ? 'success' : q.securityScore && q.securityScore >= 70 ? 'warning' : 'danger'} style={{ fontSize: 12 }}>安全 {q.securityScore ?? '-'}</Text>
          </Space>
        );
      },
    },
    {
      key: 'status', title: '状态', width: 100,
      render: (_: unknown, record: InternalLibrary) => <Tag color={statusColorMap[record.status]}>{record.status}</Tag>,
    },
    {
      key: 'updatedAt', title: '更新', width: 110,
      render: (_: unknown, record: InternalLibrary) => <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(record.updatedAt).fromNow()}</Text>,
    },
    {
      key: 'actions', title: '操作', width: 200,
      render: (_: unknown, record: InternalLibrary) => (
        <Space size="small" wrap>
          <Tooltip title="详情"><Button type="link" size="small" onClick={() => openDetail(record)}>详情</Button></Tooltip>
          {record.status === 'deprecated' || record.status === 'archived' ? (
            <Tooltip title="激活"><Popconfirm title="确认激活?" onConfirm={() => handleActivate(record.id)}><Button type="link" size="small" icon={<PlayCircleOutlined />} /></Popconfirm></Tooltip>
          ) : record.status === 'active' ? (
            <Tooltip title="废弃"><Popconfirm title="确认废弃?" onConfirm={() => { setSelectedLib(record); setDeprecateModalVisible(true); }}><Button type="link" size="small" danger icon={<StopOutlined />} /></Popconfirm></Tooltip>
          ) : null}
          <Tooltip title="删除"><Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}><Button type="link" size="small" danger icon={<DeleteOutlined />} /></Popconfirm></Tooltip>
        </Space>
      ),
    },
  ];

  const filterDefs: FilterDefinition[] = [
    { key: 'language', label: '语言', options: [
      { label: '全部', value: 'all' },
      ...languageOptions,
    ]},
    { key: 'status', label: '状态', options: statusOptions },
  ];

  // ---- Version columns ----

  const versionColumns: TableColumn<LibraryVersion>[] = [
    { key: 'version', title: '版本', dataIndex: 'version', width: 120, render: (v: unknown) => <Text code><RocketOutlined /> {String(v)}</Text> },
    { key: 'status', title: '状态', width: 100, render: (_: unknown, record: LibraryVersion) => <Tag color={versionStatusColorMap[record.status]}>{record.status}</Tag> },
    { key: 'changelog', title: '变更说明', dataIndex: 'changelog', width: 200, render: (v: unknown) => <Text type="secondary">{String(v || '-')}</Text> },
    { key: 'testCoverage', title: '测试覆盖', width: 100, render: (_: unknown, record: LibraryVersion) => record.testCoverage != null ? <Text>{record.testCoverage}%</Text> : <Text type="secondary">-</Text> },
    { key: 'securityScore', title: '安全评分', width: 100, render: (_: unknown, record: LibraryVersion) => {
      if (record.securityScore == null) return <Text type="secondary">-</Text>;
      const color = record.securityScore >= 90 ? 'green' : record.securityScore >= 70 ? 'orange' : 'red';
      return <Tag color={color}>{record.securityScore}</Tag>;
    }},
    { key: 'releasedAt', title: '发布时间', dataIndex: 'releasedAt', width: 140, render: (v: unknown) => <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(String(v)).fromNow()}</Text> },
    { key: 'actions', title: '操作', width: 100, render: (_: unknown, record: LibraryVersion) => (
      record.status !== 'deprecated' ? (
        <Popconfirm title="确认废弃此版本?" onConfirm={() => {
          versionForm.setFieldValue('_targetVersion', record.version);
          setDeprecateVersionModalVisible(true);
        }}>
          <Button type="link" size="small" danger>废弃</Button>
        </Popconfirm>
      ) : <Text type="secondary">已废弃</Text>
    )},
  ];

  // ---- Dependent columns ----

  const dependentColumns: TableColumn<LibraryDependent>[] = [
    { key: 'repoName', title: '项目', dataIndex: 'repoName', width: 200, render: (v: unknown) => <Text code>{String(v)}</Text> },
    { key: 'teamName', title: '团队', dataIndex: 'teamName', width: 120, render: (_: unknown, record: LibraryDependent) => <Space><TeamOutlined /> {record.teamName}</Space> },
    { key: 'version', title: '当前版本', dataIndex: 'currentVersion', width: 100, render: (v: unknown) => <Text code>{String(v)}</Text> },
    { key: 'upgradeAvailable', title: '升级', width: 100, render: (_: unknown, record: LibraryDependent) => {
      if (!record.upgradeAvailable) return <Tag color="green">最新</Tag>;
      return <Tag color="blue">{record.upgradeType || 'upgrade'}</Tag>;
    }},
    { key: 'latestVersion', title: '最新版本', dataIndex: 'latestCompatibleVersion', width: 120, render: (v: unknown) => v ? <Text code>{String(v)}</Text> : <Text type="secondary">-</Text> },
    { key: 'lastUpdated', title: '最后更新', dataIndex: 'lastUpdated', width: 140, render: (v: unknown) => <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(String(v)).fromNow()}</Text> },
    { key: 'actions', title: '操作', width: 120, render: (_: unknown, record: LibraryDependent) => (
      record.upgradeAvailable && record.latestCompatibleVersion ? (
        <Popconfirm title={`确认升级到 ${record.latestCompatibleVersion}?`} onConfirm={() => handleUpdateDependent(record.repoName, record.latestCompatibleVersion!)}>
          <Button type="link" size="small"><CheckCircleOutlined /> 升级</Button>
        </Popconfirm>
      ) : <Text type="secondary">-</Text>
    )},
  ];

  // ---- Detail Tabs ----

  const detailTabItems = useMemo(() => [
    {
      key: 'info', label: '基本信息',
      children: selectedLib ? (
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="名称">{selectedLib.name}</Descriptions.Item>
          <Descriptions.Item label="显示名称">{selectedLib.displayName || '-'}</Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>{selectedLib.description || '-'}</Descriptions.Item>
          <Descriptions.Item label="语言"><Tag color="cyan">{languageLabels[selectedLib.language]}</Tag></Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={statusColorMap[selectedLib.status]}>{selectedLib.status}</Tag></Descriptions.Item>
          <Descriptions.Item label="团队"><TeamOutlined /> {selectedLib.owner}</Descriptions.Item>
          <Descriptions.Item label="维护者">{selectedLib.maintainers?.join(', ') || '-'}</Descriptions.Item>
          <Descriptions.Item label="仓库" span={2}><Text code>{selectedLib.repository}</Text></Descriptions.Item>
          <Descriptions.Item label="文档">{selectedLib.documentation ? <a href={selectedLib.documentation} target="_blank" rel="noopener noreferrer">{selectedLib.documentation}</a> : '-'}</Descriptions.Item>
          <Descriptions.Item label="当前版本"><Text code>{selectedLib.currentVersion}</Text></Descriptions.Item>
          <Descriptions.Item label="最新稳定版"><Text code>{selectedLib.latestStableVersion}</Text></Descriptions.Item>
          <Descriptions.Item label="测试覆盖">{selectedLib.quality?.testCoverage ?? '-'}%</Descriptions.Item>
          <Descriptions.Item label="安全评分">{selectedLib.quality?.securityScore ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="依赖项目数">{selectedLib.dependents?.totalRepos ?? 0}</Descriptions.Item>
          <Descriptions.Item label="依赖团队数">{selectedLib.dependents?.totalTeams ?? 0}</Descriptions.Item>
          <Descriptions.Item label="使用最新版">{selectedLib.dependents?.reposUsingLatest ?? 0}</Descriptions.Item>
          <Descriptions.Item label="需要升级">{selectedLib.dependents?.reposNeedingUpgrade ?? 0}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{dayjs(selectedLib.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{dayjs(selectedLib.updatedAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
        </Descriptions>
      ) : null,
    },
    {
      key: 'versions', label: '版本管理',
      children: (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">管理二方库版本</Text>
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => {
              versionForm.resetFields();
              setVersionModalVisible(true);
            }}>发布新版本</Button>
          </div>
          <AntTable columns={versionColumns} dataSource={versions} rowKey="version" size="small" pagination={{ pageSize: 10 }} />
        </div>
      ),
    },
    {
      key: 'dependents', label: '依赖者管理',
      children: (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Text type="secondary">管理依赖此二方库的项目</Text>
              <Button size="small" icon={<ReloadOutlined />} onClick={handleUpdateStats}>刷新统计</Button>
            </Space>
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => {
              addDependentForm.resetFields();
              setAddDependentModalVisible(true);
            }}>添加依赖</Button>
          </div>
          <AntTable columns={dependentColumns} dataSource={dependents} rowKey="repoName" size="small" pagination={false} />
        </div>
      ),
    },
    {
      key: 'dep-check', label: '依赖检查',
      children: <DependencyCheckTool />,
    },
  ], [selectedLib, versions, dependents]);

  return (
    <div style={{ padding: 0 }}>
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
        <Table columns={columns} dataSource={filteredData as unknown as Record<string, unknown>[]} loading={loading} rowKey="id" size="middle" striped />
      </Card>

      {/* Create Modal */}
      <Modal
        title="创建二方库" open={createModalVisible} onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate} confirmLoading={submitting} width={640} destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="名称 (唯一标识)" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如: @orion/auth 或 orion-db-core" />
          </Form.Item>
          <Form.Item name="displayName" label="显示名称" rules={[{ required: true, message: '请输入显示名称' }]}>
            <Input placeholder="如: Orion 认证库" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="二方库描述..." />
          </Form.Item>
          <Form.Item name="language" label="语言" rules={[{ required: true, message: '请选择语言' }]}>
            <Select options={languageOptions} placeholder="选择编程语言" />
          </Form.Item>
          <Form.Item name="owner" label="所属团队" rules={[{ required: true, message: '请输入团队名称' }]}>
            <Input placeholder="如: platform-team" />
          </Form.Item>
          <Form.Item name="maintainers" label="维护者 (逗号分隔)">
            <Input placeholder="如: heal, alice" />
          </Form.Item>
          <Form.Item name="repository" label="Git 仓库地址" rules={[{ required: true, message: '请输入仓库地址' }]}>
            <Input placeholder="https://github.com/org/repo" />
          </Form.Item>
          <Form.Item name="documentation" label="文档地址">
            <Input placeholder="https://docs.example.com" />
          </Form.Item>
          <Form.Item name="sla" label="SLA 等级">
            <Select options={[{ label: 'P0 - 核心', value: 'p0' }, { label: 'P1 - 重要', value: 'p1' }, { label: 'P2 - 普通', value: 'p2' }]} placeholder="选择 SLA" />
          </Form.Item>
          <Form.Item name="requireApproval" label="发布需要审批" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="approvers" label="审批人 (逗号分隔)">
            <Input placeholder="如: tech-lead, qa-lead" />
          </Form.Item>
        </Form>
      </Modal>

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
            <Descriptions.Item label="语言"><Tag color="cyan">{languageLabels[selectedLib.language]}</Tag></Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={statusColorMap[selectedLib.status]}>{selectedLib.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="当前版本"><Text code>{selectedLib.currentVersion}</Text></Descriptions.Item>
            <Descriptions.Item label="团队"><TeamOutlined /> {selectedLib.owner}</Descriptions.Item>
            <Descriptions.Item label="依赖项目">{selectedLib.dependents?.totalRepos ?? 0}</Descriptions.Item>
          </Descriptions>
        )}
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={detailTabItems} />
      </Drawer>
    </div>
  );
};

export default InternalLibraryManagement;
