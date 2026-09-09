/**
 * 分支画像 (Branch Profile List)
 * 后端: /api/v1/branch-policy/branch-profiles — 分支画像、语义化分支管理
 *
 * 功能:
 * - 分支画像列表（表格 + 语义筛选 + 状态看板）
 * - 状态筛选：全部 / active / archived / retired
 * - 语义筛选：main / release / hotfix / lts / customer-custom
 * - 卡片视图：每个分支的当前部署环境、最近构建、负责人
 * - 创建表单：语义、名称、负责人、LTS 截止日期、Merge 目标/来源、保护环境
 * - 详情页：分支画像 + 关联 BuildArtifacts + 关联 DeployEvents + 关联 SyncPolicies
 *
 * 设计文档: docs/multi-branch-strategy-design-v2-impl-2026-09-08.md §1.5
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ApartmentOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import {
  BranchProfile,
  BranchSemantic,
  BranchStatus,
  BuildArtifact,
  DeployEvent,
  EnvName,
  SyncPolicy,
  activateBranchProfile,
  archiveBranchProfile,
  createBranchProfile,
  getBranchProfile,
  getBranchProfiles,
  getBuildArtifacts,
  getDeployEventsByBranch,
  getSyncPolicies,
} from '@/api/branch-policy';

const { Text, Title } = Typography;

const SEMANTIC_OPTIONS: { label: string; value: BranchSemantic }[] = [
  { label: 'main（主干）', value: 'main' },
  { label: 'release（发布）', value: 'release' },
  { label: 'hotfix（热修复）', value: 'hotfix' },
  { label: 'lts（长期支持）', value: 'lts' },
  { label: 'customer-custom（客户定制）', value: 'customer-custom' },
];

const STATUS_OPTIONS: { label: string; value: BranchStatus }[] = [
  { label: 'active（启用）', value: 'active' },
  { label: 'archived（归档）', value: 'archived' },
  { label: 'retired（停用）', value: 'retired' },
];

const ENV_ORDER: EnvName[] = ['dev', 'staging', 'prod'];

const STATUS_COLORS: Record<BranchStatus, string> = {
  active: 'green',
  archived: 'orange',
  retired: 'default',
};

const SEMANTIC_COLORS: Record<BranchSemantic, string> = {
  main: 'blue',
  release: 'purple',
  hotfix: 'volcano',
  lts: 'cyan',
  'customer-custom': 'gold',
};

interface DetailState {
  profile: BranchProfile | null;
  artifacts: BuildArtifact[];
  deployEvents: DeployEvent[];
  syncPolicies: SyncPolicy[];
  loading: boolean;
}

const BranchProfileList = () => {
  const [profiles, setProfiles] = useState<BranchProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<BranchStatus | 'all'>('all');
  const [semanticFilter, setSemanticFilter] = useState<BranchSemantic | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<DetailState>({
    profile: null,
    artifacts: [],
    deployEvents: [],
    syncPolicies: [],
    loading: false,
  });
  const [form] = Form.useForm();

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBranchProfiles({
        status: statusFilter === 'all' ? undefined : statusFilter,
        semantic: semanticFilter === 'all' ? undefined : semanticFilter,
      });
      setProfiles((res.data ?? []) as unknown as BranchProfile[]);
    } catch {
      message.error('加载分支画像列表失败');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, semanticFilter]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const stats = useMemo(
    () => ({
      total: profiles.length,
      active: profiles.filter((p) => p.status === 'active').length,
      archived: profiles.filter((p) => p.status === 'archived').length,
      retired: profiles.filter((p) => p.status === 'retired').length,
      lts: profiles.filter((p) => p.semantic === 'lts').length,
    }),
    [profiles]
  );

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);
      const payload = {
        name: values.name,
        semantic: values.semantic as BranchSemantic,
        ownerId: values.ownerId,
        ownerName: values.ownerName,
        description: values.description,
        ltsUntil: values.ltsUntil ? values.ltsUntil.format('YYYY-MM-DD') : undefined,
        mergeTargets: values.mergeTargets ?? [],
        mergeSources: values.mergeSources ?? [],
        protectedEnvs: values.protectedEnvs ?? [],
      };
      await createBranchProfile(payload);
      message.success('分支画像创建成功');
      setCreateOpen(false);
      form.resetFields();
      fetchProfiles();
    } catch (err) {
      if (err instanceof Error) message.error(`创建失败: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (id: string, name: string) => {
    try {
      await archiveBranchProfile(id);
      message.success(`分支画像 ${name} 已归档`);
      fetchProfiles();
    } catch {
      message.error('归档失败');
    }
  };

  const handleActivate = async (id: string, name: string) => {
    try {
      await activateBranchProfile(id);
      message.success(`分支画像 ${name} 已激活`);
      fetchProfiles();
    } catch {
      message.error('激活失败');
    }
  };

  const handleViewDetail = async (id: string) => {
    setDetail({ profile: null, artifacts: [], deployEvents: [], syncPolicies: [], loading: true });
    try {
      const [profileRes, artifactsRes, deployRes, syncRes] = await Promise.all([
        getBranchProfile(id),
        getBuildArtifacts({ branchProfileId: id, limit: 10 }),
        getDeployEventsByBranch('__all__'),
        getSyncPolicies(),
      ]);
      const profile = profileRes.data as unknown as BranchProfile;
      const artifacts = (artifactsRes.data ?? []) as unknown as BuildArtifact[];
      const deployEvents = ((deployRes.data ?? []) as unknown as DeployEvent[]).filter(
        (e) => profile && e.branch === profile.name
      );
      const syncPolicies = ((syncRes.data ?? []) as unknown as SyncPolicy[]).filter(
        (p) => profile && (p.sourceBranch === profile.name || p.targetBranches?.includes(profile.name))
      );
      setDetail({ profile, artifacts, deployEvents, syncPolicies, loading: false });
    } catch {
      message.error('加载分支画像详情失败');
      setDetail({ profile: null, artifacts: [], deployEvents: [], syncPolicies: [], loading: false });
    }
  };

  const columns = useMemo(
    () => [
      {
        title: '分支',
        dataIndex: 'name',
        key: 'name',
        render: (name: string, record: BranchProfile) => (
          <Space direction="vertical" size={0}>
            <Text strong>{name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          </Space>
        ),
      },
      {
        title: '语义',
        dataIndex: 'semantic',
        key: 'semantic',
        width: 140,
        render: (semantic: BranchSemantic) => <Tag color={SEMANTIC_COLORS[semantic]}>{semantic}</Tag>,
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (status: BranchStatus) => <Tag color={STATUS_COLORS[status]}>{status}</Tag>,
      },
      {
        title: '负责人',
        key: 'owner',
        width: 150,
        render: (_: unknown, record: BranchProfile) => record.ownerName || record.ownerId,
      },
      {
        title: 'Merge 目标',
        dataIndex: 'mergeTargets',
        key: 'mergeTargets',
        width: 200,
        render: (targets: string[]) =>
          targets?.length ? (
            <Space size={4} wrap>
              {targets.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </Space>
          ) : (
            <Text type="secondary">—</Text>
          ),
      },
      {
        title: '保护环境',
        dataIndex: 'protectedEnvs',
        key: 'protectedEnvs',
        width: 160,
        render: (envs: string[]) =>
          envs?.length ? (
            <Space size={4} wrap>
              {envs.map((e) => (
                <Tag color="red" key={e}>
                  {e}
                </Tag>
              ))}
            </Space>
          ) : (
            <Text type="secondary">—</Text>
          ),
      },
      {
        title: 'LTS 截止',
        dataIndex: 'ltsUntil',
        key: 'ltsUntil',
        width: 120,
        render: (until: string | null) =>
          until ? <Tag color="cyan">{until}</Tag> : <Text type="secondary">—</Text>,
      },
      {
        title: '操作',
        key: 'actions',
        width: 170,
        render: (_: unknown, record: BranchProfile) => (
          <Space>
            <Button type="link" size="small" onClick={() => handleViewDetail(record.id)}>
              详情
            </Button>
            {record.status === 'active' ? (
              <Popconfirm
                title="归档该分支画像？"
                description="归档后该分支将拒绝新部署"
                onConfirm={() => handleArchive(record.id, record.name)}
              >
                <Button type="link" size="small" danger>
                  归档
                </Button>
              </Popconfirm>
            ) : (
              <Button type="link" size="small" onClick={() => handleActivate(record.id, record.name)}>
                激活
              </Button>
            )}
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profiles]
  );

  const renderStatCards = () => (
    <Row gutter={[spacing.md, spacing.md]}>
      {[
        { title: '分支总数', value: stats.total, color: '#3370E6', icon: <ApartmentOutlined /> },
        { title: '启用中', value: stats.active, color: '#52c41a', icon: <CheckCircleOutlined /> },
        { title: '已归档', value: stats.archived, color: '#faad14', icon: <ClockCircleOutlined /> },
        { title: '已停用', value: stats.retired, color: '#8c8c8c', icon: <StopOutlined /> },
        { title: 'LTS 分支', value: stats.lts, color: '#13c2c2', icon: <SafetyCertificateOutlined /> },
      ].map((s) => (
        <Col xs={12} sm={8} md={6} lg={4} key={s.title}>
          <Card size="small">
            <Statistic
              title={s.title}
              value={s.value}
              prefix={<span style={{ color: s.color, marginRight: 4 }}>{s.icon}</span>}
              valueStyle={{ color: s.color }}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );

  const renderFilters = () => (
    <Card size="small" style={{ marginBottom: spacing.md }}>
      <Space wrap>
        <Select
          style={{ width: 160 }}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          options={[
            { label: '全部状态', value: 'all' },
            ...STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
          ]}
        />
        <Select
          style={{ width: 200 }}
          value={semanticFilter}
          onChange={(v) => setSemanticFilter(v)}
          options={[
            { label: '全部语义', value: 'all' },
            ...SEMANTIC_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={fetchProfiles}>
          刷新
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          新建分支画像
        </Button>
      </Space>
    </Card>
  );

  const renderTableView = () => (
    <Card size="small">
      <Table<BranchProfile>
        rowKey="id"
        dataSource={profiles}
        columns={columns}
        loading={loading}
        pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        locale={{
          emptyText: (
            <Empty description="暂无分支画像，点击右上角「新建分支画像」创建" />
          ),
        }}
      />
    </Card>
  );

  const renderCardView = () => (
    <Row gutter={[spacing.md, spacing.md]}>
      {profiles.map((p) => {
        const deployedEnvs = ENV_ORDER.filter((env) => (p.protectedEnvs ?? []).includes(env));
        return (
          <Col xs={24} sm={12} lg={8} xl={6} key={p.id}>
            <Card
              size="small"
              hoverable
              onClick={() => handleViewDetail(p.id)}
              style={{ height: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Text strong>{p.name}</Text>
                  <Tag color={SEMANTIC_COLORS[p.semantic]}>{p.semantic}</Tag>
                </Space>
                <Space>
                  <Tag color={STATUS_COLORS[p.status]}>{p.status}</Tag>
                  {p.ltsUntil && <Tag color="cyan">LTS 至 {p.ltsUntil}</Tag>}
                </Space>
                <Space direction="vertical" size={0}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    负责人：{p.ownerName || p.ownerId}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    部署环境：{deployedEnvs.length ? deployedEnvs.join(' / ') : '未绑定'}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    最近构建：—
                  </Text>
                </Space>
              </Space>
            </Card>
          </Col>
        );
      })}
      {!loading && profiles.length === 0 && (
        <Col span={24}>
          <Empty description="暂无分支画像" />
        </Col>
      )}
    </Row>
  );

  const renderDetail = () => {
    const { profile, artifacts, deployEvents, syncPolicies, loading: detailLoading } = detail;
    if (!profile) {
      return detailLoading ? <PageSkeleton rows={6} /> : <Empty description="请选择分支画像查看详情" />;
    }
    return (
      <Space direction="vertical" style={{ width: '100%' }} size={spacing.md}>
        <Descriptions title="分支画像" column={2} size="small" bordered>
          <Descriptions.Item label="名称">{profile.name}</Descriptions.Item>
          <Descriptions.Item label="语义">
            <Tag color={SEMANTIC_COLORS[profile.semantic]}>{profile.semantic}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={STATUS_COLORS[profile.status]}>{profile.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="负责人">
            {profile.ownerName || profile.ownerId}
          </Descriptions.Item>
          <Descriptions.Item label="LTS 截止" span={2}>
            {profile.ltsUntil ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            {profile.description || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Merge 目标" span={2}>
            {profile.mergeTargets?.length ? profile.mergeTargets.join(', ') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Merge 来源" span={2}>
            {profile.mergeSources?.length ? profile.mergeSources.join(', ') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="保护环境" span={2}>
            {profile.protectedEnvs?.length ? profile.protectedEnvs.join(', ') : '—'}
          </Descriptions.Item>
        </Descriptions>

        <Card size="small" title={`关联制品 (${artifacts.length})`}>
          {artifacts.length ? (
            <Table<BuildArtifact>
              rowKey="id"
              size="small"
              dataSource={artifacts}
              pagination={false}
              columns={[
                { title: '分支', dataIndex: 'branch', key: 'branch' },
                { title: '提交', dataIndex: 'commitSha', key: 'commitSha', ellipsis: true },
                {
                  title: '镜像',
                  key: 'image',
                  ellipsis: true,
                  render: (_: unknown, r: BuildArtifact) =>
                    r.imageTag ? `${r.imageRepo}:${r.imageTag}` : r.imageDigest,
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  width: 100,
                  render: (s: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s}</Tag>,
                },
              ]}
            />
          ) : (
            <Empty description="暂无关联制品" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>

        <Card size="small" title={`关联部署事件 (${deployEvents.length})`}>
          {deployEvents.length ? (
            <Table<DeployEvent>
              rowKey="id"
              size="small"
              dataSource={deployEvents}
              pagination={false}
              columns={[
                { title: '环境', dataIndex: 'env', key: 'env', width: 90 },
                { title: '目标提交', dataIndex: 'toCommit', key: 'toCommit', ellipsis: true },
                {
                  title: '结果',
                  dataIndex: 'outcome',
                  key: 'outcome',
                  width: 110,
                  render: (o: string) => (
                    <Tag color={o === 'success' ? 'green' : o === 'rolled-back' ? 'orange' : 'red'}>{o}</Tag>
                  ),
                },
                {
                  title: '时间',
                  dataIndex: 'createdAt',
                  key: 'createdAt',
                  width: 170,
                  render: (t: string) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '—'),
                },
              ]}
            />
          ) : (
            <Empty description="暂无关联部署事件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>

        <Card size="small" title={`关联同步策略 (${syncPolicies.length})`}>
          {syncPolicies.length ? (
            <Table<SyncPolicy>
              rowKey="id"
              size="small"
              dataSource={syncPolicies}
              pagination={false}
              columns={[
                { title: '策略名', dataIndex: 'name', key: 'name' },
                { title: '源分支', dataIndex: 'sourceBranch', key: 'sourceBranch' },
                {
                  title: '目标分支',
                  dataIndex: 'targetBranches',
                  key: 'targetBranches',
                  render: (t: string[]) => (t?.length ? t.join(', ') : '—'),
                },
                {
                  title: '频率',
                  dataIndex: 'frequency',
                  key: 'frequency',
                  width: 100,
                  render: (f: string) => <Tag>{f}</Tag>,
                },
              ]}
            />
          ) : (
            <Empty description="暂无关联同步策略" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      </Space>
    );
  };

  return (
    <div style={{ padding: spacing.md }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <ApartmentOutlined style={{ marginRight: 12, color: '#3370E6' }} />
        分支画像
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        语义化分支管理：为每条分支定义语义（main/release/hotfix/lts/customer-custom）、Merge 规则与保护环境，
        支撑多分支并行发布与制品追踪。
      </Text>

      {renderStatCards()}
      <div style={{ marginTop: spacing.md }}>{renderFilters()}</div>

      <Tabs
        items={[
          { key: 'table', label: '表格视图', children: renderTableView() },
          { key: 'cards', label: '卡片视图', children: renderCardView() },
        ]}
      />

      {/* 创建分支画像 */}
      <Modal
        title="新建分支画像"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateOpen(false);
          form.resetFields();
        }}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
        width={640}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="语义"
            name="semantic"
            rules={[{ required: true, message: '请选择分支语义' }]}
          >
            <Select options={SEMANTIC_OPTIONS} placeholder="选择语义" />
          </Form.Item>
          <Form.Item
            label="分支名称"
            name="name"
            rules={[
              { required: true, message: '请输入分支名称' },
              { pattern: /^[a-z0-9][a-z0-9/._-]*$/, message: '仅支持小写字母、数字、/、_、-、.' },
            ]}
          >
            <Input placeholder="如 main、release/2026-09、hotfix/urgent-01" />
          </Form.Item>
          <Row gutter={spacing.md}>
            <Col span={12}>
              <Form.Item
                label="负责人 ID"
                name="ownerId"
                rules={[{ required: true, message: '请输入负责人 ID' }]}
              >
                <Input placeholder="用户 ID" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="负责人姓名" name="ownerName">
                <Input placeholder="选填" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} placeholder="选填" />
          </Form.Item>
          <Form.Item
            label="LTS 截止日期"
            name="ltsUntil"
            tooltip="语义为 lts 时必须指定"
            dependencies={['semantic']}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Row gutter={spacing.md}>
            <Col span={12}>
              <Form.Item label="Merge 目标分支" name="mergeTargets">
                <Select
                  mode="tags"
                  placeholder="可合并到的分支"
                  tokenSeparators={[',']}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Merge 来源分支" name="mergeSources">
                <Select mode="tags" placeholder="允许合入的分支" tokenSeparators={[',']} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="保护环境" name="protectedEnvs">
            <Select
              mode="multiple"
              placeholder="选择受保护环境"
              options={ENV_ORDER.map((e) => ({ label: e, value: e }))}
            />
          </Form.Item>
          {form.getFieldValue('semantic') === 'lts' && !form.getFieldValue('ltsUntil') && (
            <Alert type="warning" showIcon message="LTS 分支必须指定截止日期" style={{ marginBottom: 16 }} />
          )}
        </Form>
      </Modal>

      {/* 详情抽屉 */}
      <Drawer
        title={detail.profile ? `分支画像：${detail.profile.name}` : '分支画像详情'}
        open={!!detail.profile || detail.loading}
        onClose={() => setDetail({ profile: null, artifacts: [], deployEvents: [], syncPolicies: [], loading: false })}
        width={760}
      >
        {renderDetail()}
      </Drawer>
    </div>
  );
};

export default BranchProfileList;
