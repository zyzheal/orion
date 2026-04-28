/**
 * Library Detail - Detail drawer tabs for internal library (info, versions, dependents, dep-check)
 */
import React, { useState } from 'react';
import {
  Typography,
  Tag,
  Space,
  Descriptions,
  Button,
  Table as AntTable,
  Popconfirm,
  Card,
  Input,
  message,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  RocketOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  LinkOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { TableColumn } from '@/components/Table';
import type {
  InternalLibrary,
  LibraryVersion,
  LibraryDependent,
  LibraryLanguage,
  LibraryStatus,
  VersionStatus,
  DependencyCheckResult,
} from '@/api/internal-library';
import { checkDependencies } from '@/api/internal-library';
import dayjs from 'dayjs';

const { Text } = Typography;

// Re-exported from LibraryTable
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

// ---- Dependency Check Tool ----

const DependencyCheckTool: React.FC = () => {
  const [repoName, setRepoName] = useState('');
  const [results, setResults] = useState<DependencyCheckResult[] | null>(null);
  const [checking, setChecking] = useState(false);

  const MOCK_DEP_CHECK: DependencyCheckResult[] = [
    {
      libraryName: '@orion/auth',
      currentVersion: '2.1.0',
      latestVersion: '2.3.0',
      status: 'upgrade_available',
      upgradeType: 'minor',
      securityScore: 92,
      breakingChanges: [],
    },
    {
      libraryName: '@orion/utils',
      currentVersion: '1.5.2',
      latestVersion: '1.5.2',
      status: 'latest',
      securityScore: 95,
      breakingChanges: [],
    },
    {
      libraryName: 'orion-db-core',
      currentVersion: '2.8.0',
      latestVersion: '3.0.0',
      status: 'breaking_change',
      upgradeType: 'major',
      securityScore: 88,
      breakingChanges: ['API signature change', 'Migration required'],
      migrationGuide: 'https://docs.orion.io/db/migrate-v3',
    },
  ];

  const handleCheck = async () => {
    if (!repoName) {
      message.warning('请输入项目名称');
      return;
    }
    setChecking(true);
    try {
      const res = await checkDependencies(repoName);
      setResults(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error: unknown) {
      setResults(MOCK_DEP_CHECK);
      if (error instanceof Error) {
        message.error(`依赖检查失败：${error.message}`);
      }
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
    <Card
      size="small"
      title={
        <Space>
          <LinkOutlined /> 依赖检查工具
        </Space>
      }
    >
      <Space wrap>
        <Input
          placeholder="项目名称 (如: orion-platform-service)"
          style={{ width: 300 }}
          value={repoName}
          onChange={(e) => setRepoName(e.target.value)}
          onPressEnter={handleCheck}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={handleCheck} loading={checking}>
          检查
        </Button>
      </Space>
      {results && results.length > 0 && (
        <AntTable
          dataSource={results}
          rowKey="libraryName"
          size="small"
          pagination={false}
          style={{ marginTop: 12 }}
          columns={[
            {
              key: 'libraryName',
              title: '二方库',
              dataIndex: 'libraryName',
              width: 160,
              render: (v: unknown) => <Text code>{String(v)}</Text>,
            },
            {
              key: 'versions',
              title: '当前 -> 最新',
              width: 160,
              render: (_: unknown, record: DependencyCheckResult) => (
                <Text>
                  <Tag>{record.currentVersion}</Tag> <Text type="secondary">{'\u2192'}</Text>{' '}
                  <Tag color="blue">{record.latestVersion}</Tag>
                </Text>
              ),
            },
            {
              key: 'status',
              title: '状态',
              width: 120,
              render: (_: unknown, record: DependencyCheckResult) => statusTag(record.status),
            },
            {
              key: 'upgradeType',
              title: '升级类型',
              width: 90,
              render: (_: unknown, record: DependencyCheckResult) =>
                record.upgradeType ? (
                  <Tag color={upgradeTypeColorMap[record.upgradeType]}>{record.upgradeType}</Tag>
                ) : (
                  <Text type="secondary">-</Text>
                ),
            },
            {
              key: 'securityScore',
              title: '安全评分',
              width: 90,
              render: (_: unknown, record: DependencyCheckResult) =>
                record.securityScore ? (
                  <Tag
                    color={
                      record.securityScore >= 90
                        ? 'green'
                        : record.securityScore >= 70
                          ? 'orange'
                          : 'red'
                    }
                  >
                    {record.securityScore}
                  </Tag>
                ) : (
                  <Text type="secondary">-</Text>
                ),
            },
            {
              key: 'breakingChanges',
              title: 'Breaking Changes',
              width: 200,
              render: (_: unknown, record: DependencyCheckResult) =>
                record.breakingChanges && record.breakingChanges.length > 0 ? (
                  record.breakingChanges.map((c, i) => (
                    <div key={i}>
                      <WarningOutlined /> <Text type="danger">{c}</Text>
                    </div>
                  ))
                ) : (
                  <Text type="secondary">无</Text>
                ),
            },
          ]}
        />
      )}
    </Card>
  );
};

// ---- Info Tab ----

const InfoTab: React.FC<{ library: InternalLibrary }> = ({ library }) => (
  <Descriptions column={2} bordered size="small">
    <Descriptions.Item label="名称">{library.name}</Descriptions.Item>
    <Descriptions.Item label="显示名称">{library.displayName || '-'}</Descriptions.Item>
    <Descriptions.Item label="描述" span={2}>
      {library.description || '-'}
    </Descriptions.Item>
    <Descriptions.Item label="语言">
      <Tag color="cyan">{languageLabels[library.language]}</Tag>
    </Descriptions.Item>
    <Descriptions.Item label="状态">
      <Tag color={statusColorMap[library.status]}>{library.status}</Tag>
    </Descriptions.Item>
    <Descriptions.Item label="团队">
      <TeamOutlined /> {library.owner}
    </Descriptions.Item>
    <Descriptions.Item label="维护者">{library.maintainers?.join(', ') || '-'}</Descriptions.Item>
    <Descriptions.Item label="仓库" span={2}>
      <Text code>{library.repository}</Text>
    </Descriptions.Item>
    <Descriptions.Item label="文档">
      {library.documentation ? (
        <a href={library.documentation} target="_blank" rel="noopener noreferrer">
          {library.documentation}
        </a>
      ) : (
        '-'
      )}
    </Descriptions.Item>
    <Descriptions.Item label="当前版本">
      <Text code>{library.currentVersion}</Text>
    </Descriptions.Item>
    <Descriptions.Item label="最新稳定版">
      <Text code>{library.latestStableVersion}</Text>
    </Descriptions.Item>
    <Descriptions.Item label="测试覆盖">{library.quality?.testCoverage ?? '-'}%</Descriptions.Item>
    <Descriptions.Item label="安全评分">{library.quality?.securityScore ?? '-'}</Descriptions.Item>
    <Descriptions.Item label="依赖项目数">{library.dependents?.totalRepos ?? 0}</Descriptions.Item>
    <Descriptions.Item label="依赖团队数">{library.dependents?.totalTeams ?? 0}</Descriptions.Item>
    <Descriptions.Item label="使用最新版">
      {library.dependents?.reposUsingLatest ?? 0}
    </Descriptions.Item>
    <Descriptions.Item label="需要升级">
      {library.dependents?.reposNeedingUpgrade ?? 0}
    </Descriptions.Item>
    <Descriptions.Item label="创建时间">
      {dayjs(library.createdAt).format('YYYY-MM-DD HH:mm')}
    </Descriptions.Item>
    <Descriptions.Item label="更新时间">
      {dayjs(library.updatedAt).format('YYYY-MM-DD HH:mm')}
    </Descriptions.Item>
  </Descriptions>
);

// ---- Version Tab ----

interface VersionTabProps {
  versions: LibraryVersion[];
  onOpenPublish: () => void;
  onOpenDeprecateVersion: (version: string) => void;
}

const VersionTab: React.FC<VersionTabProps> = ({
  versions,
  onOpenPublish,
  onOpenDeprecateVersion,
}) => {
  const versionColumns: TableColumn<LibraryVersion>[] = [
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 120,
      render: (v: unknown) => (
        <Text code>
          <RocketOutlined /> {String(v)}
        </Text>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (_: unknown, record: LibraryVersion) => (
        <Tag color={versionStatusColorMap[record.status]}>{record.status}</Tag>
      ),
    },
    {
      key: 'changelog',
      title: '变更说明',
      dataIndex: 'changelog',
      width: 200,
      render: (v: unknown) => <Text type="secondary">{String(v || '-')}</Text>,
    },
    {
      key: 'testCoverage',
      title: '测试覆盖',
      width: 100,
      render: (_: unknown, record: LibraryVersion) =>
        record.testCoverage != null ? (
          <Text>{record.testCoverage}%</Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      key: 'securityScore',
      title: '安全评分',
      width: 100,
      render: (_: unknown, record: LibraryVersion) => {
        if (record.securityScore == null) return <Text type="secondary">-</Text>;
        const color =
          record.securityScore >= 90 ? 'green' : record.securityScore >= 70 ? 'orange' : 'red';
        return <Tag color={color}>{record.securityScore}</Tag>;
      },
    },
    {
      key: 'releasedAt',
      title: '发布时间',
      dataIndex: 'releasedAt',
      width: 140,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(v)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 100,
      render: (_: unknown, record: LibraryVersion) =>
        record.status !== 'deprecated' ? (
          <Popconfirm
            title="确认废弃此版本?"
            onConfirm={() => onOpenDeprecateVersion(record.version)}
          >
            <Button type="link" size="small" danger>
              废弃
            </Button>
          </Popconfirm>
        ) : (
          <Text type="secondary">已废弃</Text>
        ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary">管理二方库版本</Text>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onOpenPublish}>
          发布新版本
        </Button>
      </div>
      <AntTable
        columns={versionColumns}
        dataSource={versions}
        rowKey="version"
        size="small"
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

// ---- Dependents Tab ----

interface DependentsTabProps {
  dependents: LibraryDependent[];
  onUpdateStats: () => void;
  onOpenAddDependent: () => void;
  onUpdateDependent: (repoName: string, version: string) => void;
}

const DependentsTab: React.FC<DependentsTabProps> = ({
  dependents,
  onUpdateStats,
  onOpenAddDependent,
  onUpdateDependent,
}) => {
  const dependentColumns: TableColumn<LibraryDependent>[] = [
    {
      key: 'repoName',
      title: '项目',
      dataIndex: 'repoName',
      width: 200,
      render: (v: unknown) => <Text code>{String(v)}</Text>,
    },
    {
      key: 'teamName',
      title: '团队',
      dataIndex: 'teamName',
      width: 120,
      render: (_: unknown, record: LibraryDependent) => (
        <Space>
          <TeamOutlined /> {record.teamName}
        </Space>
      ),
    },
    {
      key: 'version',
      title: '当前版本',
      dataIndex: 'currentVersion',
      width: 100,
      render: (v: unknown) => <Text code>{String(v)}</Text>,
    },
    {
      key: 'upgradeAvailable',
      title: '升级',
      width: 100,
      render: (_: unknown, record: LibraryDependent) => {
        if (!record.upgradeAvailable) return <Tag color="green">最新</Tag>;
        return <Tag color="blue">{record.upgradeType || 'upgrade'}</Tag>;
      },
    },
    {
      key: 'latestVersion',
      title: '最新版本',
      dataIndex: 'latestCompatibleVersion',
      width: 120,
      render: (v: unknown) => (v ? <Text code>{String(v)}</Text> : <Text type="secondary">-</Text>),
    },
    {
      key: 'lastUpdated',
      title: '最后更新',
      dataIndex: 'lastUpdated',
      width: 140,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(v)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 120,
      render: (_: unknown, record: LibraryDependent) =>
        record.upgradeAvailable && record.latestCompatibleVersion ? (
          <Popconfirm
            title={`确认升级到 ${record.latestCompatibleVersion}?`}
            onConfirm={() => onUpdateDependent(record.repoName, record.latestCompatibleVersion!)}
          >
            <Button type="link" size="small">
              <CheckCircleOutlined /> 升级
            </Button>
          </Popconfirm>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
  ];

  return (
    <div>
      <div
        style={{
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <Text type="secondary">管理依赖此二方库的项目</Text>
          <Button size="small" icon={<ReloadOutlined />} onClick={onUpdateStats}>
            刷新统计
          </Button>
        </Space>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onOpenAddDependent}>
          添加依赖
        </Button>
      </div>
      <AntTable
        columns={dependentColumns}
        dataSource={dependents}
        rowKey="repoName"
        size="small"
        pagination={false}
      />
    </div>
  );
};

// ---- Tabs definition ----

export interface LibraryTabItem {
  key: string;
  label: string;
  children: React.ReactNode;
}

export function getLibraryTabItems(
  selectedLib: InternalLibrary | null,
  versions: LibraryVersion[],
  dependents: LibraryDependent[],
  activeTab: string,
  onTabChange: (key: string) => void,
  onOpenPublish: () => void,
  onOpenDeprecateVersion: (version: string) => void,
  onUpdateStats: () => void,
  onOpenAddDependent: () => void,
  onUpdateDependent: (repoName: string, version: string) => void
): {
  items: LibraryTabItem[];
  activeKey: string;
  onChange: (key: string) => void;
} {
  if (!selectedLib) {
    return { items: [], activeKey: '', onChange: onTabChange };
  }
  const items: LibraryTabItem[] = [
    { key: 'info', label: '基本信息', children: <InfoTab library={selectedLib} /> },
    {
      key: 'versions',
      label: '版本管理',
      children: (
        <VersionTab
          versions={versions}
          onOpenPublish={onOpenPublish}
          onOpenDeprecateVersion={onOpenDeprecateVersion}
        />
      ),
    },
    {
      key: 'dependents',
      label: '依赖者管理',
      children: (
        <DependentsTab
          dependents={dependents}
          onUpdateStats={onUpdateStats}
          onOpenAddDependent={onOpenAddDependent}
          onUpdateDependent={onUpdateDependent}
        />
      ),
    },
    { key: 'dep-check', label: '依赖检查', children: <DependencyCheckTool /> },
  ];
  return { items, activeKey: activeTab, onChange: onTabChange };
}
