/**
 * Artifact Page
 * Artifact list, storage stats, multi-architecture info
 * Simplified page using the Artifact Management API
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Table as AntTable,
  Input,
  Select,
  Tooltip,
  Progress,
  Drawer,
  Descriptions,
  message,
} from 'antd';
import {
  ReloadOutlined,
  EyeOutlined,
  DownloadOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getArtifacts,
  getArtifactStats,
  type Artifact,
  type ArtifactStats as ArtifactStatsType,
} from '@/api/artifacts';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ---- Type label map ----

const typeLabelMap: Record<string, string> = {
  container_image: '容器镜像',
  base_image: '基础镜像',
  jar_artifact: 'JAR',
  npm_package: 'NPM',
  helm_chart: 'Helm Chart',
  terraform_module: 'Terraform',
  k8s_manifest: 'K8s Manifest',
  sbom: 'SBOM',
  test_report: '测试报告',
};

const stageColorMap: Record<string, string> = {
  snapshot: 'default',
  release_candidate: 'blue',
  stable: 'green',
  production: 'red',
  archived: 'gold',
};

const stageLabelMap: Record<string, string> = {
  snapshot: '快照',
  release_candidate: 'RC',
  stable: '稳定',
  production: '生产',
  archived: '归档',
};

const statusColorMap: Record<string, string> = {
  available: 'green',
  uploading: 'blue',
  deprecated: 'default',
  quarantined: 'red',
  deleted: 'default',
};

const statusLabelMap: Record<string, string> = {
  available: '可用',
  uploading: '上传中',
  deprecated: '已废弃',
  quarantined: '已隔离',
  deleted: '已删除',
};

// ---- Format helpers ----

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

// ---- Stats Card Component ----

const StatsCard: React.FC<{
  title: string;
  value: number | string;
  icon: React.ReactNode;
  suffix?: string;
}> = ({ title, value, icon, suffix }) => (
  <Card size="small">
    <Statistic
      title={<Text type="secondary">{title}</Text>}
      value={value}
      suffix={suffix}
      prefix={icon}
    />
  </Card>
);

// ---- Main Component ----

const ArtifactPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [stats, setStats] = useState<ArtifactStatsType | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const loadData = async (page?: number, size?: number) => {
    const p = page ?? currentPage;
    const s = size ?? pageSize;
    setLoading(true);
    try {
      const res = await getArtifacts({ page: p, perPage: s });
      const raw = res.data?.data;
      if (Array.isArray(raw)) {
        setArtifacts(raw);
        const respTotal = (res.data as any)?.total ?? raw.length;
        setTotal(respTotal);
      } else {
        setArtifacts([]);
        setTotal(0);
      }
    } catch (error: unknown) {
      setArtifacts([]);
      setTotal(0);
      message.error(`加载制品列表失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await getArtifactStats();
      setStats(res.data?.data || null);
    } catch (error: unknown) {
      setStats(null);
    }
  };

  useEffect(() => {
    loadData();
    loadStats();
  }, []);

  const filteredData = useMemo(() => {
    return artifacts.filter((a) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !a.name.toLowerCase().includes(q) &&
          !(a.displayName && a.displayName.toLowerCase().includes(q)) &&
          !(a.description && a.description.toLowerCase().includes(q))
        )
          return false;
      }
      if (filters.type && filters.type !== 'all' && a.type !== filters.type) return false;
      if (filters.stage && filters.stage !== 'all' && a.stage !== filters.stage) return false;
      if (filters.status && filters.status !== 'all' && a.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, artifacts]);

  const openDetail = (a: Artifact) => {
    setSelectedArtifact(a);
    setDetailDrawerVisible(true);
  };

  // ---- Table columns ----

  const columns: ColumnsType<Artifact> = [
    {
      title: '制品名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (v: unknown, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>
            <DatabaseOutlined style={{ marginRight: 6 }} />
            {String(v)}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.displayName || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 100,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (v: string) => <Tag color="blue">{typeLabelMap[v] || v}</Tag>,
    },
    {
      title: '阶段',
      dataIndex: 'stage',
      key: 'stage',
      width: 100,
      render: (v: string) => (
        <Tag color={stageColorMap[v] || 'default'}>{stageLabelMap[v] || v}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => (
        <Tag color={statusColorMap[v] || 'default'}>{statusLabelMap[v] || v}</Tag>
      ),
    },
    {
      title: '大小',
      dataIndex: 'sizeBytes',
      key: 'sizeBytes',
      width: 100,
      render: (v: number) => <Text type="secondary">{formatSize(v)}</Text>,
    },
    {
      title: '命名空间',
      dataIndex: 'namespace',
      key: 'namespace',
      width: 140,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {v}
        </Text>
      ),
    },
    {
      title: '多架构',
      key: 'architectures',
      width: 140,
      render: (_, record) => {
        const archs = record.annotations?.['architectures']
          ? JSON.parse(record.annotations['architectures'])
          : ['amd64'];
        return (
          <Space wrap size={2}>
            {Array.isArray(archs) ? (
              archs.slice(0, 3).map((arch: string) => (
                <Tag key={arch} icon={<GlobalOutlined />}>
                  {arch}
                </Tag>
              ))
            ) : (
              <Tag icon={<GlobalOutlined />}>amd64</Tag>
            )}
            {Array.isArray(archs) && archs.length > 3 && <Tag>+{archs.length - 3}</Tag>}
          </Space>
        );
      },
    },
    {
      title: '安全评分',
      key: 'security',
      width: 100,
      render: (_, record) => {
        const score = record.security?.scanResults
          ? Math.max(
              0,
              100 -
                (record.security.scanResults.critical || 0) * 25 -
                (record.security.scanResults.high || 0) * 10 -
                (record.security.scanResults.medium || 0) * 5 -
                (record.security.scanResults.low || 0) * 1
            )
          : null;
        return score !== null ? (
          <Tooltip
            title={`Critical: ${record.security?.scanResults?.critical || 0}, High: ${record.security?.scanResults?.high || 0}`}
          >
            <Progress
              percent={Math.max(0, score)}
              size="small"
              status={score >= 80 ? 'success' : score >= 60 ? 'normal' : 'exception'}
              format={() => `${score}`}
            />
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(v).format('YYYY-MM-DD HH:mm')}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openDetail(record)}
            />
          </Tooltip>
          <Tooltip title="下载">
            <Button type="link" size="small" icon={<DownloadOutlined />} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <ContainerOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            构建制品
          </Title>
          <Text type="secondary">管理构建制品仓库、多架构信息和存储统计</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadData();
              loadStats();
            }}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* Stats Panel */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <StatsCard title="总制品数" value={stats.total} icon={<DatabaseOutlined />} />
          </Col>
          <Col span={6}>
            <StatsCard
              title="总存储"
              value={formatSize(stats.totalSizeBytes)}
              icon={<AppstoreOutlined />}
            />
          </Col>
          <Col span={6}>
            <StatsCard
              title="安全评分"
              value={stats.avgSecurityScore ? `${stats.avgSecurityScore.toFixed(0)}` : '-'}
              icon={<SafetyCertificateOutlined />}
              suffix="分"
            />
          </Col>
          <Col span={6}>
            <StatsCard title="生产阶段" value={stats.byStage?.production || 0} icon={<Tag />} />
          </Col>
        </Row>
      )}

      {/* Storage Distribution */}
      {stats && (
        <Card title="阶段分布" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            {Object.entries(stats.byStage || {}).map(([stage, count]) => {
              const total = stats.total || 1;
              const percent = ((count as number) / total) * 100;
              return (
                <Col span={4} key={stage}>
                  <div style={{ textAlign: 'center' }}>
                    <Tag color={stageColorMap[stage] || 'default'}>
                      {stageLabelMap[stage] || stage}
                    </Tag>
                    <div style={{ marginTop: 8 }}>
                      <Progress
                        type="circle"
                        percent={Math.round(percent)}
                        size={60}
                        format={() => count}
                        strokeColor={stageColorMap[stage] || '#d9d9d9'}
                      />
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>
        </Card>
      )}

      {/* Artifact List */}
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
          <Input.Search
            placeholder="搜索制品..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Select
            placeholder="类型"
            style={{ width: 140 }}
            allowClear
            onChange={(v) => setFilters((prev) => ({ ...prev, type: v || 'all' }))}
            options={[
              { label: '全部', value: 'all' },
              { label: '容器镜像', value: 'container_image' },
              { label: 'JAR', value: 'jar_artifact' },
              { label: 'NPM', value: 'npm_package' },
              { label: 'Helm Chart', value: 'helm_chart' },
            ]}
          />
          <Select
            placeholder="阶段"
            style={{ width: 120 }}
            allowClear
            onChange={(v) => setFilters((prev) => ({ ...prev, stage: v || 'all' }))}
            options={[
              { label: '全部', value: 'all' },
              { label: '快照', value: 'snapshot' },
              { label: 'RC', value: 'release_candidate' },
              { label: '稳定', value: 'stable' },
              { label: '生产', value: 'production' },
            ]}
          />
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            onChange={(v) => setFilters((prev) => ({ ...prev, status: v || 'all' }))}
            options={[
              { label: '全部', value: 'all' },
              { label: '可用', value: 'available' },
              { label: '已废弃', value: 'deprecated' },
              { label: '已隔离', value: 'quarantined' },
            ]}
          />
        </div>
        <AntTable<Artifact>
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          rowKey="id"
          size="middle"
          pagination={{
            current: currentPage,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
              loadData(page, size);
            },
          }}
        />
      </Card>

      {/* Detail Drawer */}
      <Drawer
        title={
          selectedArtifact
            ? `${selectedArtifact.displayName || selectedArtifact.name} (${selectedArtifact.version})`
            : '制品详情'
        }
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={800}
        destroyOnClose
      >
        {selectedArtifact && (
          <>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="名称">{selectedArtifact.name}</Descriptions.Item>
              <Descriptions.Item label="版本">{selectedArtifact.version}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color="blue">
                  {typeLabelMap[selectedArtifact.type] || selectedArtifact.type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="阶段">
                <Tag color={stageColorMap[selectedArtifact.stage]}>
                  {stageLabelMap[selectedArtifact.stage] || selectedArtifact.stage}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColorMap[selectedArtifact.status]}>
                  {statusLabelMap[selectedArtifact.status] || selectedArtifact.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="大小">
                {formatSize(selectedArtifact.sizeBytes)}
              </Descriptions.Item>
              <Descriptions.Item label="命名空间">{selectedArtifact.namespace}</Descriptions.Item>
              <Descriptions.Item label="摘要">{selectedArtifact.digest || '-'}</Descriptions.Item>
              <Descriptions.Item label="多架构">
                <Space wrap>
                  {selectedArtifact.annotations?.['architectures'] ? (
                    JSON.parse(selectedArtifact.annotations['architectures']).map(
                      (arch: string) => (
                        <Tag key={arch} icon={<GlobalOutlined />}>
                          {arch}
                        </Tag>
                      )
                    )
                  ) : (
                    <Tag icon={<GlobalOutlined />}>amd64</Tag>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(selectedArtifact.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="存储路径" span={2}>
                <Text copyable>{selectedArtifact.storagePath}</Text>
              </Descriptions.Item>
              {selectedArtifact.description && (
                <Descriptions.Item label="描述" span={2}>
                  {selectedArtifact.description}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Security Info */}
            {selectedArtifact.security && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>安全扫描结果</Title>
                <Descriptions column={4} bordered size="small">
                  <Descriptions.Item label="Critical">
                    <Tag color="red">{selectedArtifact.security.scanResults?.critical || 0}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="High">
                    <Tag color="orange">{selectedArtifact.security.scanResults?.high || 0}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Medium">
                    <Tag color="gold">{selectedArtifact.security.scanResults?.medium || 0}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Low">
                    <Tag color="blue">{selectedArtifact.security.scanResults?.low || 0}</Tag>
                  </Descriptions.Item>
                </Descriptions>
              </div>
            )}

            {/* Build Info */}
            {selectedArtifact.build && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>构建信息</Title>
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="Pipeline Run">
                    {selectedArtifact.build.pipelineRunId}
                  </Descriptions.Item>
                  <Descriptions.Item label="Git Commit">
                    {selectedArtifact.build.gitCommit}
                  </Descriptions.Item>
                  <Descriptions.Item label="Git Branch">
                    {selectedArtifact.build.gitBranch}
                  </Descriptions.Item>
                  <Descriptions.Item label="构建时间">
                    {dayjs(selectedArtifact.build.buildTime).format('YYYY-MM-DD HH:mm:ss')}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
};

export default ArtifactPage;
