/**
 * Performance Engineering Page
 * Phase 4 - Performance baselines, evaluation, bottleneck detection
 *
 * Features:
 * - Performance baseline management
 * - Bottleneck detection and analysis
 * - Optimization suggestions
 * - Service profiling
 * - Performance evaluation against baselines
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  message,
  Typography,
  Tabs,
  InputNumber,
} from 'antd';
import {
  RocketOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  BulbOutlined,
  LineChartOutlined,
  WarningOutlined,
  RiseOutlined,} from '@ant-design/icons';
import {
  performanceApi,
  type PerformanceBaseline,
  type Bottleneck,
  type PerformanceSuggestion,
} from '@/api/performance';
import { colors } from '@/tokens';

const { Title, Text } = Typography;

// Type labels
const typeLabelMap: Record<string, string> = {
  cpu: 'CPU',
  memory: '内存',
  network: '网络',
  database: '数据库',
  lock: '锁竞争',
};

const severityConfig: Record<string, { color: string; label: string }> = {
  critical: { color: 'red', label: '严重' },
  high: { color: 'orange', label: '高' },
  medium: { color: 'blue', label: '中' },
  low: { color: 'default', label: '低' },
};

const categoryLabelMap: Record<string, string> = {
  scaling: '扩容',
  caching: '缓存优化',
  optimization: '性能优化',
  architecture: '架构调整',
};

const effortLabelMap: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

const PerformancePage: React.FC = () => {
  const [baselines, setBaselines] = useState<PerformanceBaseline[]>([]);
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [suggestions, setSuggestions] = useState<PerformanceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('baselines');
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [baselinesData, bottlenecksData, suggestionsData] = await Promise.all([
        performanceApi.listBaselines(),
        performanceApi.getBottlenecks(),
        performanceApi.getSuggestions(),
      ]);
      setBaselines(Array.isArray(baselinesData) ? baselinesData : []);
      setBottlenecks(Array.isArray(bottlenecksData) ? bottlenecksData : []);
      setSuggestions(Array.isArray(suggestionsData) ? suggestionsData : []);
    } catch (error: unknown) {
      message.error(`加载性能数据失败: ${(error as Error).message}`);
      setBaselines([]);
      setBottlenecks([]);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBaseline = async (values: any) => {
    try {
      await performanceApi.createBaseline({
        serviceName: values.serviceName,
        environment: values.environment,
        metrics: {
          p50Latency: values.p50Latency,
          p95Latency: values.p95Latency,
          p99Latency: values.p99Latency,
          throughput: values.throughput,
          errorRate: values.errorRate || 0,
        },
      });
      message.success('性能基线创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`创建基线失败: ${(error as Error).message}`);
    }
  };

  // Stats
  const stats = useMemo(() => ({
    totalBaselines: baselines.length,
    criticalBottlenecks: bottlenecks.filter((b) => b.severity === 'critical').length,
    highBottlenecks: bottlenecks.filter((b) => b.severity === 'high').length,
    totalSuggestions: suggestions.length,
  }), [baselines, bottlenecks, suggestions]);

  // Baseline table columns
  const baselineColumns = [
    {
      title: '服务名称',
      dataIndex: 'serviceName',
      key: 'serviceName',
      width: 160,
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      width: 100,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'P50 (ms)',
      key: 'p50',
      width: 100,
      render: (_: unknown, record: PerformanceBaseline) => `${record.metrics.p50Latency.toFixed(1)}`,
    },
    {
      title: 'P95 (ms)',
      key: 'p95',
      width: 100,
      render: (_: unknown, record: PerformanceBaseline) => `${record.metrics.p95Latency.toFixed(1)}`,
    },
    {
      title: 'P99 (ms)',
      key: 'p99',
      width: 100,
      render: (_: unknown, record: PerformanceBaseline) => `${record.metrics.p99Latency.toFixed(1)}`,
    },
    {
      title: '吞吐量 (RPS)',
      key: 'throughput',
      width: 120,
      render: (_: unknown, record: PerformanceBaseline) => record.metrics.throughput.toLocaleString(),
    },
    {
      title: '错误率',
      key: 'errorRate',
      width: 100,
      render: (_: unknown, record: PerformanceBaseline) => `${(record.metrics.errorRate * 100).toFixed(2)}%`,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
  ];

  // Bottleneck table columns
  const bottleneckColumns = [
    {
      title: '服务名称',
      dataIndex: 'serviceName',
      key: 'serviceName',
      width: 160,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (v: string) => <Tag color="cyan">{typeLabelMap[v] || v}</Tag>,
    },
    {
      title: '严重级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (v: string) => {
        const cfg = severityConfig[v] || severityConfig.low;
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '当前值',
      key: 'metricValue',
      width: 100,
      render: (_: unknown, record: Bottleneck) => record.metricValue.toFixed(2),
    },
    {
      title: '阈值',
      key: 'threshold',
      width: 100,
      render: (_: unknown, record: Bottleneck) => record.threshold.toFixed(2),
    },
    {
      title: '检测时间',
      dataIndex: 'detectedAt',
      key: 'detectedAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
  ];

  // Suggestion table columns
  const suggestionColumns = [
    {
      title: '服务名称',
      dataIndex: 'serviceName',
      key: 'serviceName',
      width: 160,
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (v: string) => <Tag>{categoryLabelMap[v] || v}</Tag>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '预期改进',
      dataIndex: 'expectedImprovement',
      key: 'expectedImprovement',
      width: 160,
    },
    {
      title: '工作量',
      dataIndex: 'effort',
      key: 'effort',
      width: 80,
      render: (v: string) => <Tag>{effortLabelMap[v] || v}</Tag>,
    },
  ];

  const tabItems = [
    {
      key: 'baselines',
      label: (
        <Space>
          <LineChartOutlined />
          性能基线
        </Space>
      ),
      children: (
        <Table
          columns={baselineColumns}
          dataSource={baselines}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      ),
    },
    {
      key: 'bottlenecks',
      label: (
        <Space>
          <WarningOutlined />
          瓶颈检测 ({stats.criticalBottlenecks + stats.highBottlenecks})
        </Space>
      ),
      children: (
        <Table
          columns={bottleneckColumns}
          dataSource={bottlenecks}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      ),
    },
    {
      key: 'suggestions',
      label: (
        <Space>
          <BulbOutlined />
          优化建议 ({suggestions.length})
        </Space>
      ),
      children: (
        <Table
          columns={suggestionColumns}
          dataSource={suggestions}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <RiseOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            <ThunderboltOutlined style={{ marginRight: 8 }} />
            性能工程
          </Title>
          <Text type="secondary">性能基线管理、瓶颈检测和优化建议</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<RocketOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            创建基线
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="基线数量" value={stats.totalBaselines} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="严重瓶颈"
              value={stats.criticalBottlenecks}
              valueStyle={{ color: stats.criticalBottlenecks > 0 ? colors.error[400] : undefined }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="高危瓶颈"
              value={stats.highBottlenecks}
              valueStyle={{ color: stats.highBottlenecks > 0 ? '#fa8c16' : undefined }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="优化建议"
              value={stats.totalSuggestions}
              prefix={<BulbOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabbed content */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </Card>

      {/* Create Baseline Modal */}
      <Modal
        title="创建性能基线"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateBaseline}>
          <Form.Item
            label="服务名称"
            name="serviceName"
            rules={[{ required: true, message: '请输入服务名称' }]}
          >
            <Input placeholder="如: user-service" />
          </Form.Item>
          <Form.Item
            label="环境"
            name="environment"
            rules={[{ required: true, message: '请选择环境' }]}
            initialValue="production"
          >
            <Select
              options={[
                { label: '生产环境', value: 'production' },
                { label: '预发环境', value: 'staging' },
                { label: '测试环境', value: 'testing' },
              ]}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="P50 延迟 (ms)"
                name="p50Latency"
                rules={[{ required: true, message: '请输入 P50 延迟' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="如: 50" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="P95 延迟 (ms)"
                name="p95Latency"
                rules={[{ required: true, message: '请输入 P95 延迟' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="如: 200" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="P99 延迟 (ms)"
                name="p99Latency"
                rules={[{ required: true, message: '请输入 P99 延迟' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="如: 500" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="吞吐量 (RPS)"
                name="throughput"
                rules={[{ required: true, message: '请输入吞吐量' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="如: 1000" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="错误率"
            name="errorRate"
            initialValue={0}
          >
            <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} placeholder="如: 0.01" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PerformancePage;
