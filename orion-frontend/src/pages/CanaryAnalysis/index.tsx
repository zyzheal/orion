/**
 * ML Canary Analysis Page
 * Analysis runs list, run detail with metrics, force promote/rollback, config management
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Button, Space, Tag, Card, Row, Col, Statistic, Modal, Form, Input, message, Select, Descriptions, Alert } from 'antd';
import { ReloadOutlined, SettingOutlined, PlayCircleOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getCanaryRuns,
  getCanaryMetrics,
  getCanaryMlResults,
  triggerCanaryAnalysis,
  getCanaryConfigs,
  createCanaryConfig,
  forcePromote,
  forceRollback,
} from '@/api/canary-analysis';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const CanaryAnalysis: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [mlResults, setMlResults] = useState<any[]>([]);
  const [runDetailVisible, setRunDetailVisible] = useState(false);
  const [triggerModalVisible, setTriggerModalVisible] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [triggerForm] = Form.useForm();
  const [configForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const runRes = await getCanaryRuns();
      await getCanaryConfigs();
      setRuns(Array.isArray(runRes.data.data) ? runRes.data.data : []);
    } catch {
      message.error('Failed to load canary analysis data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRuns = useMemo(() => {
    return runs.filter((r: any) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!r.deploymentId.toLowerCase().includes(q)) return false;
      }
      if (filters.status && filters.status !== 'all' && r.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, runs]);

  const runningCount = runs.filter((r: any) => r.status === 'running').length;
  const promotedCount = runs.filter((r: any) => r.status === 'promote').length;
  const rolledbackCount = runs.filter((r: any) => r.status === 'rollback').length;

  const handleViewRun = async (run: any) => {
    setSelectedRun(run);
    try {
      const [metricRes, mlRes] = await Promise.all([
        getCanaryMetrics(run.id),
        getCanaryMlResults(run.id),
      ]);
      setMetrics(Array.isArray(metricRes.data.data) ? metricRes.data.data : []);
      setMlResults(Array.isArray(mlRes.data.data) ? mlRes.data.data : []);
      setRunDetailVisible(true);
    } catch {
      message.error('Failed to load run detail');
    }
  };

  const handleTrigger = async (values: any) => {
    try {
      await triggerCanaryAnalysis(values);
      message.success('Canary analysis triggered');
      setTriggerModalVisible(false);
      triggerForm.resetFields();
      loadData();
    } catch {
      message.error('Failed to trigger analysis');
    }
  };

  const handleForcePromote = async (runId: string) => {
    try {
      await forcePromote({ runId, reason: 'Manual promote by user' });
      message.success('Force promoted');
      loadData();
      setRunDetailVisible(false);
    } catch {
      message.error('Failed to force promote');
    }
  };

  const handleForceRollback = async (runId: string) => {
    try {
      await forceRollback({ runId, reason: 'Manual rollback by user' });
      message.success('Force rolled back');
      loadData();
      setRunDetailVisible(false);
    } catch {
      message.error('Failed to force rollback');
    }
  };

  const handleSaveConfig = async (values: any) => {
    try {
      await createCanaryConfig(values);
      message.success('Config created');
      setConfigModalVisible(false);
      configForm.resetFields();
      loadData();
    } catch {
      message.error('Failed to create config');
    }
  };

  const runColumns: TableColumn<any>[] = [
    {
      key: 'deploymentId',
      title: '部署',
      dataIndex: 'deploymentId',
      width: 200,
      sortable: true,
      render: (_value: unknown, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong>Deployment #{record.deploymentId}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>Run #{record.runNumber}</Text>
        </Space>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 140,
      render: (value: unknown) => {
        const statusMap: Record<string, any> = {
          running: 'running',
          promote: 'success',
          rollback: 'failed',
          inconclusive: 'warning',
        };
        return <StatusBadge status={statusMap[String(value)] || 'unknown'} size="small" />;
      },
    },
    {
      key: 'trafficSplit',
      title: '流量分布',
      dataIndex: 'trafficSplit',
      width: 160,
      render: (value: unknown) => {
        const split = value as { canary: number; baseline: number };
        if (!split) return '-';
        return (
          <Space>
            <Tag color="green">C: {split.canary}%</Tag>
            <Tag color="blue">B: {split.baseline}%</Tag>
          </Space>
        );
      },
    },
    {
      key: 'confidence',
      title: '置信度',
      dataIndex: 'confidence',
      width: 100,
      sortable: true,
      render: (value: unknown) => {
        if (!value) return <Text type="secondary">-</Text>;
        const conf = Number(value);
        return <Text>{(conf * 100).toFixed(1)}%</Text>;
      },
    },
    {
      key: 'decision',
      title: '决策',
      dataIndex: 'decision',
      width: 120,
      render: (value: unknown) => {
        const colorMap: Record<string, string> = { promote: 'green', rollback: 'red', continue: 'gold' };
        return value ? <Tag color={colorMap[String(value)] || 'default'}>{String(value)}</Tag> : <Text type="secondary">-</Text>;
      },
    },
    {
      key: 'startedAt',
      title: '开始时间',
      dataIndex: 'startedAt',
      width: 160,
      sortable: true,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 100,
      render: (_: unknown, record: any) => (
        <Button type="link" size="small" onClick={() => handleViewRun(record)}>
          详情
        </Button>
      ),
    },
  ];

  const filterDefs: FilterDefinition[] = [
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: 'Running', value: 'running' },
        { label: 'Promote', value: 'promote' },
        { label: 'Rollback', value: 'rollback' },
        { label: 'Inconclusive', value: 'inconclusive' },
      ],
    },
  ];

  return (
    <div style={{ padding: 0 }}>
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
            ML 金丝雀分析
          </Title>
          <Text type="secondary">全指标比对与智能决策</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button icon={<PlayCircleOutlined />} onClick={() => setTriggerModalVisible(true)}>
            触发分析
          </Button>
          <Button icon={<SettingOutlined />} onClick={() => setConfigModalVisible(true)}>
            配置管理
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总运行数" value={runs.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="运行中" value={runningCount} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已升级" value={promotedCount} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已回滚" value={rolledbackCount} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>

      {/* Runs Table */}
      <Card title="分析运行历史">
        <div style={{ marginBottom: 16 }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={filterDefs}
            searchPlaceholder="搜索部署 ID..."
          />
        </div>
        <Table
          columns={runColumns}
          dataSource={filteredRuns}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Run Detail Modal */}
      <Modal
        title="金丝雀分析详情"
        open={runDetailVisible}
        onCancel={() => setRunDetailVisible(false)}
        footer={
          selectedRun && selectedRun.status === 'running' ? (
            <Space>
              <Button danger onClick={() => handleForceRollback(selectedRun.id)}>
                强制回滚
              </Button>
              <Button type="primary" onClick={() => handleForcePromote(selectedRun.id)}>
                强制升级
              </Button>
            </Space>
          ) : null
        }
        width={1000}
      >
        {selectedRun && (
          <>
            {/* Status Banner */}
            {selectedRun.status === 'rollback' && (
              <Alert
                type="error"
                message="ROLLBACK TRIGGERED"
                description="Canary detected significant degradation"
                style={{ marginBottom: 16 }}
              />
            )}
            {selectedRun.status === 'promote' && (
              <Alert
                type="success"
                message="PROMOTE DECISION"
                description="Canary passed all analysis rounds"
                style={{ marginBottom: 16 }}
              />
            )}

            <Descriptions bordered column={3} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="部署">{selectedRun.deploymentId}</Descriptions.Item>
              <Descriptions.Item label="轮次">{selectedRun.runNumber}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <StatusBadge status={selectedRun.status === 'running' ? 'running' : selectedRun.status === 'promote' ? 'success' : 'failed'} size="small" />
              </Descriptions.Item>
              <Descriptions.Item label="置信度">
                {selectedRun.confidence ? `${(selectedRun.confidence * 100).toFixed(1)}%` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="决策">
                {selectedRun.decision ? <Tag>{selectedRun.decision}</Tag> : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="耗时">
                {selectedRun.durationMs ? `${(selectedRun.durationMs / 1000).toFixed(1)}s` : '-'}
              </Descriptions.Item>
            </Descriptions>

            {/* Metrics Comparison */}
            <Card title="指标比对结果" size="small" style={{ marginBottom: 16 }}>
              {metrics.length > 0 ? (
                <Table
                  columns={[
                    {
                      key: 'metricName',
                      title: '指标',
                      dataIndex: 'metricName',
                      width: 180,
                      render: (value: unknown) => <Text strong>{String(value)}</Text>,
                    },
                    {
                      key: 'category',
                      title: '类别',
                      dataIndex: 'category',
                      width: 100,
                      render: (value: unknown) => value ? <Tag>{String(value)}</Tag> : '-',
                    },
                    {
                      key: 'baselineValue',
                      title: 'Baseline',
                      dataIndex: 'baselineValue',
                      width: 100,
                      render: (value: unknown) => value ? String(value) : '-',
                    },
                    {
                      key: 'canaryValue',
                      title: 'Canary',
                      dataIndex: 'canaryValue',
                      width: 100,
                      render: (value: unknown) => value ? String(value) : '-',
                    },
                    {
                      key: 'mannWhitneyP',
                      title: 'MW P值',
                      dataIndex: 'mannWhitneyP',
                      width: 100,
                      render: (value: unknown) => {
                        if (!value) return '-';
                        const p = Number(value);
                        return <Text type={p < 0.05 ? 'danger' : 'secondary'}>{p.toFixed(4)}</Text>;
                      },
                    },
                    {
                      key: 'verdict',
                      title: '判定',
                      dataIndex: 'verdict',
                      width: 100,
                      render: (value: unknown) => {
                        const statusMap: Record<string, any> = { pass: 'success', warn: 'warning', fail: 'failed' };
                        return value ? <StatusBadge status={statusMap[String(value)] || 'unknown'} size="small" /> : '-';
                      },
                    },
                  ]}
                  dataSource={metrics}
                  rowKey="id"
                  size="small"
                  pagination={false as any}
                />
              ) : (
                <Text type="secondary">暂无指标数据</Text>
              )}
            </Card>

            {/* ML Results */}
            {mlResults.length > 0 && (
              <Card title="ML 分析结果" size="small">
                {mlResults.map((ml: any) => (
                  <Descriptions key={ml.id} bordered column={3} size="small" style={{ marginBottom: 8 }}>
                    <Descriptions.Item label="模型">{ml.modelName}</Descriptions.Item>
                    <Descriptions.Item label="预测">
                      <Tag color={ml.prediction === 'healthy' ? 'green' : 'red'}>{ml.prediction}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="置信度">
                      {ml.confidence ? `${(ml.confidence * 100).toFixed(1)}%` : '-'}
                    </Descriptions.Item>
                  </Descriptions>
                ))}
              </Card>
            )}
          </>
        )}
      </Modal>

      {/* Trigger Modal */}
      <Modal
        title="触发金丝雀分析"
        open={triggerModalVisible}
        onCancel={() => setTriggerModalVisible(false)}
        onOk={() => triggerForm.submit()}
        destroyOnClose
      >
        <Form form={triggerForm} layout="vertical" onFinish={handleTrigger}>
          <Form.Item name="deploymentId" label="部署 ID" rules={[{ required: true }]}>
            <Input placeholder="deployment-uuid" />
          </Form.Item>
          <Form.Item name="roundNumber" label="轮次" rules={[{ required: true }]} initialValue={1}>
            <Input type="number" min={1} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Config Modal */}
      <Modal
        title="创建分析配置"
        open={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        onOk={() => configForm.submit()}
        width={600}
        destroyOnClose
      >
        <Form form={configForm} layout="vertical" onFinish={handleSaveConfig}>
          <Form.Item name="serviceName" label="服务名" rules={[{ required: true }]}>
            <Input placeholder="my-service" />
          </Form.Item>
          <Form.Item name="environment" label="环境" rules={[{ required: true }]}>
            <Select options={[
              { label: 'Development', value: 'development' },
              { label: 'Staging', value: 'staging' },
              { label: 'Production', value: 'production' },
            ]} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="analysisIntervalSec" label="分析间隔(秒)" initialValue={300}>
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maxRounds" label="最大轮数" initialValue={5}>
                <Input type="number" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="warmupPeriodSec" label="预热期(秒)" initialValue={600}>
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="trafficStep" label="流量步长(%)" initialValue={20}>
                <Input type="number" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="promoteThreshold" label="升级阈值" initialValue={0.75}>
                <Input type="number" step={0.01} min={0} max={1} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="rollbackThreshold" label="回滚阈值" initialValue={0.60}>
                <Input type="number" step={0.01} min={0} max={1} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default CanaryAnalysis;
