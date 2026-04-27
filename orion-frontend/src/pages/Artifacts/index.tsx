/**
 * Artifact Management Page (M29)
 * List, create, view details, promote, tag management, deprecate/quarantine
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography, Button, Space, Modal, Form, Input, Select, message, Alert,
  Tabs, Drawer, Tag, Card,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined,
} from '@ant-design/icons';
import SearchFilterBar from '@/components/SearchFilterBar';
import PageSkeleton from '@/components/PageSkeleton';
import {
  getArtifacts, createArtifact, updateArtifact, deleteArtifact,
  getArtifactTags, addArtifactTags, downloadArtifact,
  promoteArtifact, getPromotionHistory,
  deprecateArtifact, quarantineArtifact,
  getArtifactStats, getNamespaces,
  type Artifact, type CreateArtifactInput, type UpdateArtifactInput,
  type PromotionRecord, type Tag as TagType,
  type ArtifactStats as ArtifactStatsType,
} from '@/api/artifacts';
import ArtifactStats from './ArtifactStats';
import ArtifactTable from './ArtifactTable';
import { getArtifactTabItems } from './ArtifactDetail';
import { typeLabelMap, promotionStageOrder } from './constants';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

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
  const [stats, setStats] = useState<ArtifactStatsType | null>(null);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [promotionHistory, setPromotionHistory] = useState<PromotionRecord[]>([]);
  const [usingMockData, setUsingMockData] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [promotionForm] = Form.useForm();
  const [tagForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // ---- Server-side pagination state ----
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const typeOptions = useMemo(() => [
    { label: '全部', value: 'all' },
    ...Object.entries(typeLabelMap).slice(0, 8).map(([v, l]) => ({ label: l, value: v })),
  ], []);

  const loadData = async (page?: number, size?: number) => {
    const p = page ?? currentPage;
    const s = size ?? pageSize;
    setLoading(true);
    try {
      const res = await getArtifacts({ page: p, perPage: s });
      // Backend may return either { data: Artifact[], total: number } or just Artifact[]
      const raw = res.data?.data;
      if (Array.isArray(raw)) {
        setArtifacts(raw);
        // If response includes total count use it, otherwise estimate from mock data length
        const respTotal = (res.data as any)?.total ?? raw.length;
        setTotal(respTotal);
      } else {
        setArtifacts([]);
        setTotal(0);
      }
    } catch (error: unknown) {
      setUsingMockData(true);
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          message.error('权限不足，请重新登录或联系管理员');
        } else if (error.message.includes('fetch') || error.message.includes('network')) {
          message.error('网络异常，请检查连接');
        } else {
          message.error(`加载制品数据失败：${error.message}`);
        }
      } else {
        message.error('加载制品数据失败，请稍后重试');
      }
      // For mock data, apply client-side pagination slice
      setTotal(MOCK_ARTIFACTS.length);
      const start = (p - 1) * s;
      setArtifacts(MOCK_ARTIFACTS.slice(start, start + s));
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await getArtifactStats();
      setStats(res.data?.data || MOCK_STATS);
    } catch (error: unknown) {
      setUsingMockData(true);
      setStats(MOCK_STATS);
    }
  };

  const loadNamespaces = async () => {
    try {
      const res = await getNamespaces();
      setNamespaces(res.data?.data || []);
    } catch (error: unknown) {
      setUsingMockData(true);
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
      await deleteArtifact(id);
      message.success('制品已删除');
      loadData();
      loadStats();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败：${error.message}`);
      } else {
        message.error('删除失败');
      }
    }
  };

  const handleDeprecate = async (id: string) => {
    try {
      await deprecateArtifact(id);
      message.success('制品已废弃');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`废弃失败：${error.message}`);
      } else {
        message.error('废弃失败');
      }
    }
  };

  const handleQuarantine = async (id: string) => {
    try {
      await quarantineArtifact(id);
      message.success('制品已隔离');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`隔离失败：${error.message}`);
      } else {
        message.error('隔离失败');
      }
    }
  };

  const handleDownload = async (record: Artifact) => {
    try {
      const res = await downloadArtifact(record.id);
      const url = res.data?.data?.url;
      if (url) {
        window.open(url, '_blank');
        message.success('下载链接已打开');
      } else {
        message.warning('未获取到下载链接');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`下载失败：${error.message}`);
      } else {
        message.error('下载失败');
      }
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
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`晋升失败：${error.message}`);
        } else {
          message.error('晋升失败');
        }
      }
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
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`添加标签失败：${error.message}`);
        } else {
          message.error('添加标签失败');
        }
      }
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
    } catch (error: unknown) {
      setTags(MOCK_TAGS.filter((t) => t.artifactId === id));
    }
  };

  const loadPromotionHistory = async (id: string) => {
    try {
      const res = await getPromotionHistory(id);
      setPromotionHistory(Array.isArray(res.data?.data) ? res.data.data : MOCK_PROMOTION_HISTORY.filter((p) => p.artifactId === id));
    } catch (error: unknown) {
      setPromotionHistory(MOCK_PROMOTION_HISTORY.filter((p) => p.artifactId === id));
    }
  };

  const loadDownloadHistory = async () => {
    // Backend API not yet returning download records
  };

  const namespaceOptions = useMemo(() => [
    { label: '全部', value: 'all' },
    ...namespaces.map((n) => ({ label: n, value: n })),
  ], [namespaces]);

  const filterDefs = useMemo(() => [
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
  ], [namespaceOptions, typeOptions]);

  // ---- Detail Tabs ----

  const detailTabItems = useMemo(
    () => getArtifactTabItems(selectedArtifact, tags, promotionHistory, openTagModal),
    [selectedArtifact, tags, promotionHistory, openTagModal],
  );

  const isInitialLoading = loading && artifacts.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {/* Page loading skeleton (initial load) */}
      {isInitialLoading && <PageSkeleton cards={7} rows={8} />}

      {isInitialLoading ? null : (
        <>
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

      {/* Stats Panel */}
      {stats && <ArtifactStats stats={stats} />}

      {/* Artifact List */}
      <Card>
        <div style={{ marginBottom: 16 }}>
          <SearchFilterBar onSearch={setSearchQuery} onFilter={setFilters} filters={filterDefs} searchPlaceholder="搜索制品..." />
        </div>
        <ArtifactTable
          dataSource={filteredData}
          loading={loading}
          currentPage={currentPage}
          pageSize={pageSize}
          total={total}
          onDetail={openDetail}
          onEdit={openEdit}
          onPromote={openPromotion}
          onTag={openTagModal}
          onDownload={handleDownload}
          onDeprecate={handleDeprecate}
          onQuarantine={handleQuarantine}
          onDelete={handleDelete}
          onPaginationChange={(page, size) => {
            setCurrentPage(page);
            setPageSize(size);
            loadData(page, size);
          }}
        />
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
            <Text>当前阶段: <Tag color={selectedArtifact.stage}>{selectedArtifact.stage}</Tag></Text>
            {(() => {
              const idx = promotionStageOrder.indexOf(selectedArtifact.stage);
              if (idx < 0 || idx >= promotionStageOrder.length - 1) return null;
              const nextStage = promotionStageOrder[idx + 1];
              return (
                <>
                  <br />
                  <Text>目标阶段: <Tag color={nextStage}>{nextStage}</Tag></Text>
                </>
              );
            })()}
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
        </>
      )}
    </div>
  );
};

export default ArtifactManagement;
