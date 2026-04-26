/**
 * Artifact Management Page (M29)
 * List, create, view details, promote, tag management, deprecate/quarantine
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography, Button, Space, Tag, Card, Modal, Form, Input, Select, message,
  Popconfirm, Tabs, Descriptions, Drawer, Tooltip, Statistic, Row, Col, Timeline,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  DownloadOutlined, TagOutlined, RocketOutlined, StopOutlined,
  SafetyCertificateOutlined, EyeOutlined,
  ClockCircleOutlined, FileTextOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getArtifacts, createArtifact, updateArtifact, deleteArtifact,
  getArtifactTags, addArtifactTags,
  promoteArtifact, getPromotionHistory,
  deprecateArtifact, quarantineArtifact,
  getArtifactStats, getNamespaces,
  type Artifact, type CreateArtifactInput, type UpdateArtifactInput,
  type ArtifactStage, type ArtifactStatus,
  type PromotionRecord, type Tag as TagType, type ArtifactStats,
} from '@/api/artifacts';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ---- Color maps ----

const stageColorMap: Record<ArtifactStage, string> = {
  snapshot: 'default',
  release_candidate: 'blue',
  stable: 'green',
  production: 'gold',
  archived: 'orange',
};

const stageLabelMap: Record<ArtifactStage, string> = {
  snapshot: 'Snapshot',
  release_candidate: 'RC',
  stable: 'Stable',
  production: 'Production',
  archived: 'Archived',
};

const statusColorMap: Record<ArtifactStatus, string> = {
  uploading: 'processing',
  available: 'success',
  deprecated: 'default',
  quarantined: 'error',
  deleted: 'default',
};

const typeLabelMap: Record<string, string> = {
  container_image: '容器镜像', base_image: '基础镜像', builder_image: '构建镜像',
  jar_artifact: 'JAR', war_artifact: 'WAR', npm_package: 'NPM', python_wheel: 'Python',
  go_module: 'Go', rust_crate: 'Rust', helm_chart: 'Helm Chart', terraform_module: 'Terraform',
  k8s_manifest: 'K8s Manifest', docker_compose: 'Docker Compose',
  test_report: '测试报告', coverage_report: '覆盖率报告', performance_report: '性能报告',
  sbom: 'SBOM', signature: '签名', security_scan_report: '安全扫描',
  api_doc: 'API 文档', changelog: '变更日志', release_notes: '发布说明',
};

// ---- Mock data ----

const MOCK_ARTIFACTS: Artifact[] = [
  {
    id: 'art-1', name: 'orion-core', namespace: 'platform', version: '2.5.0',
    type: 'container_image', stage: 'stable', status: 'available',
    displayName: 'Orion 核心服务镜像', description: 'Orion 核心平台 Docker 镜像',
    sizeBytes: 256000000, digest: 'sha256:abc123def456', storagePath: '/storage/images/orion-core',
    storageBackend: 'harbor', labels: { team: 'platform', tier: 'core' },
    build: { pipelineRunId: 'run-1', gitCommit: 'a1b2c3d', gitBranch: 'main', gitTag: 'v2.5.0', buildTime: '2024-03-20T10:00:00Z', buildDuration: 180 },
    security: { signed: true, signer: 'platform-signer', scanResults: { critical: 0, high: 1, medium: 3, low: 5 } },
    tests: { unitTests: { passed: 450, failed: 2, coverage: 87 }, integrationTests: { passed: 89, failed: 0 } },
    deployments: [{ environment: 'staging', deployedAt: '2024-03-20T12:00:00Z', deployedBy: 'ci-bot', status: 'success' }],
    createdAt: '2024-01-15T08:00:00Z', updatedAt: '2024-03-20T12:00:00Z',
  },
  {
    id: 'art-2', name: 'orion-ai-service', namespace: 'ai', version: '1.3.0-rc.1',
    type: 'container_image', stage: 'release_candidate', status: 'available',
    displayName: 'AI 服务镜像', description: 'AI 算法引擎 Docker 镜像',
    sizeBytes: 512000000, digest: 'sha256:def789ghi012', storagePath: '/storage/images/orion-ai',
    storageBackend: 'harbor', labels: { team: 'ai', tier: 'service' },
    build: { pipelineRunId: 'run-2', gitCommit: 'e4f5g6h', gitBranch: 'release/1.3', buildTime: '2024-03-19T14:00:00Z', buildDuration: 300 },
    security: { signed: true, scanResults: { critical: 0, high: 0, medium: 2, low: 8 } },
    createdAt: '2024-02-01T08:00:00Z', updatedAt: '2024-03-19T14:00:00Z',
  },
  {
    id: 'art-3', name: '@orion/sdk', namespace: 'frontend', version: '0.9.0',
    type: 'npm_package', stage: 'snapshot', status: 'available',
    displayName: 'Orion 前端 SDK', description: '前端微应用 SDK 包',
    sizeBytes: 1200000, digest: 'sha256:jkl345mno678', storagePath: '/storage/npm/orion-sdk',
    storageBackend: 'nexus', labels: { team: 'frontend' },
    createdAt: '2024-03-10T08:00:00Z', updatedAt: '2024-03-18T10:00:00Z',
  },
  {
    id: 'art-4', name: 'orion-platform-chart', namespace: 'infra', version: '3.0.0',
    type: 'helm_chart', stage: 'production', status: 'available',
    displayName: '平台 Helm Chart', description: 'Orion 平台 Helm 部署模板',
    sizeBytes: 500000, digest: 'sha256:pqr901stu234', storagePath: '/storage/helm/platform-chart',
    storageBackend: 'harbor', labels: { team: 'infra' },
    build: { pipelineRunId: 'run-3', gitCommit: 'i7j8k9l', gitBranch: 'main', gitTag: 'chart-v3.0.0', buildTime: '2024-03-15T09:00:00Z', buildDuration: 30 },
    security: { signed: true, scanResults: { critical: 0, high: 0, medium: 0, low: 2 } },
    createdAt: '2024-01-01T08:00:00Z', updatedAt: '2024-03-15T09:00:00Z',
  },
  {
    id: 'art-5', name: 'legacy-service', namespace: 'platform', version: '1.0.0',
    type: 'jar_artifact', stage: 'archived', status: 'deprecated',
    displayName: '遗留服务 JAR', description: '已废弃的旧版服务',
    sizeBytes: 45000000, digest: 'sha256:vwx567yza890', storagePath: '/storage/jars/legacy',
    storageBackend: 'nexus', createdAt: '2023-06-01T08:00:00Z', updatedAt: '2024-01-10T08:00:00Z',
  },
];

const MOCK_PROMOTION_HISTORY: PromotionRecord[] = [
  { id: 'p1', artifactId: 'art-1', fromStage: 'snapshot', toStage: 'release_candidate', promotedBy: 'dev-001', promotedAt: '2024-03-18T10:00:00Z', reason: 'CI 通过' },
  { id: 'p2', artifactId: 'art-1', fromStage: 'release_candidate', toStage: 'stable', promotedBy: 'tech-lead', approvedBy: 'qa-lead', promotedAt: '2024-03-19T14:00:00Z', reason: '测试通过，代码审查完成' },
];

const MOCK_TAGS: TagType[] = [
  { id: 't1', artifactId: 'art-1', name: 'stable-release', createdAt: '2024-03-20T12:00:00Z' },
  { id: 't2', artifactId: 'art-1', name: 'v2.5', createdAt: '2024-03-20T12:00:00Z' },
  { id: 't3', artifactId: 'art-1', name: 'deployed-to-staging', createdAt: '2024-03-20T12:00:00Z' },
];

const MOCK_STATS: ArtifactStats = {
  total: 5,
  byStage: { snapshot: 1, release_candidate: 1, stable: 1, production: 1, archived: 1 },
  byStatus: { uploading: 0, available: 4, deprecated: 1, quarantined: 0, deleted: 0 },
  byType: { container_image: 2, npm_package: 1, helm_chart: 1, jar_artifact: 1 },
  totalSizeBytes: 813700000,
  avgSecurityScore: 92,
};

const formatSize = (bytes: number): string => {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

const promotionStageOrder: ArtifactStage[] = ['snapshot', 'release_candidate', 'stable', 'production'];

// ---- Main Component ----

const ArtifactManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingArtifact, setEditingArtifact] = useState<Artifact | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [promotionModalVisible, setPromotionModalVisible] = useState(false);
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [stats, setStats] = useState<ArtifactStats | null>(null);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [promotionHistory, setPromotionHistory] = useState<PromotionRecord[]>([]);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [promotionForm] = Form.useForm();
  const [tagForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const typeOptions = useMemo(() => [
    { label: '全部', value: 'all' },
    ...Object.entries(typeLabelMap).slice(0, 8).map(([v, l]) => ({ label: l, value: v })),
  ], []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getArtifacts();
      setArtifacts(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setArtifacts(MOCK_ARTIFACTS);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await getArtifactStats();
      setStats(res.data?.data || MOCK_STATS);
    } catch {
      setStats(MOCK_STATS);
    }
  };

  const loadNamespaces = async () => {
    try {
      const res = await getNamespaces();
      setNamespaces(res.data?.data || []);
    } catch {
      setNamespaces(['platform', 'ai', 'frontend', 'infra']);
    }
  };

  useEffect(() => { loadData(); loadStats(); loadNamespaces(); }, []);

  const filteredData = useMemo(() => {
    return artifacts.filter((a) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!a.name.toLowerCase().includes(q) && !(a.displayName && a.displayName.toLowerCase().includes(q)) && !(a.description && a.description.toLowerCase().includes(q))) return false;
      }
      if (filters.type && filters.type !== 'all' && a.type !== filters.type) return false;
      if (filters.stage && filters.stage !== 'all' && a.stage !== filters.stage) return false;
      if (filters.status && filters.status !== 'all' && a.status !== filters.status) return false;
      if (filters.namespace && filters.namespace !== 'all' && a.namespace !== filters.namespace) return false;
      return true;
    });
  }, [searchQuery, filters, artifacts]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload: CreateArtifactInput = {
        name: values.name,
        namespace: values.namespace,
        version: values.version,
        type: values.type,
        displayName: values.displayName,
        description: values.description,
        storagePath: values.storagePath,
        storageBackend: values.storageBackend || 'local',
        sizeBytes: 0,
        labels: values.labels ? Object.fromEntries(values.labels.split(',').map((s: string) => s.split(':').map((x: string) => x.trim()))) : undefined,
      };
      await createArtifact(payload);
      message.success('制品创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
      loadStats();
    } catch {
      message.error('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingArtifact) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      const payload: UpdateArtifactInput = {
        displayName: values.displayName,
        description: values.description,
        retentionDays: values.retentionDays ? parseInt(values.retentionDays) : undefined,
      };
      await updateArtifact(editingArtifact.id, payload);
      message.success('制品更新成功');
      setEditModalVisible(false);
      loadData();
    } catch {
      message.error('更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteArtifact(id);
      message.success('制品已删除');
      loadData();
      loadStats();
    } catch {
      message.error('删除失败');
    }
  };

  const handleDeprecate = async (id: string) => {
    try {
      await deprecateArtifact(id);
      message.success('制品已废弃');
      loadData();
    } catch {
      message.error('废弃失败');
    }
  };

  const handleQuarantine = async (id: string) => {
    try {
      await quarantineArtifact(id);
      message.success('制品已隔离');
      loadData();
    } catch {
      message.error('隔离失败');
    }
  };

  const handlePromote = async () => {
    if (!selectedArtifact) return;
    try {
      const values = await promotionForm.validateFields();
      setSubmitting(true);
      const payload: { promotedBy: string; approvedBy?: string; reason?: string } = {
        promotedBy: values.promotedBy || 'current-user',
        reason: values.reason,
      };
      if (values.approvedBy) payload.approvedBy = values.approvedBy;
      await promoteArtifact(selectedArtifact.id, payload);
      message.success('制品晋升成功');
      setPromotionModalVisible(false);
      promotionForm.resetFields();
      loadData();
      loadStats();
    } catch {
      message.error('晋升失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTags = async () => {
    if (!selectedArtifact) return;
    try {
      const values = await tagForm.validateFields();
      setSubmitting(true);
      const tagList = values.tags.split(',').map((s: string) => s.trim()).filter(Boolean);
      await addArtifactTags(selectedArtifact.id, tagList);
      message.success('标签添加成功');
      setTagModalVisible(false);
      tagForm.resetFields();
      loadTags(selectedArtifact.id);
    } catch {
      message.error('添加标签失败');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (a: Artifact) => {
    setEditingArtifact(a);
    editForm.setFieldsValue({
      displayName: a.displayName,
      description: a.description,
      retentionDays: a.retentionDays,
    });
    setEditModalVisible(true);
  };

  const openDetail = async (a: Artifact) => {
    setSelectedArtifact(a);
    setDetailDrawerVisible(true);
    loadTags(a.id);
    loadPromotionHistory(a.id);
    loadDownloadHistory();
  };

  const openPromotion = (a: Artifact) => {
    setSelectedArtifact(a);
    promotionForm.setFieldsValue({ promotedBy: 'current-user' });
    setPromotionModalVisible(true);
  };

  const openTagModal = (a: Artifact) => {
    setSelectedArtifact(a);
    setTagModalVisible(true);
  };

  const loadTags = async (id: string) => {
    try {
      const res = await getArtifactTags(id);
      setTags(Array.isArray(res.data?.data) ? res.data.data : MOCK_TAGS.filter((t) => t.artifactId === id));
    } catch {
      setTags(MOCK_TAGS.filter((t) => t.artifactId === id));
    }
  };

  const loadPromotionHistory = async (id: string) => {
    try {
      const res = await getPromotionHistory(id);
      setPromotionHistory(Array.isArray(res.data?.data) ? res.data.data : MOCK_PROMOTION_HISTORY.filter((p) => p.artifactId === id));
    } catch {
      setPromotionHistory(MOCK_PROMOTION_HISTORY.filter((p) => p.artifactId === id));
    }
  };

  const loadDownloadHistory = async () => {
    // Backend API not yet returning download records
  };

  const nextAvailableStage = (currentStage: ArtifactStage): ArtifactStage | null => {
    const idx = promotionStageOrder.indexOf(currentStage);
    if (idx < 0 || idx >= promotionStageOrder.length - 1) return null;
    return promotionStageOrder[idx + 1];
  };

  // ---- Table columns ----

  const columns: TableColumn<Artifact>[] = [
    {
      key: 'name', title: '制品名称', dataIndex: 'name', width: 200, sortable: true,
      render: (v: unknown, record: Artifact) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>{String(v)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.displayName || record.namespace}/{record.version}</Text>
        </Space>
      ),
    },
    {
      key: 'type', title: '类型', width: 120,
      render: (_: unknown, record: Artifact) => <Tag>{typeLabelMap[record.type] || record.type}</Tag>,
    },
    {
      key: 'stage', title: '阶段', width: 110,
      render: (_: unknown, record: Artifact) => (
        <Tag color={stageColorMap[record.stage as ArtifactStage] || 'default'}>
          {stageLabelMap[record.stage as ArtifactStage] || record.stage}
        </Tag>
      ),
    },
    {
      key: 'status', title: '状态', width: 100,
      render: (_: unknown, record: Artifact) => (
        <Tag color={statusColorMap[record.status as ArtifactStatus] || 'default'}>{record.status}</Tag>
      ),
    },
    {
      key: 'size', title: '大小', width: 90,
      render: (_: unknown, record: Artifact) => <Text type="secondary" style={{ fontSize: 12 }}>{formatSize(record.sizeBytes || 0)}</Text>,
    },
    {
      key: 'security', title: '安全评分', width: 100,
      render: (_: unknown, record: Artifact) => {
        const scan = record.security?.scanResults;
        if (!scan) return <Text type="secondary">-</Text>;
        const total = scan.critical + scan.high + scan.medium + scan.low;
        const score = total === 0 ? 100 : Math.max(0, 100 - scan.critical * 20 - scan.high * 10 - scan.medium * 3 - scan.low * 1);
        return (
          <Tag color={score >= 90 ? 'green' : score >= 70 ? 'orange' : 'red'}>
            <SafetyCertificateOutlined /> {score}
          </Tag>
        );
      },
    },
    {
      key: 'updatedAt', title: '更新时间', dataIndex: 'updatedAt', width: 140, sortable: true,
      render: (v: unknown) => <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(String(v)).fromNow()}</Text>,
    },
    {
      key: 'actions', title: '操作', width: 260,
      render: (_: unknown, record: Artifact) => (
        <Space size="small" wrap>
          <Tooltip title="详情"><Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>详情</Button></Tooltip>
          <Tooltip title="编辑"><Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} /></Tooltip>
          {record.status === 'available' && nextAvailableStage(record.stage) && (
            <Tooltip title={`晋升到 ${stageLabelMap[nextAvailableStage(record.stage)!]}`}><Button type="link" size="small" icon={<RocketOutlined />} onClick={() => openPromotion(record)} /></Tooltip>
          )}
          {record.status === 'available' && (
            <Tooltip title="管理标签"><Button type="link" size="small" icon={<TagOutlined />} onClick={() => openTagModal(record)} /></Tooltip>
          )}
          <Tooltip title="下载"><Button type="link" size="small" icon={<DownloadOutlined />} /></Tooltip>
          {record.status === 'available' && (
            <>
              <Tooltip title="废弃"><Popconfirm title="确认废弃该制品?" onConfirm={() => handleDeprecate(record.id)}><Button type="link" size="small" danger icon={<StopOutlined />} /></Popconfirm></Tooltip>
              <Tooltip title="隔离"><Popconfirm title="确认隔离该制品?" onConfirm={() => handleQuarantine(record.id)}><Button type="link" size="small" danger icon={<StopOutlined />}>隔离</Button></Popconfirm></Tooltip>
            </>
          )}
          <Tooltip title="删除"><Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}><Button type="link" size="small" danger icon={<DeleteOutlined />} /></Popconfirm></Tooltip>
        </Space>
      ),
    },
  ];

  const namespaceOptions = useMemo(() => [
    { label: '全部', value: 'all' },
    ...namespaces.map((n) => ({ label: n, value: n })),
  ], [namespaces]);

  const filterDefs: FilterDefinition[] = [
    { key: 'namespace', label: '命名空间', options: namespaceOptions },
    { key: 'type', label: '类型', options: typeOptions },
    { key: 'stage', label: '阶段', options: [
      { label: '全部', value: 'all' },
      { label: 'Snapshot', value: 'snapshot' },
      { label: 'RC', value: 'release_candidate' },
      { label: 'Stable', value: 'stable' },
      { label: 'Production', value: 'production' },
      { label: 'Archived', value: 'archived' },
    ]},
    { key: 'status', label: '状态', options: [
      { label: '全部', value: 'all' },
      { label: 'Available', value: 'available' },
      { label: 'Deprecated', value: 'deprecated' },
      { label: 'Quarantined', value: 'quarantined' },
      { label: 'Uploading', value: 'uploading' },
    ]},
  ];

  // ---- Detail Drawer Tabs ----

  const detailTabItems = useMemo(() => {
    if (!selectedArtifact) return [];
    const a = selectedArtifact;
    return [
      {
        key: 'info', label: '基本信息',
        children: (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="名称">{a.name}</Descriptions.Item>
            <Descriptions.Item label="版本">{a.version}</Descriptions.Item>
            <Descriptions.Item label="显示名称">{a.displayName || '-'}</Descriptions.Item>
            <Descriptions.Item label="命名空间">{a.namespace}</Descriptions.Item>
            <Descriptions.Item label="类型">{typeLabelMap[a.type] || a.type}</Descriptions.Item>
            <Descriptions.Item label="阶段"><Tag color={stageColorMap[a.stage]}>{stageLabelMap[a.stage]}</Tag></Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={statusColorMap[a.status]}>{a.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="大小">{formatSize(a.sizeBytes)}</Descriptions.Item>
            <Descriptions.Item label="Digest"><Text code style={{ fontSize: 11 }}>{a.digest || '-'}</Text></Descriptions.Item>
            <Descriptions.Item label="存储后端">{a.storageBackend || '-'}</Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>{a.description || '-'}</Descriptions.Item>
            {a.labels && (
              <Descriptions.Item label="标签" span={2}>
                <Space wrap>{Object.entries(a.labels).map(([k, v]) => <Tag key={k}>{k}: {String(v)}</Tag>)}</Space>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="创建时间">{dayjs(a.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{dayjs(a.updatedAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
          </Descriptions>
        ),
      },
      {
        key: 'security', label: '安全扫描',
        children: a.security ? (
          <div>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="已签名">{a.security.signed ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag>}</Descriptions.Item>
              <Descriptions.Item label="签名者">{a.security.signer || '-'}</Descriptions.Item>
            </Descriptions>
            {a.security.scanResults && (
              <>
                <Title level={5}>漏洞统计</Title>
                <Row gutter={16}>
                  <Col span={6}><Card size="small"><Statistic title="严重" value={a.security.scanResults.critical} valueStyle={{ color: a.security.scanResults.critical > 0 ? '#cf1322' : '#3f8600' }} /></Card></Col>
                  <Col span={6}><Card size="small"><Statistic title="高危" value={a.security.scanResults.high} valueStyle={{ color: a.security.scanResults.high > 0 ? '#fa541c' : '#3f8600' }} /></Card></Col>
                  <Col span={6}><Card size="small"><Statistic title="中危" value={a.security.scanResults.medium} valueStyle={{ color: a.security.scanResults.medium > 0 ? '#faad14' : '#3f8600' }} /></Card></Col>
                  <Col span={6}><Card size="small"><Statistic title="低危" value={a.security.scanResults.low} valueStyle={{ color: '#666' }} /></Card></Col>
                </Row>
              </>
            )}
          </div>
        ) : <Text type="secondary">暂无安全扫描数据</Text>,
      },
      {
        key: 'tests', label: '测试结果',
        children: a.tests ? (
          <div>
            {a.tests.unitTests && (
              <Descriptions column={2} bordered size="small" title="单元测试" style={{ marginBottom: 16 }}>
                <Descriptions.Item label="通过">{a.tests.unitTests.passed}</Descriptions.Item>
                <Descriptions.Item label="失败">{a.tests.unitTests.failed}</Descriptions.Item>
                <Descriptions.Item label="覆盖率">{a.tests.unitTests.coverage ? `${a.tests.unitTests.coverage}%` : '-'}</Descriptions.Item>
              </Descriptions>
            )}
            {a.tests.integrationTests && (
              <Descriptions column={2} bordered size="small" title="集成测试" style={{ marginBottom: 16 }}>
                <Descriptions.Item label="通过">{a.tests.integrationTests.passed}</Descriptions.Item>
                <Descriptions.Item label="失败">{a.tests.integrationTests.failed}</Descriptions.Item>
              </Descriptions>
            )}
          </div>
        ) : <Text type="secondary">暂无测试数据</Text>,
      },
      {
        key: 'deployments', label: '部署历史',
        children: a.deployments && a.deployments.length > 0 ? (
          <Timeline items={a.deployments.map((d) => ({
            children: (
              <Space direction="vertical" size={0}>
                <Text strong>{d.environment}</Text>
                <Text type="secondary">
                  <Tag color={d.status === 'success' ? 'green' : d.status === 'failed' ? 'red' : 'orange'}>{d.status}</Tag>
                  {dayjs(d.deployedAt).format('YYYY-MM-DD HH:mm:ss')} by {d.deployedBy}
                </Text>
              </Space>
            ),
          }))} />
        ) : <Text type="secondary">暂无部署记录</Text>,
      },
      {
        key: 'tags', label: '标签',
        children: (
          <div>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">管理制品标签</Text>
              <Button type="primary" size="small" icon={<TagOutlined />} onClick={() => openTagModal(a)}>添加标签</Button>
            </div>
            <Space wrap>
              {tags.length > 0 ? tags.map((t) => (
                <Tag key={t.id} closable>{t.name}</Tag>
              )) : <Text type="secondary">暂无标签</Text>}
            </Space>
          </div>
        ),
      },
      {
        key: 'promotion', label: '晋升历史',
        children: promotionHistory.length > 0 ? (
          <Timeline items={promotionHistory.map((p) => ({
            color: stageColorMap[p.toStage] || 'blue',
            children: (
              <Space direction="vertical" size={0}>
                <Text strong>
                  <Tag color={stageColorMap[p.fromStage]}>{stageLabelMap[p.fromStage]}</Tag>
                  {' -> '}
                  <Tag color={stageColorMap[p.toStage]}>{stageLabelMap[p.toStage]}</Tag>
                </Text>
                <Text type="secondary">
                  {dayjs(p.promotedAt).format('YYYY-MM-DD HH:mm:ss')} by {p.promotedBy}
                  {p.approvedBy && ` (审批: ${p.approvedBy})`}
                </Text>
                {p.reason && <Text type="secondary">{p.reason}</Text>}
              </Space>
            ),
          }))} />
        ) : <Text type="secondary">暂无晋升记录</Text>,
      },
    ];
  }, [selectedArtifact, tags, promotionHistory]);

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>制品管理</Title>
          <Text type="secondary">管理制品仓库、生命周期晋升、标签和安全扫描</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { loadData(); loadStats(); }} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>创建制品</Button>
        </Space>
      </div>

      {/* Stats Panel */}
      {stats && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={4}>
              <Statistic title="制品总数" value={stats.total} prefix={<FileTextOutlined />} />
            </Col>
            <Col span={3}>
              <Statistic title="Snapshot" value={stats.byStage?.snapshot ?? 0} valueStyle={{ color: '#999', fontSize: 20 }} />
            </Col>
            <Col span={3}>
              <Statistic title="RC" value={stats.byStage?.release_candidate ?? 0} valueStyle={{ color: '#1890ff', fontSize: 20 }} />
            </Col>
            <Col span={3}>
              <Statistic title="Stable" value={stats.byStage?.stable ?? 0} valueStyle={{ color: '#52c41a', fontSize: 20 }} />
            </Col>
            <Col span={3}>
              <Statistic title="Production" value={stats.byStage?.production ?? 0} valueStyle={{ color: '#faad14', fontSize: 20 }} />
            </Col>
            <Col span={3}>
              <Statistic title="Archived" value={stats.byStage?.archived ?? 0} valueStyle={{ color: '#fa8c16', fontSize: 20 }} />
            </Col>
            <Col span={3}>
              <Statistic title="总大小" value={formatSize(stats.totalSizeBytes || 0)} valueStyle={{ fontSize: 16 }} prefix={<ClockCircleOutlined />} />
            </Col>
          </Row>
        </Card>
      )}

      {/* Artifact List */}
      <Card>
        <div style={{ marginBottom: 16 }}>
          <SearchFilterBar onSearch={setSearchQuery} onFilter={setFilters} filters={filterDefs} searchPlaceholder="搜索制品..." />
        </div>
        <Table columns={columns} dataSource={filteredData} loading={loading} rowKey="id" size="middle" striped />
      </Card>

      {/* Create Modal */}
      <Modal
        title="创建制品" open={createModalVisible} onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate} confirmLoading={submitting} width={640} destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="名称 (唯一标识)" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如: orion-core" />
          </Form.Item>
          <Form.Item name="namespace" label="命名空间" rules={[{ required: true, message: '请选择命名空间' }]}>
            <Select options={namespaces.map((n) => ({ label: n, value: n }))} placeholder="选择命名空间" />
          </Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true, message: '请输入版本号' }]}>
            <Input placeholder="如: 1.0.0" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select options={Object.entries(typeLabelMap).map(([v, l]) => ({ label: l, value: v }))} />
          </Form.Item>
          <Form.Item name="displayName" label="显示名称">
            <Input placeholder="制品显示名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="制品描述..." />
          </Form.Item>
          <Form.Item name="storagePath" label="存储路径">
            <Input placeholder="/storage/path" />
          </Form.Item>
          <Form.Item name="storageBackend" label="存储后端">
            <Select options={[
              { label: 'Local', value: 'local' },
              { label: 'Harbor', value: 'harbor' },
              { label: 'Nexus', value: 'nexus' },
              { label: 'S3', value: 's3' },
            ]} />
          </Form.Item>
          <Form.Item name="labels" label="标签 (key:value, 逗号分隔)">
            <Input placeholder="team:platform, tier:core" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑制品" open={editModalVisible} onCancel={() => setEditModalVisible(false)}
        onOk={handleEdit} confirmLoading={submitting} width={640} destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="displayName" label="显示名称">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="retentionDays" label="保留天数">
            <Input type="number" placeholder="如: 90" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Promotion Modal */}
      <Modal
        title="制品晋升" open={promotionModalVisible} onCancel={() => setPromotionModalVisible(false)}
        onOk={handlePromote} confirmLoading={submitting} width={480}
      >
        {selectedArtifact && (
          <div style={{ marginBottom: 16 }}>
            <Text>当前制品: <Text strong>{selectedArtifact.name}</Text> ({selectedArtifact.version})</Text>
            <br />
            <Text>当前阶段: <Tag color={stageColorMap[selectedArtifact.stage]}>{stageLabelMap[selectedArtifact.stage]}</Tag></Text>
            {nextAvailableStage(selectedArtifact.stage) && (
              <>
                <br />
                <Text>目标阶段: <Tag color={stageColorMap[nextAvailableStage(selectedArtifact.stage)!]}>{stageLabelMap[nextAvailableStage(selectedArtifact.stage)!]}</Tag></Text>
              </>
            )}
          </div>
        )}
        <Form form={promotionForm} layout="vertical">
          <Form.Item name="promotedBy" label="操作人" rules={[{ required: true }]}>
            <Input placeholder="用户名" />
          </Form.Item>
          <Form.Item name="approvedBy" label="审批人 (可选)">
            <Input placeholder="审批人用户名" />
          </Form.Item>
          <Form.Item name="reason" label="晋升原因">
            <Input.TextArea rows={2} placeholder="晋升原因..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Tag Modal */}
      <Modal
        title="添加标签" open={tagModalVisible} onCancel={() => setTagModalVisible(false)}
        onOk={handleAddTags} confirmLoading={submitting}
      >
        <Form form={tagForm} layout="vertical">
          <Form.Item name="tags" label="标签 (逗号分隔)" rules={[{ required: true }]}>
            <Input placeholder="如: stable, v2.5, production-ready" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={selectedArtifact ? `${selectedArtifact.displayName || selectedArtifact.name} (${selectedArtifact.version})` : '制品详情'}
        open={detailDrawerVisible} onClose={() => setDetailDrawerVisible(false)} width={800} destroyOnClose
      >
        <Tabs items={detailTabItems} />
      </Drawer>
    </div>
  );
};

export default ArtifactManagement;
