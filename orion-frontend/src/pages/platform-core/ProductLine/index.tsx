/**
 * Product Line Management Page
 * List, create, edit product lines; manage ReleaseTrains and HotfixChannels
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Tabs,
  Table as AntTable,
  Descriptions,
  Drawer,
  Tooltip,
  Switch,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  BranchesOutlined,
  RocketOutlined,
  FireOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import PageSkeleton from '@/components/PageSkeleton';
import {
  getProductLines,
  createProductLine,
  updateProductLine,
  deleteProductLine,
  activateProductLine,
  suspendProductLine,
  getReleaseTrains,
  createReleaseTrain,
  getHotfixChannels,
  createHotfixChannel,
  resolveEnvironment,
  requiresApproval,
  isHotfix,
  type ProductLine,
  type ProductLineCreateInput,
  type ProductLineUpdateInput,
  type ReleaseTrain,
  type ReleaseTrainInput,
  type HotfixChannel,
  type HotfixChannelInput,
  type BranchMode,
  type ProductLinePhase,
} from '@/api/product-lines';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ---- Status color maps ----

const phaseColorMap: Record<ProductLinePhase, string> = {
  Pending: 'orange',
  Active: 'green',
  Suspended: 'red',
  Error: 'magenta',
  Terminating: 'default',
};

const releaseTrainStateColorMap: Record<string, string> = {
  Idle: 'default',
  Running: 'processing',
  Completed: 'success',
  Failed: 'error',
  Skipped: 'warning',
};

const branchModeOptions = [
  { label: 'GitFlow', value: 'gitflow' },
  { label: 'GitHub Flow', value: 'github-flow' },
  { label: 'Trunk Based', value: 'trunk-based' },
];

const envOptions = [
  { label: 'Dev', value: 'dev' },
  { label: 'Test', value: 'test' },
  { label: 'Staging', value: 'staging' },
  { label: 'Pre-prod', value: 'preprod' },
  { label: 'Prod', value: 'prod' },
];

const gitProviderOptions = [
  { label: 'GitHub', value: 'github' },
  { label: 'GitLab', value: 'gitlab' },
  { label: 'Gitea', value: 'gitea' },
  { label: 'Azure DevOps', value: 'azure-devops' },
];

// ---- Branch Resolver Tool ----

const BranchResolver: React.FC<{ productLines: ProductLine[] }> = ({ productLines }) => {
  const [plId, setPlId] = useState<string>('');
  const [branch, setBranch] = useState('');
  const [result, setResult] = useState<{
    env?: string;
    needsApproval?: boolean;
    isHotfixBranch?: boolean;
  } | null>(null);

  const handleResolve = async () => {
    if (!plId || !branch) {
      message.warning('请选择产品线并输入分支名');
      return;
    }
    try {
      const [envRes, approvalRes, hotfixRes] = await Promise.all([
        resolveEnvironment(plId, branch).catch(() => null),
        requiresApproval(plId, branch).catch(() => null),
        isHotfix(plId, branch).catch(() => null),
      ]);
      setResult({
        env: envRes?.data?.data ? String(envRes.data.data) : undefined,
        needsApproval: approvalRes?.data?.data?.requiresApproval,
        isHotfixBranch: hotfixRes?.data?.data?.isHotfix,
      });
    } catch (error: unknown) {
      // Try mock: find matching env mapping
      const pl = productLines.find((p) => p.id === plId);
      if (pl) {
        const mappings = pl.environmentMappings.mappings;
        let matchedEnv = pl.environmentMappings.defaultEnvironment;
        let needsApproval = true;
        for (const m of mappings) {
          if (m.patternType === 'exact' && m.branch === branch) {
            matchedEnv = m.environment;
            needsApproval = m.requireApproval ?? true;
            break;
          }
          if (m.patternType === 'glob') {
            const re = new RegExp('^' + m.branch.replace(/\*/g, '.*') + '$');
            if (re.test(branch)) {
              matchedEnv = m.environment;
              needsApproval = m.requireApproval ?? true;
              break;
            }
          }
        }
        const isHot =
          pl.branchPolicies.protectedBranches?.some((p) => p.pattern.startsWith('hotfix')) &&
          branch.startsWith('hotfix/');
        setResult({ env: matchedEnv, needsApproval, isHotfixBranch: isHot });
      }
    }
  };

  return (
    <Card
      size="small"
      title={
        <Space>
          <BranchesOutlined /> 分支环境解析工具
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <Space wrap>
        <Select
          style={{ width: 200 }}
          placeholder="选择产品线"
          value={plId}
          onChange={setPlId}
          options={productLines.map((pl) => ({ label: pl.displayName, value: pl.id }))}
        />
        <Input
          placeholder="分支名称 (如: feature/xxx)"
          style={{ width: 240 }}
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          onPressEnter={handleResolve}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={handleResolve}>
          解析
        </Button>
      </Space>
      {result && (
        <Descriptions size="small" style={{ marginTop: 12 }} column={3} bordered>
          <Descriptions.Item label="目标环境">
            {result.env ? (
              <Tag color="blue">{result.env}</Tag>
            ) : (
              <Text type="secondary">未匹配</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="需要审批">
            {result.needsApproval !== undefined ? (
              result.needsApproval ? (
                <Tag color="orange">是</Tag>
              ) : (
                <Tag color="green">否</Tag>
              )
            ) : (
              <Text type="secondary">-</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Hotfix 分支">
            {result.isHotfixBranch !== undefined ? (
              result.isHotfixBranch ? (
                <Tag color="red">
                  <FireOutlined /> 是
                </Tag>
              ) : (
                <Tag>否</Tag>
              )
            ) : (
              <Text type="secondary">-</Text>
            )}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Card>
  );
};

// ---- Main Component ----

const ProductLineManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingPL, setEditingPL] = useState<ProductLine | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedPL, setSelectedPL] = useState<ProductLine | null>(null);
  const [releaseTrains, setReleaseTrains] = useState<ReleaseTrain[]>([]);
  const [hotfixChannels, setHotfixChannels] = useState<HotfixChannel[]>([]);
  const [rtModalVisible, setRtModalVisible] = useState(false);
  const [hfModalVisible, setHfModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [rtForm] = Form.useForm();
  const [hfForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getProductLines();
      setProductLines(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error: unknown) {
      setProductLines([]);
      message.error(`加载产品线数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    return productLines.filter((pl) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !pl.name.toLowerCase().includes(q) &&
          !pl.displayName.toLowerCase().includes(q) &&
          !(pl.description && pl.description.toLowerCase().includes(q))
        )
          return false;
      }
      if (filters.phase && filters.phase !== 'all' && pl.status.phase !== filters.phase)
        return false;
      if (
        filters.branchMode &&
        filters.branchMode !== 'all' &&
        pl.branchPolicies.mode !== filters.branchMode
      )
        return false;
      return true;
    });
  }, [searchQuery, filters, productLines]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload: ProductLineCreateInput = {
        name: values.name,
        displayName: values.displayName,
        description: values.description,
        gitRepo: {
          url: values.gitUrl,
          provider: values.gitProvider || 'github',
          defaultBranch: values.gitDefaultBranch || 'main',
        },
        branchPolicies: {
          mode: values.branchMode || 'gitflow',
          protectedBranches: [],
        },
        environmentMappings: {
          defaultEnvironment: values.defaultEnvironment || 'dev',
          mappings: [
            {
              branch: 'main',
              patternType: 'exact' as const,
              environment: 'prod' as const,
              requireApproval: true,
            },
            {
              branch: 'develop',
              patternType: 'exact' as const,
              environment: 'test' as const,
              requireApproval: false,
            },
            {
              branch: 'feature/*',
              patternType: 'glob' as const,
              environment: 'dev' as const,
              requireApproval: false,
            },
          ],
        },
        tenantId: values.tenantId,
      };
      await createProductLine(payload);
      message.success('产品线创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`创建失败：${error.message}`);
        } else {
          message.error('创建失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingPL) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      const payload: ProductLineUpdateInput = {
        displayName: values.displayName,
        description: values.description,
        branchPolicies: {
          mode: values.branchMode || editingPL.branchPolicies.mode,
          protectedBranches: editingPL.branchPolicies.protectedBranches,
        },
        environmentMappings: editingPL.environmentMappings,
      };
      await updateProductLine(editingPL.id, payload);
      message.success('产品线更新成功');
      setEditModalVisible(false);
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`更新失败：${error.message}`);
        } else {
          message.error('更新失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProductLine(id);
      message.success('产品线已删除');
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
      await activateProductLine(id);
      message.success('产品线已激活');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`激活失败：${error.message}`);
      } else {
        message.error('激活失败');
      }
    }
  };

  const handleSuspend = async (id: string) => {
    try {
      await suspendProductLine(id);
      message.success('产品线已暂停');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`暂停失败：${error.message}`);
      } else {
        message.error('暂停失败');
      }
    }
  };

  const openEdit = (pl: ProductLine) => {
    setEditingPL(pl);
    editForm.setFieldsValue({
      displayName: pl.displayName,
      description: pl.description,
      branchMode: pl.branchPolicies.mode,
    });
    setEditModalVisible(true);
  };

  const openDetail = async (pl: ProductLine) => {
    setSelectedPL(pl);
    setDetailDrawerVisible(true);
    try {
      const [rtRes, hfRes] = await Promise.all([getReleaseTrains(pl.id), getHotfixChannels(pl.id)]);
      setReleaseTrains(rtRes?.data?.data || []);
      setHotfixChannels(hfRes?.data?.data || []);
    } catch (error: unknown) {
      setReleaseTrains([]);
      setHotfixChannels([]);
    }
  };

  const handleCreateRT = async () => {
    if (!selectedPL) return;
    try {
      const values = await rtForm.validateFields();
      setSubmitting(true);
      const payload: ReleaseTrainInput = {
        name: values.rtName,
        schedule: values.rtSchedule,
        targetBranch: values.rtTargetBranch || 'main',
        sourceBranch: values.rtSourceBranch || 'develop',
        autoPromote: values.rtAutoPromote || false,
        approvalRequired:
          values.rtApprovalRequired !== undefined ? values.rtApprovalRequired : true,
        approvers: values.rtApprovers
          ? values.rtApprovers.split(',').map((s: string) => s.trim())
          : [],
      };
      await createReleaseTrain(selectedPL.id, payload);
      message.success('发布列车创建成功');
      setRtModalVisible(false);
      rtForm.resetFields();
      // Reload
      try {
        const res = await getReleaseTrains(selectedPL.id);
        setReleaseTrains(res.data?.data || []);
      } catch {
        /* optional reload, ignore */
      }
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`创建失败：${error.message}`);
        } else {
          message.error('创建失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateHF = async () => {
    if (!selectedPL) return;
    try {
      const values = await hfForm.validateFields();
      setSubmitting(true);
      const payload: HotfixChannelInput = {
        name: values.hfName,
        enabled: values.hfEnabled !== undefined ? values.hfEnabled : true,
        branchPattern: values.hfBranchPattern || '^hotfix/.*$',
        approvalRequired:
          values.hfApprovalRequired !== undefined ? values.hfApprovalRequired : true,
        approvalTimeout: values.hfApprovalTimeout || 30,
        autoMerge: values.hfAutoMerge || false,
        notifyOnCall: values.hfNotifyOnCall !== undefined ? values.hfNotifyOnCall : true,
        maxDuration: values.hfMaxDuration || 60,
      };
      await createHotfixChannel(selectedPL.id, payload);
      message.success('紧急修复通道创建成功');
      setHfModalVisible(false);
      hfForm.resetFields();
      try {
        const res = await getHotfixChannels(selectedPL.id);
        setHotfixChannels(res.data?.data || []);
      } catch {
        /* optional reload, ignore */
      }
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`创建失败：${error.message}`);
        } else {
          message.error('创建失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Table columns ----

  const columns: TableColumn<ProductLine>[] = [
    {
      key: 'displayName',
      title: '产品线',
      dataIndex: 'displayName',
      width: 160,
      sortable: true,
      render: (v: unknown, record: ProductLine) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>
            {String(v)}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.name}
          </Text>
        </Space>
      ),
    },
    {
      key: 'description',
      title: '描述',
      dataIndex: 'description',
      width: 200,
      render: (v: unknown) => <Text type="secondary">{String(v || '-')}</Text>,
    },
    {
      key: 'branchMode',
      title: '分支模式',
      width: 110,
      render: (_: unknown, record: ProductLine) => {
        const mode = record.branchPolicies?.mode as BranchMode;
        const modeLabels: Record<BranchMode, string> = {
          gitflow: 'GitFlow',
          'github-flow': 'GitHub Flow',
          'trunk-based': 'Trunk-Based',
        };
        return <Tag>{modeLabels[mode] || mode}</Tag>;
      },
    },
    {
      key: 'phase',
      title: '状态',
      width: 90,
      render: (_: unknown, record: ProductLine) => (
        <Tag color={phaseColorMap[record.status?.phase as ProductLinePhase] || 'default'}>
          {record.status?.phase || '-'}
        </Tag>
      ),
    },
    {
      key: 'stats',
      title: '流水线/部署',
      width: 130,
      render: (_: unknown, record: ProductLine) => {
        const stats = record.status?.statistics;
        if (!stats) return <Text type="secondary">-</Text>;
        return (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>共 {stats.totalPipelines || 0} 次</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              部署 {stats.totalDeployments || 0} 次
            </Text>
          </Space>
        );
      },
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 140,
      sortable: true,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(v)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 240,
      render: (_: unknown, record: ProductLine) => (
        <Space size="small" wrap>
          <Tooltip title="查看详情">
            <Button type="link" size="small" onClick={() => openDetail(record)}>
              详情
            </Button>
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          {record.status?.phase === 'Active' ? (
            <Tooltip title="暂停">
              <Popconfirm title="确认暂停?" onConfirm={() => handleSuspend(record.id)}>
                <Button type="link" size="small" danger icon={<PauseCircleOutlined />} />
              </Popconfirm>
            </Tooltip>
          ) : record.status?.phase === 'Suspended' || record.status?.phase === 'Pending' ? (
            <Tooltip title="激活">
              <Popconfirm title="确认激活?" onConfirm={() => handleActivate(record.id)}>
                <Button type="link" size="small" icon={<PlayCircleOutlined />} />
              </Popconfirm>
            </Tooltip>
          ) : null}
          <Tooltip title="删除">
            <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const filterDefs: FilterDefinition[] = [
    {
      key: 'phase',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: 'Pending', value: 'Pending' },
        { label: 'Active', value: 'Active' },
        { label: 'Suspended', value: 'Suspended' },
        { label: 'Error', value: 'Error' },
      ],
    },
    {
      key: 'branchMode',
      label: '分支模式',
      options: [
        { label: '全部', value: 'all' },
        { label: 'GitFlow', value: 'gitflow' },
        { label: 'GitHub Flow', value: 'github-flow' },
        { label: 'Trunk-Based', value: 'trunk-based' },
      ],
    },
  ];

  // ---- Release Train columns ----

  const rtColumns: TableColumn<ReleaseTrain>[] = [
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      width: 140,
      render: (v: unknown) => (
        <Text strong>
          <RocketOutlined /> {String(v)}
        </Text>
      ),
    },
    {
      key: 'schedule',
      title: '调度 (Cron)',
      dataIndex: 'schedule',
      width: 120,
      render: (v: unknown) => <Text code>{String(v)}</Text>,
    },
    {
      key: 'branches',
      title: '源 -> 目标',
      width: 160,
      render: (_: unknown, record: ReleaseTrain) => (
        <Text>
          <Tag>{record.sourceBranch || 'develop'}</Tag> <Text type="secondary">→</Text>{' '}
          <Tag color="blue">{record.targetBranch || 'main'}</Tag>
        </Text>
      ),
    },
    {
      key: 'state',
      title: '状态',
      width: 90,
      render: (_: unknown, record: ReleaseTrain) => (
        <Tag color={releaseTrainStateColorMap[record.status?.state] || 'default'}>
          {record.status?.state || '-'}
        </Tag>
      ),
    },
    {
      key: 'lastRelease',
      title: '上次发布',
      width: 100,
      render: (_: unknown, record: ReleaseTrain) => (
        <Text>{record.status?.lastRelease || '-'}</Text>
      ),
    },
    {
      key: 'nextRun',
      title: '下次运行',
      width: 140,
      render: (_: unknown, record: ReleaseTrain) => (
        <Text type="secondary">
          {record.status?.nextRun ? dayjs(String(record.status.nextRun)).fromNow() : '-'}
        </Text>
      ),
    },
  ];

  // ---- Hotfix Channel columns ----

  const hfColumns: TableColumn<HotfixChannel>[] = [
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      width: 160,
      render: (v: unknown) => (
        <Text strong>
          <FireOutlined /> {String(v)}
        </Text>
      ),
    },
    {
      key: 'branchPattern',
      title: '分支模式',
      dataIndex: 'branchPattern',
      width: 140,
      render: (v: unknown) => <Text code>{String(v)}</Text>,
    },
    {
      key: 'enabled',
      title: '启用',
      dataIndex: 'enabled',
      width: 70,
      render: (v: unknown) => <Switch checked={!!v} size="small" disabled />,
    },
    {
      key: 'approvalRequired',
      title: '需要审批',
      dataIndex: 'approvalRequired',
      width: 90,
      render: (v: unknown) => (v ? <Tag color="orange">是</Tag> : <Tag>否</Tag>),
    },
    {
      key: 'autoMerge',
      title: '自动合并',
      dataIndex: 'autoMerge',
      width: 90,
      render: (v: unknown) => (v ? <Tag color="green">是</Tag> : <Tag>否</Tag>),
    },
    {
      key: 'activeHotfixes',
      title: '进行中',
      width: 80,
      render: (_: unknown, record: HotfixChannel) => (
        <Text>{record.status?.activeHotfixes ?? 0}</Text>
      ),
    },
    {
      key: 'maxDuration',
      title: '最大时长(分)',
      dataIndex: 'maxDuration',
      width: 100,
      render: (v: unknown) => <Text>{String(v ?? '-')}</Text>,
    },
  ];

  // ---- Detail Drawer content ----

  const detailTabItems = useMemo(
    () => [
      {
        key: 'info',
        label: '基本信息',
        children: selectedPL ? (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="名称">{selectedPL.name}</Descriptions.Item>
            <Descriptions.Item label="显示名称">{selectedPL.displayName}</Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {selectedPL.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Git 仓库" span={2}>
              <Text code>{selectedPL.gitRepo?.url}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Provider">{selectedPL.gitRepo?.provider}</Descriptions.Item>
            <Descriptions.Item label="默认分支">
              {selectedPL.gitRepo?.defaultBranch}
            </Descriptions.Item>
            <Descriptions.Item label="分支模式">
              {selectedPL.branchPolicies?.mode}
            </Descriptions.Item>
            <Descriptions.Item label="默认环境">
              {selectedPL.environmentMappings?.defaultEnvironment}
            </Descriptions.Item>
            <Descriptions.Item label="环境映射数">
              {selectedPL.environmentMappings?.mappings?.length || 0}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={phaseColorMap[selectedPL.status?.phase as ProductLinePhase]}>
                {selectedPL.status?.phase}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        ) : null,
      },
      {
        key: 'release-trains',
        label: '发布列车',
        children: (
          <div>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">管理定时发布列车</Text>
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setRtModalVisible(true)}
              >
                创建发布列车
              </Button>
            </div>
            <AntTable
              columns={rtColumns}
              dataSource={releaseTrains}
              rowKey="id"
              size="small"
              pagination={false}
            />
          </div>
        ),
      },
      {
        key: 'hotfix-channels',
        label: 'Hotfix 通道',
        children: (
          <div>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">管理紧急修复通道</Text>
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                danger
                onClick={() => setHfModalVisible(true)}
              >
                创建 Hotfix 通道
              </Button>
            </div>
            <AntTable
              columns={hfColumns}
              dataSource={hotfixChannels}
              rowKey="id"
              size="small"
              pagination={false}
            />
          </div>
        ),
      },
    ],
    [selectedPL, releaseTrains, hotfixChannels]
  );

  const isInitialLoading = loading && productLines.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {/* Page loading skeleton (initial load) */}
      {isInitialLoading && <PageSkeleton rows={8} />}

      {isInitialLoading ? null : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 24,
            }}
          >
            <div>
              <Title level={3} style={{ margin: 0 }}>
                多分支产品线
              </Title>
              <Text type="secondary">管理产品线的分支策略、环境映射、发布列车和紧急修复通道</Text>
            </div>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                创建产品线
              </Button>
            </Space>
          </div>

          {/* Branch Resolver Tool */}
          <BranchResolver productLines={productLines} />

          {/* Product Line List */}
          <Card>
            <div style={{ marginBottom: 16 }}>
              <SearchFilterBar
                onSearch={setSearchQuery}
                onFilter={setFilters}
                filters={filterDefs}
                searchPlaceholder="搜索产品线..."
              />
            </div>
            <Table
              columns={columns}
              dataSource={filteredData}
              loading={loading}
              rowKey="id"
              size="middle"
              striped
            />
          </Card>

          {/* Create Modal */}
          <Modal
            title="创建产品线"
            open={createModalVisible}
            onCancel={() => setCreateModalVisible(false)}
            onOk={handleCreate}
            confirmLoading={submitting}
            width={640}
            destroyOnClose
          >
            <Form form={createForm} layout="vertical">
              <Form.Item
                name="name"
                label="名称 (唯一标识)"
                rules={[{ required: true, message: '请输入名称' }]}
              >
                <Input placeholder="如: core-platform" />
              </Form.Item>
              <Form.Item
                name="displayName"
                label="显示名称"
                rules={[{ required: true, message: '请输入显示名称' }]}
              >
                <Input placeholder="如: 核心平台" />
              </Form.Item>
              <Form.Item name="description" label="描述">
                <Input.TextArea rows={2} placeholder="产品线描述..." />
              </Form.Item>
              <Form.Item
                name="gitUrl"
                label="Git 仓库地址"
                rules={[{ required: true, message: '请输入仓库地址' }]}
              >
                <Input placeholder="https://github.com/org/repo" />
              </Form.Item>
              <Form.Item name="gitProvider" label="Git Provider">
                <Select options={gitProviderOptions} defaultValue="github" />
              </Form.Item>
              <Form.Item name="gitDefaultBranch" label="默认分支">
                <Input placeholder="main" defaultValue="main" />
              </Form.Item>
              <Form.Item name="branchMode" label="分支模式" rules={[{ required: true }]}>
                <Select options={branchModeOptions} defaultValue="gitflow" />
              </Form.Item>
              <Form.Item name="defaultEnvironment" label="默认环境">
                <Select options={envOptions} defaultValue="dev" />
              </Form.Item>
              <Form.Item name="tenantId" label="租户 ID (可选)">
                <Input placeholder="tenant-id" />
              </Form.Item>
            </Form>
          </Modal>

          {/* Edit Modal */}
          <Modal
            title="编辑产品线"
            open={editModalVisible}
            onCancel={() => setEditModalVisible(false)}
            onOk={handleEdit}
            confirmLoading={submitting}
            width={640}
            destroyOnClose
          >
            <Form form={editForm} layout="vertical">
              <Form.Item name="displayName" label="显示名称" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="description" label="描述">
                <Input.TextArea rows={2} />
              </Form.Item>
              <Form.Item name="branchMode" label="分支模式">
                <Select options={branchModeOptions} />
              </Form.Item>
            </Form>
          </Modal>

          {/* Detail Drawer */}
          <Drawer
            title={selectedPL ? `${selectedPL.displayName} (${selectedPL.name})` : '详情'}
            open={detailDrawerVisible}
            onClose={() => setDetailDrawerVisible(false)}
            width={800}
            destroyOnClose
          >
            <Tabs items={detailTabItems} />
          </Drawer>

          {/* Create Release Train Modal */}
          <Modal
            title="创建发布列车"
            open={rtModalVisible}
            onCancel={() => setRtModalVisible(false)}
            onOk={handleCreateRT}
            confirmLoading={submitting}
          >
            <Form form={rtForm} layout="vertical">
              <Form.Item name="rtName" label="名称" rules={[{ required: true }]}>
                <Input placeholder="如: Weekly Release" />
              </Form.Item>
              <Form.Item name="rtSchedule" label="调度 (Cron 表达式)" rules={[{ required: true }]}>
                <Input placeholder="0 10 * * 4" />
              </Form.Item>
              <Form.Item name="rtSourceBranch" label="源分支">
                <Input placeholder="develop" defaultValue="develop" />
              </Form.Item>
              <Form.Item name="rtTargetBranch" label="目标分支">
                <Input placeholder="main" defaultValue="main" />
              </Form.Item>
              <Form.Item name="rtApprovalRequired" label="需要审批" valuePropName="checked">
                <Switch defaultChecked />
              </Form.Item>
              <Form.Item name="rtAutoPromote" label="自动晋升" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="rtApprovers" label="审批人 (逗号分隔)">
                <Input placeholder="tech-lead, qa-lead" />
              </Form.Item>
            </Form>
          </Modal>

          {/* Create Hotfix Channel Modal */}
          <Modal
            title="创建 Hotfix 通道"
            open={hfModalVisible}
            onCancel={() => setHfModalVisible(false)}
            onOk={handleCreateHF}
            confirmLoading={submitting}
          >
            <Form form={hfForm} layout="vertical">
              <Form.Item name="hfName" label="名称" rules={[{ required: true }]}>
                <Input placeholder="如: Production Hotfix" />
              </Form.Item>
              <Form.Item name="hfBranchPattern" label="分支匹配模式">
                <Input placeholder="^hotfix/.*$" defaultValue="^hotfix/.*$" />
              </Form.Item>
              <Form.Item name="hfEnabled" label="启用" valuePropName="checked">
                <Switch defaultChecked />
              </Form.Item>
              <Form.Item name="hfApprovalRequired" label="需要审批" valuePropName="checked">
                <Switch defaultChecked />
              </Form.Item>
              <Form.Item name="hfApprovalTimeout" label="审批超时 (分钟)">
                <Input type="number" defaultValue={30} />
              </Form.Item>
              <Form.Item name="hfAutoMerge" label="自动合并" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="hfNotifyOnCall" label="通知值班" valuePropName="checked">
                <Switch defaultChecked />
              </Form.Item>
              <Form.Item name="hfMaxDuration" label="最大持续时间 (分钟)">
                <Input type="number" defaultValue={60} />
              </Form.Item>
            </Form>
          </Modal>
        </>
      )}
    </div>
  );
};

export default ProductLineManagement;
