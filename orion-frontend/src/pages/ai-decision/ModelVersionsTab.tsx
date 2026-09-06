/**
 * ModelVersionsTab.tsx - 模型版本 Tab
 * 抽取自 AIDecisionPage.tsx (P2-9 Phase 84)
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Descriptions,
  Progress,
  Statistic,
  Row,
  Col,
  message,
} from 'antd';
import { spacing } from '@/tokens';
import { ThunderboltOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import PageSkeleton from '@/components/PageSkeleton';
import {
  listModels,
  getModelPerformance,
  activateModel,
  deprecateModel,
  type ModelVersion,
  type ModelPerformance,
} from '@/api/ai-decision';
import { statusColorMap } from './constants';

const { Title, Text } = Typography;

export const ModelVersionsTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelVersion | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [performance, setPerformance] = useState<ModelPerformance | null>(null);

  const loadModels = async () => {
    setLoading(true);
    try {
      const res = await listModels();
      setModels(res.data?.models || []);
    } catch (error: unknown) {
      message.error(`加载模型列表失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const viewDetail = async (model: ModelVersion) => {
    setSelectedModel(model);
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const res = await getModelPerformance(model.name);
      setPerformance(res.data || null);
    } catch {
      setPerformance(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleActivate = async (modelId: string) => {
    try {
      await activateModel(modelId);
      message.success('模型已激活');
      loadModels();
    } catch (error: unknown) {
      message.error(`激活失败: ${(error as Error).message}`);
    }
  };

  const handleDeprecate = async (modelId: string) => {
    try {
      await deprecateModel(modelId);
      message.success('模型已废弃');
      loadModels();
    } catch (error: unknown) {
      message.error(`废弃失败: ${(error as Error).message}`);
    }
  };

  const columns = [
    {
      title: '模型名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (v: string, record: ModelVersion) => (
        <Space>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => viewDetail(record)}>
            {v}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            v{record.version}
          </Text>
        </Space>
      ),
    },
    {
      title: '框架',
      dataIndex: 'framework',
      key: 'framework',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <Tag color={statusColorMap[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '准确率',
      key: 'accuracy',
      width: 100,
      render: (_: unknown, record: ModelVersion) =>
        `${((record.metrics?.accuracy || 0) * 100).toFixed(1)}%`,
    },
    {
      title: 'F1 Score',
      key: 'f1Score',
      width: 100,
      render: (_: unknown, record: ModelVersion) =>
        `${((record.metrics?.f1Score || 0) * 100).toFixed(1)}%`,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: ModelVersion) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => viewDetail(record)}
          >
            详情
          </Button>
          {record.status === 'testing' && (
            <Button
              type="link"
              size="small"
              style={{ color: colors.success[500] }}
              onClick={() => handleActivate(record.id)}
            >
              激活
            </Button>
          )}
          {record.status === 'active' && (
            <Button type="link" size="small" danger onClick={() => handleDeprecate(record.id)}>
              废弃
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: spacing.md, display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary">管理 AI 模型版本，查看性能和进行 A/B 测试对比</Text>
        <Button icon={<ReloadOutlined />} onClick={loadModels} loading={loading}>
          刷新
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={models}
        rowKey="id"
        loading={loading}
        size="middle"
        pagination={{ pageSize: 10 }}
      />
      <Modal
        title={selectedModel?.name || '模型详情'}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={720}
        destroyOnClose
      >
        {detailLoading ? (
          <PageSkeleton rows={4} />
        ) : selectedModel ? (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="名称">{selectedModel.name}</Descriptions.Item>
              <Descriptions.Item label="版本">{selectedModel.version}</Descriptions.Item>
              <Descriptions.Item label="框架">{selectedModel.framework}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColorMap[selectedModel.status]}>{selectedModel.status}</Tag>
              </Descriptions.Item>
            </Descriptions>

            {performance && (
              <>
                <Title level={5}>性能指标</Title>
                <Row gutter={16}>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="总决策数"
                        value={performance.totalDecisions}
                        prefix={<ThunderboltOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="准确率"
                        value={(performance.accuracy * 100).toFixed(1)}
                        suffix="%"
                        valueStyle={{ color: colors.success[500] }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic title="平均延迟" value={performance.avgLatencyMs} suffix="ms" />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="错误率"
                        value={(performance.errorRate * 100).toFixed(2)}
                        suffix="%"
                        valueStyle={{ color: colors.error[400] }}
                      />
                    </Card>
                  </Col>
                </Row>

                <Card size="small" title="趋势数据 (近 7 天)">
                  {performance.dailyTrend.map((d, i) => (
                    <div key={String(i)} style={{ marginBottom: spacing.sm }}>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12 }}>{d.date}</Text>
                        <Progress
                          percent={Math.round(d.accuracy * 100)}
                          size="small"
                          style={{ width: 200 }}
                          format={() => `${d.decisions} 次决策`}
                        />
                      </Space>
                    </div>
                  ))}
                </Card>
              </>
            )}
          </Space>
        ) : (
          <Text type="secondary">无法加载模型详情</Text>
        )}
      </Modal>
    </div>
  );
};
