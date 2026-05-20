/**
 * Module Manager Page (Workflow 5: Feature Domain Management)
 *
 * Features:
 * - Module list table with enable/disable toggle controls
 * - Dependency visualization (tree-based graph)
 * - Startup order display (topological sort)
 * - Validation report (missing deps, circular deps)
 * - Filter by level (core/domain/service/feature) and status
 *
 * Backend API:
 * - GET /api/v1/system/modules - list all modules
 * - PUT /api/v1/system/modules/:id/toggle - enable/disable module
 * - GET /api/v1/system/modules/validate - dependency validation
 * - GET /api/v1/system/modules/startup-order - startup order
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  Switch,
  message,
  Tabs,
  Tooltip,
  Row,
  Col,
  Modal,
} from 'antd';
import {
  ReloadOutlined,
  ClusterOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import MetricCard from '@/components/MetricCard';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { colors, spacing } from '@/tokens';
import {
  getModules,
  toggleModule,
  validateDependencies,
  getStartupOrder,
  type ModuleDescriptor,
  type ModuleState,
  type DependencyValidationResult,
} from '@/api/module-manager';
import DependencyGraph from './DependencyGraph';
import ValidationReport from './ValidationReport';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ============================================================================
// Constants
// ============================================================================

const LEVEL_OPTIONS = [
  { label: '全部层级', value: 'all' },
  { label: '核心 (Core)', value: 'core' },
  { label: '域 (Domain)', value: 'domain' },
  { label: '服务 (Service)', value: 'service' },
  { label: '特性 (Feature)', value: 'feature' },
];

const STATUS_OPTIONS = [
  { label: '全部状态', value: 'all' },
  { label: '活跃', value: 'active' },
  { label: '已注册', value: 'registered' },
  { label: '已停止', value: 'stopped' },
  { label: '失败', value: 'failed' },
];

const stateColor: Record<ModuleState, string> = {
  active: colors.success[500],
  registered: colors.neutral[400],
  starting: colors.warning[500],
  stopping: colors.warning[500],
  stopped: colors.error[500],
  failed: colors.error[500],
};

const stateLabel: Record<ModuleState, string> = {
  active: '活跃',
  registered: '已注册',
  starting: '启动中',
  stopping: '停止中',
  stopped: '已停止',
  failed: '失败',
};

const levelColor: Record<string, string> = {
  core: colors.error[500],
  domain: colors.purple[500],
  service: colors.info[500],
  feature: colors.success[500],
};

const levelLabel: Record<string, string> = {
  core: '核心',
  domain: '域',
  service: '服务',
  feature: '特性',
};

// ============================================================================
// Main Component
// ============================================================================

const ModuleManagerPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [modules, setModules] = useState<ModuleDescriptor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [validationResult, setValidationResult] = useState<DependencyValidationResult | null>(null);
  const [startupOrder, setStartupOrder] = useState<string[]>([]);
  const [validationLoading, setValidationLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState('list');

  // ---- Data Loading ----

  const loadModules = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getModules();
      setModules(response.data?.data || []);
    } catch (error: unknown) {
      message.error(`加载模块列表失败: ${(error as Error).message}`);
      setModules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadValidation = useCallback(async () => {
    setValidationLoading(true);
    try {
      const [validationRes, orderRes] = await Promise.all([
        validateDependencies(),
        getStartupOrder(),
      ]);
      setValidationResult(validationRes.data?.data?.validation || null);
      setStartupOrder(orderRes.data?.data?.order || []);
    } catch (error: unknown) {
      message.error(`加载校验数据失败: ${(error as Error).message}`);
    } finally {
      setValidationLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadModules(), loadValidation()]);
  }, [loadModules, loadValidation]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ---- Filtering ----

  const filteredModules = useMemo(() => {
    return modules.filter((mod) => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [mod.id, mod.name, mod.description, mod.domain]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      // Level filter
      if (levelFilter !== 'all' && mod.level !== levelFilter) return false;
      // Status filter
      if (statusFilter !== 'all' && mod.state !== statusFilter) return false;
      return true;
    });
  }, [modules, searchQuery, levelFilter, statusFilter]);

  // ---- Stats ----

  const stats = useMemo(() => {
    const total = modules.length;
    const active = modules.filter((m) => m.state === 'active').length;
    const enabled = modules.filter((m) => m.config.enabled).length;
    const failed = modules.filter((m) => m.state === 'failed').length;
    return { total, active, enabled, failed };
  }, [modules]);

  // ---- Actions ----

  const handleToggleModule = async (module: ModuleDescriptor, newEnabled: boolean) => {
    if (module.level === 'core' && !newEnabled) {
      message.warning('核心模块不能被禁用');
      return;
    }

    setToggleLoading((prev) => ({ ...prev, [module.id]: true }));
    try {
      await toggleModule(module.id, newEnabled);
      message.success(`模块 "${module.name}" 已${newEnabled ? '启用' : '禁用'}`);
      // Update local state
      setModules((prev) =>
        prev.map((m) =>
          m.id === module.id
            ? { ...m, config: { ...m.config, enabled: newEnabled } }
            : m
        )
      );
      // Reload validation
      await loadValidation();
    } catch (error: unknown) {
      const err = error as Error;
      message.error(`操作失败: ${err.message}`);
    } finally {
      setToggleLoading((prev) => ({ ...prev, [module.id]: false }));
    }
  };

  const filterDefinitions: FilterDefinition[] = [
    {
      key: 'level',
      label: '模块层级',
      options: LEVEL_OPTIONS,
      placeholder: '按层级筛选',
    },
    {
      key: 'status',
      label: '模块状态',
      options: STATUS_OPTIONS,
      placeholder: '按状态筛选',
    },
  ];

  // ---- Table Columns ----

  const columns: ColumnsType<ModuleDescriptor> = [
    {
      title: '模块名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.id}
          </Text>
        </Space>
      ),
    },
    {
      title: '层级',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      filters: [
        { text: '核心', value: 'core' },
        { text: '域', value: 'domain' },
        { text: '服务', value: 'service' },
        { text: '特性', value: 'feature' },
      ],
      onFilter: (value, record) => record.level === value,
      render: (level: string) => (
        <Tag color={levelColor[level]} style={{ margin: 0 }}>
          {levelLabel[level]}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'state',
      key: 'state',
      width: 90,
      filters: Object.entries(stateLabel).map(([value, text]) => ({ text, value })),
      onFilter: (value, record) => record.state === value,
      render: (state: ModuleState) => (
        <Tag color={stateColor[state]} style={{ margin: 0 }}>
          {stateLabel[state]}
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <Text style={{ fontSize: 13 }}>{text}</Text>
        </Tooltip>
      ),
    },
    {
      title: '依赖数',
      key: 'dependencies',
      width: 80,
      sorter: (a, b) => (a.config.dependencies?.length || 0) - (b.config.dependencies?.length || 0),
      render: (_: unknown, record) => (
        <Text type="secondary">{record.config.dependencies?.length || 0}</Text>
      ),
    },
    {
      title: '路由前缀',
      dataIndex: 'routePrefix',
      key: 'routePrefix',
      width: 120,
      render: (prefix?: string) => (prefix ? <Tag>{prefix}</Tag> : '-'),
    },
    {
      title: '启用',
      key: 'enabled',
      width: 80,
      render: (_: unknown, record) => (
        <Switch
          size="small"
          checked={record.config.enabled}
          loading={toggleLoading[record.id]}
          disabled={record.level === 'core' && record.config.enabled}
          onChange={(checked) => handleToggleModule(record, checked)}
          checkedChildren="开"
          unCheckedChildren="关"
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              onClick={() => {
                Modal.info({
                  title: `模块详情: ${record.name}`,
                  width: 600,
                  content: (
                    <div>
                      <p><strong>ID:</strong> {record.id}</p>
                      <p><strong>名称:</strong> {record.name}</p>
                      <p><strong>描述:</strong> {record.description}</p>
                      <p><strong>层级:</strong> {levelLabel[record.level]}</p>
                      <p><strong>状态:</strong> {stateLabel[record.state]}</p>
                      <p><strong>启用:</strong> {record.config.enabled ? '是' : '否'}</p>
                      <p><strong>自动启动:</strong> {record.config.autoStart ? '是' : '否'}</p>
                      <p><strong>优先级:</strong> {record.config.priority ?? '-'}</p>
                      <p><strong>依赖:</strong></p>
                      <ul>
                        {(record.config.dependencies || []).map((dep) => (
                          <li key={dep}><Text code>{dep}</Text></li>
                        ))}
                      </ul>
                      {record.routePrefix && <p><strong>路由前缀:</strong> {record.routePrefix}</p>}
                      {record.error && <p><strong>错误:</strong> <Text type="danger">{record.error}</Text></p>}
                      {record.domain && <p><strong>所属域:</strong> {record.domain}</p>}
                    </div>
                  ),
                });
              }}
            >
              详情
            </Button>
          </Tooltip>
          {record.state === 'failed' && record.error && (
            <Tooltip title="查看错误">
              <Button type="link" size="small" danger>
                错误
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // ---- Render ----

  return (
    <div style={{ padding: 0 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing[6],
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <ClusterOutlined style={{ marginRight: spacing[2], color: colors.primary[500] }} />
            模块管理
          </Title>
          <Text type="secondary">
            共 {stats.total} 个模块 · {stats.active} 个活跃 · {stats.failed > 0 && `${stats.failed} 个失败`}
          </Text>
          <Text type="secondary">
            共 {stats.total} 个模块 · {stats.active} 个活跃 · {stats.failed > 0 && `${stats.failed} 个失败`}
          </Text>
        </div>
        <Space>
          <Button
            icon={<ThunderboltOutlined />}
            onClick={() => {
              setActiveTab('validation');
              loadValidation();
            }}
          >
            依赖校验
          </Button>
          <Button
            icon={<PlayCircleOutlined />}
            onClick={() => {
              setActiveTab('validation');
              loadValidation();
            }}
          >
            启动顺序
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadAll}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* Stats Cards */}
      <div style={{ marginBottom: spacing[6] }}>
        <Row gutter={spacing[4]}>
          <Col span={6}>
            <MetricCard
              title="模块总数"
              value={stats.total}
              icon={<ClusterOutlined style={{ fontSize: 20 }} />}
            />
          </Col>
          <Col span={6}>
            <MetricCard
              title="活跃模块"
              value={stats.active}
              color={colors.success[500]}
              icon={<CheckCircleOutlined style={{ fontSize: 20 }} />}
            />
          </Col>
          <Col span={6}>
            <MetricCard
              title="已启用"
              value={stats.enabled}
              icon={<ThunderboltOutlined style={{ fontSize: 20 }} />}
            />
          </Col>
          <Col span={6}>
            <MetricCard
              title="失败模块"
              value={stats.failed}
              color={stats.failed > 0 ? colors.error[500] : undefined}
              icon={<WarningOutlined style={{ fontSize: 20 }} />}
            />
          </Col>
        </Row>
      </div>

      {/* Tabbed content */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'list',
            label: '模块列表',
            children: (
              <Card>
                {/* Search and Filter */}
                <div style={{ marginBottom: spacing[4] }}>
                  <SearchFilterBar
                    onSearch={setSearchQuery}
                    filters={filterDefinitions}
                    searchPlaceholder="搜索模块名称、ID或描述..."
                    onFilter={(filters) => {
                      if (filters.level) setLevelFilter(String(filters.level));
                      if (filters.status) setStatusFilter(String(filters.status));
                    }}
                    initialFilters={{ level: 'all', status: 'all' }}
                  />
                </div>

                {/* Module Table */}
                <Table<ModuleDescriptor>
                  columns={columns}
                  dataSource={filteredModules}
                  rowKey="id"
                  loading={loading}
                  size="middle"
                  pagination={{
                    pageSize: 20,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 个模块`,
                  }}
                />
              </Card>
            ),
          },
          {
            key: 'dependency',
            label: '依赖关系图',
            children: <DependencyGraph modules={modules} levelFilter={levelFilter !== 'all' ? levelFilter : undefined} />,
          },
          {
            key: 'dependency-reverse',
            label: '反向依赖',
            children: (
              <DependencyGraph
                modules={modules}
                showReverseDeps
                levelFilter={levelFilter !== 'all' ? levelFilter : undefined}
              />
            ),
          },
          {
            key: 'validation',
            label: '校验报告',
            children: (
              <ValidationReport
                validation={validationResult}
                loading={validationLoading}
                startupOrder={startupOrder}
              />
            ),
          },
        ]}
      />
    </div>
  );
};

export default ModuleManagerPage;
