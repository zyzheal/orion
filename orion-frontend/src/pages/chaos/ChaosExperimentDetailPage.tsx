/**
 * Chaos Experiment Detail Page
 * View and manage a single chaos experiment with runs and metrics
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Space,
  Button,
  Table,
  Timeline,
  Modal,
  Typography,
  message,
  Row,
  Col,
  Statistic,
  Divider,
  Empty,
  Spin,
} from 'antd';
import {
  ThunderboltOutlined,
  PlayCircleOutlined,
  StopOutlined,
  RollbackOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { chaosApi, ChaosExperiment, ChaosRun } from '@/api/chaos';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'default', icon: null, label: '草稿' },
  active: { color: 'processing', icon: <LoadingOutlined />, label: '活跃' },
  completed: { color: 'success', icon: <CheckCircleOutlined />, label: '已完成' },
  archived: { color: 'default', icon: null, label: '已归档' },
};

const runStatusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  running: { color: 'processing', icon: <LoadingOutlined />, label: '运行中' },
  completed: { color: 'success', icon: <CheckCircleOutlined />, label: '已完成' },
  failed: { color: 'error', icon: <CloseCircleOutlined />, label: '失败' },
  rolled_back: { color: 'warning', icon: <UndoOutlined />, label: '已回滚' },
};

export default function ChaosExperimentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [experiment, setExperiment] = useState<ChaosExperiment | null>(null);
  const [runs, setRuns] = useState<ChaosRun[]>([]);
  const [running, setRunning] = useState(false);
  const [selectedRun, setSelectedRun] = useState<ChaosRun | null>(null);
  const [timelineVisible, setTimelineVisible] = useState(false);

  const fetchExperiment = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await chaosApi.getExperiment(id);
      setExperiment(data);
    } catch {
      message.error('获取实验详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchExperiment(); }, [id]);

  const handleRun = async (dryRun = false) => {
    if (!id) return;
    setRunning(true);
    try {
      await chaosApi.runExperiment(id, dryRun);
      message.success(dryRun ? '试运行已启动' : '实验已启动');
      fetchExperiment();
    } catch {
      message.error('启动失败');
    } finally {
      setRunning(false);
    }
  };

  const handleStop = async () => {
    if (!id) return;
    try {
      await chaosApi.stopExperiment(id);
      message.success('实验已停止');
      fetchExperiment();
    } catch {
      message.error('停止失败');
    }
  };

  const handleRollback = async (runId: string) => {
    try {
      await chaosApi.rollbackRun(runId, '手动回滚');
      message.success('回滚成功');
      fetchExperiment();
    } catch {
      message.error('回滚失败');
    }
  };

  const runColumns = [
    {
      title: '运行ID',
      dataIndex: 'id',
      key: 'id',
      ellipsis: true,
      width: 180,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => {
        const cfg = runStatusConfig[v] || runStatusConfig.running;
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'MTTR',
      dataIndex: ['metrics', 'mttr_ms'],
      key: 'mttr',
      render: (v: number) => v ? `${(v / 1000).toFixed(1)}s` : '-',
    },
    {
      title: '受影响服务',
      dataIndex: ['metrics', 'affected_services'],
      key: 'affected',
      render: (v: string[]) => v?.length ? v.map(s => <Tag key={s}>{s}</Tag>) : '-',
    },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      key: 'started_at',
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: ChaosRun) => (
        <Space>
          <Button
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() => { setSelectedRun(record); setTimelineVisible(true); }}
          >
            时间线
          </Button>
          {record.status === 'completed' && (
            <Button
              size="small"
              danger
              icon={<RollbackOutlined />}
              onClick={() => handleRollback(record.id)}
            >
              回滚
            </Button>
          )}
        </Space>
      ),
    },
  ];

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!experiment) return <Empty description="实验不存在" />;

  const cfg = statusConfig[experiment.status] || statusConfig.draft;

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/chaos-experiments')}>
          返回列表
        </Button>
      </Space>

      <Title level={2} style={{ marginBottom: 16 }}>
        <ThunderboltOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        {experiment.name}
        <Tag color={cfg.color} icon={cfg.icon} style={{ marginLeft: 12 }}>{cfg.label}</Tag>
      </Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={18}>
          <Card>
            <Descriptions bordered size="small" column={3}>
              <Descriptions.Item label="实验ID">{experiment.id}</Descriptions.Item>
              <Descriptions.Item label="租户">{experiment.tenant_id}</Descriptions.Item>
              <Descriptions.Item label="环境">{experiment.scope?.environment}</Descriptions.Item>
              <Descriptions.Item label="自动回滚">
                {experiment.auto_rollback ? '是' : '否'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(experiment.created_at).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="故障数量">
                {experiment.faults?.length ?? 0}
              </Descriptions.Item>
            </Descriptions>

            {experiment.description && (
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">{experiment.description}</Text>
              </div>
            )}
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                block
                loading={running}
                onClick={() => handleRun(false)}
                disabled={experiment.status === 'archived'}
              >
                运行实验
              </Button>
              <Button
                icon={<PlayCircleOutlined />}
                block
                loading={running}
                onClick={() => handleRun(true)}
                disabled={experiment.status === 'archived'}
              >
                试运行 (Dry Run)
              </Button>
              <Button
                danger
                icon={<StopOutlined />}
                block
                onClick={handleStop}
                disabled={experiment.status !== 'active'}
              >
                停止
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="故障配置" style={{ marginBottom: 16 }}>
        {(experiment.faults || []).length === 0 ? (
          <Empty description="无故障配置" />
        ) : (
          <Table
            dataSource={experiment.faults}
            rowKey={(f, i) => i?.toString() ?? '0'}
            pagination={false}
            columns={[
              { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag>{v}</Tag> },
              { title: '目标', dataIndex: 'target', key: 'target' },
              { title: '持续时间', dataIndex: 'duration_ms', key: 'duration', render: (v: number) => `${v / 1000}s` },
              { title: '延迟', dataIndex: 'delay_ms', key: 'delay', render: (v: number) => `${v / 1000}s` },
              { title: '配置', dataIndex: 'config', key: 'config', render: (v: Record<string, unknown>) => <Text code>{JSON.stringify(v)}</Text> },
            ]}
          />
        )}
      </Card>

      <Card title="运行记录">
        <Table
          dataSource={runs}
          columns={runColumns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="运行时间线"
        open={timelineVisible}
        onCancel={() => setTimelineVisible(false)}
        footer={null}
        width={600}
      >
        {selectedRun && (
          <Timeline
            items={(selectedRun.timeline || []).map(evt => ({
              color: evt.type === 'inject' ? 'red' : evt.type === 'recover' ? 'green' : 'blue',
              children: (
                <div>
                  <Text strong>[{evt.type}]</Text> {evt.service}
                  <br />
                  <Text type="secondary">{evt.details}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(evt.timestamp).toLocaleString()}
                  </Text>
                </div>
              ),
            }))}
          />
        )}
      </Modal>
    </div>
  );
}
