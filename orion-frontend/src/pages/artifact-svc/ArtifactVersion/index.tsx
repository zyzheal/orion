/**
 * Artifact Version Management Page
 * Version listing, traceability, comparison, and deployment history
 */
import React, { useState, useEffect } from 'react';
import {
  Typography, Button, Space, Tag, message, Table, Modal,
  Descriptions, Timeline, Divider, Card, Statistic, Row, Col,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftOutlined, ReloadOutlined,
  EyeOutlined, RocketOutlined, TagOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import {
  getArtifactVersions,
  getTraceabilityChain,
  getDeploymentHistory,
  deployVersion,
  type ArtifactVersion,
  type TraceabilityChain,
  type DeploymentHistory as DeploymentHistoryType,
} from '@/api/artifactVersions';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const ArtifactVersionPage: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<ArtifactVersion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Detail modal
  const [detailVisible, setDetailVisible] = useState(false);
  const [chain, setChain] = useState<TraceabilityChain | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<ArtifactVersion | null>(null);
  const [_deployHistory, setDeployHistory] = useState<DeploymentHistoryType | null>(null);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const res = await getArtifactVersions({ limit: pageSize, offset: (page - 1) * pageSize });
      if (res.data) {
        setVersions(res.data.versions || []);
        setTotal(res.data.total || 0);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载版本列表失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, [page]);

  const showDetail = async (version: ArtifactVersion) => {
    setSelectedVersion(version);
    setDetailVisible(true);

    try {
      const chainRes = await getTraceabilityChain(version.id);
      if (chainRes.data) setChain(chainRes.data);
    } catch (error: unknown) {
      console.error('Failed to load traceability chain:', error);
    }

    try {
      const depRes = await getDeploymentHistory(version.pipelineId);
      if (depRes.data) setDeployHistory(depRes.data);
    } catch (error: unknown) {
      console.error('Failed to load deployment history:', error);
    }
  };

  const handleDeploy = async (version: ArtifactVersion, environment: string) => {
    try {
      await deployVersion(version.id, { environment, deployedBy: 'current-user' });
      message.success(`已部署到 ${environment}`);
      loadVersions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '部署失败';
      message.error(msg);
    }
  };

  const columns = [
    {
      title: 'Artifact',
      dataIndex: 'artifactName',
      width: 180,
      render: (v: string, r: ArtifactVersion) => (
        <Space direction="vertical" size={0}>
          <Text strong>{v}</Text>
          <Text type="secondary" style={{ fontSize: spacing[2] }}>v{r.version}</Text>
        </Space>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 140,
      render: (v: string, r: ArtifactVersion) => (
        <Text
          strong
          style={{ cursor: 'pointer', color: colors.primary[500] }}
          onClick={() => showDetail(r)}
        >
          {v}
        </Text>
      ),
    },
    {
      title: '分支',
      dataIndex: 'branch',
      width: 120,
      render: (v: string) => v ? <Tag color="geekblue">{v}</Tag> : '-',
    },
    {
      title: 'Stage',
      dataIndex: 'stageName',
      width: 100,
    },
    {
      title: 'Commit',
      dataIndex: 'commitSha',
      width: 100,
      render: (v: string) => v ? <Text code>{v.slice(0, 7)}</Text> : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      width: 200,
      render: (_: unknown, r: ArtifactVersion) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(r)}>
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<RocketOutlined />}
            onClick={() => handleDeploy(r, 'dev')}
          >
            部署到 dev
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/artifacts')}>
          返回
        </Button>
        <div style={{ flex: 1 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            <TagOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            Artifact 版本管理
          </Title>
          <Text type="secondary">共 {total} 个版本</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadVersions} loading={loading}>
          刷新
        </Button>
      </div>

      {/* Stats */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="总版本数" value={total} />
          </Col>
          <Col span={6}>
            <Statistic title="今日新增" value={versions.filter(v => dayjs(v.createdAt).isAfter(dayjs().startOf('day'))).length} />
          </Col>
          <Col span={6}>
            <Statistic title="关联分支" value={new Set(versions.map(v => v.branch).filter(Boolean)).size} />
          </Col>
          <Col span={6}>
            <Statistic title="关联 Pipeline" value={new Set(versions.map(v => v.pipelineId)).size} />
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={versions}
        loading={loading}
        rowKey="id"
        size="middle"
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p) => setPage(p),
        }}
      />

      {/* Detail Modal */}
      <Modal
        title="版本详情与追溯链"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {selectedVersion && chain && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Artifact">{selectedVersion.artifactName}</Descriptions.Item>
              <Descriptions.Item label="版本">{selectedVersion.version}</Descriptions.Item>
              <Descriptions.Item label="分支">{selectedVersion.branch || '-'}</Descriptions.Item>
              <Descriptions.Item label="Commit">{selectedVersion.commitSha ? selectedVersion.commitSha.slice(0, 7) : '-'}</Descriptions.Item>
              <Descriptions.Item label="Stage">{selectedVersion.stageName}</Descriptions.Item>
              <Descriptions.Item label="Pipeline">{selectedVersion.pipelineId}</Descriptions.Item>
            </Descriptions>

            <Divider />
            <Text strong>追溯链</Text>

            {chain.pipelineRun && (
              <Timeline style={{ marginTop: 16 }}>
                <Timeline.Item color="blue">
                  <Text strong>构建完成</Text>
                  <br />
                  <Text type="secondary">
                    {dayjs(chain.pipelineRun.startedAt).format('YYYY-MM-DD HH:mm:ss')}
                  </Text>
                </Timeline.Item>
                {chain.deployments?.map((d, i) => (
                  <Timeline.Item key={i} color="green">
                    <Text strong>部署到 {d.environment}</Text>
                    <br />
                    <Text type="secondary">
                      {d.status} · {dayjs(d.deployedAt).format('YYYY-MM-DD HH:mm:ss')}
                      {d.deployedBy ? ` by ${d.deployedBy}` : ''}
                    </Text>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}

            <Divider />
            <Text strong>存储路径</Text>
            <div style={{ marginTop: 8 }}>
              <Text code>{selectedVersion.storagePath}</Text>
            </div>
          </>
        )}
        {selectedVersion && !chain && (
          <Text type="secondary">加载追溯链中...</Text>
        )}
      </Modal>
    </div>
  );
};

export default ArtifactVersionPage;
