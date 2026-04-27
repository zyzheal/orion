/**
 * Monitoring Metrics Page
 * View and manage metrics, record new metrics, view metric series and summaries
 */
import React, { useState, useEffect } from 'react';
import { Typography, Button, Space, Modal, Form, Input, InputNumber, Select, message, Tag, Drawer } from 'antd';
import { PlusOutlined, ReloadOutlined, LineChartOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { getMetrics, recordMetric, registerMetric, getMetricSeries, getMetricSummary } from '@/api/monitoring';
import type { Metric } from '@/api/monitoring';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ---- Form value interfaces ----

interface RecordMetricFormValues {
  name: string;
  value: number;
  tags?: string;
}

interface RegisterMetricFormValues {
  name: string;
  type: string;
  unit: string;
  tags?: string;
}

interface MetricSeriesPoint {
  timestamp: string;
  value: number;
}

interface MetricSummary {
  avg?: number;
  min?: number;
  max?: number;
  p95?: number;
  count: number;
}

const MonitoringMetrics: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [recordModalVisible, setRecordModalVisible] = useState(false);
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null);
  const [seriesData, setSeriesData] = useState<MetricSeriesPoint[]>([]);
  const [summaryData, setSummaryData] = useState<MetricSummary | null>(null);
  const [recordForm] = Form.useForm();
  const [registerForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await getMetrics();
      const apiData = response.data.data;
      setMetrics(Array.isArray(apiData) ? apiData : []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载指标失败：${error.message}`);
      } else {
        message.error('加载指标失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredMetrics = React.useMemo(() => {
    return metrics.filter((m) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [m.name, m.unit, ...Object.values(m.tags || {})].join(' ').toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      return true;
    });
  }, [searchQuery, metrics]);

  const handleRecord = async (values: RecordMetricFormValues) => {
    try {
      const payload = {
        name: values.name,
        value: values.value,
        tags: values.tags ? JSON.parse(values.tags) : undefined,
      };
      await recordMetric(payload);
      message.success('指标已记录');
      setRecordModalVisible(false);
      recordForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const message_text = error instanceof Error ? error.message : '记录指标失败';
      message.error(`记录指标失败: ${message_text}`);
    }
  };

  const handleRegister = async (values: RegisterMetricFormValues) => {
    try {
      const payload = {
        name: values.name,
        type: values.type,
        unit: values.unit,
        tags: values.tags ? JSON.parse(values.tags) : undefined,
      };
      await registerMetric(payload);
      message.success('指标已注册');
      setRegisterModalVisible(false);
      registerForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '注册指标失败';
      message.error(`注册指标失败: ${msg}`);
    }
  };

  const showDetail = async (metric: Metric) => {
    setSelectedMetric(metric);
    setDetailDrawerVisible(true);
    try {
      const [seriesRes, summaryRes] = await Promise.all([
        getMetricSeries(metric.name),
        getMetricSummary(metric.name),
      ]);
      setSeriesData(seriesRes.data.data?.points || []);
      setSummaryData(summaryRes.data.data);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载指标详情失败';
      message.error(`加载指标详情失败: ${msg}`);
    }
  };

  const filterDefs: FilterDefinition[] = [];

  const columns: TableColumn<Metric>[] = [
    {
      key: 'name',
      title: '指标名称',
      dataIndex: 'name',
      sortable: true,
      filterable: true,
      render: (v: unknown) => (
        <Text strong style={{ color: colors.primary[500], cursor: 'pointer' }} onClick={() => {
          const m = metrics.find((item) => item.name === String(v));
          if (m) showDetail(m);
        }}>
          {String(v)}
        </Text>
      ),
    },
    {
      key: 'value',
      title: '当前值',
      dataIndex: 'value',
      sortable: true,
      width: 120,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'unit',
      title: '单位',
      dataIndex: 'unit',
      width: 80,
      render: (v: unknown) => <Tag color="blue">{String(v)}</Tag>,
    },
    {
      key: 'tags',
      title: '标签',
      dataIndex: 'tags',
      render: (v: unknown) => {
        const tags = v as Record<string, string> | undefined;
        return (
        <Space wrap>
          {tags && Object.entries(tags).slice(0, 3).map(([k, val]) => (
            <Tag key={k} style={{ fontSize: spacing[2] }}>{k}:{val}</Tag>
          ))}
          {tags && Object.keys(tags).length > 3 && (
            <Tag>+{Object.keys(tags).length - 3}</Tag>
          )}
        </Space>
        );
      },
    },
    {
      key: 'lastUpdated',
      title: '更新时间',
      dataIndex: 'lastUpdated',
      sortable: true,
      width: 160,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(v)).format('YYYY-MM-DD HH:mm:ss')}
        </Text>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <LineChartOutlined style={{ marginRight: 8 }} />
            指标管理
          </Title>
          <Text type="secondary">共 {metrics.length} 个指标</Text>
        </div>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setRecordModalVisible(true)}>
            记录指标
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => setRegisterModalVisible(true)}>
            注册指标
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          filters={filterDefs}
          searchPlaceholder="搜索指标名称、标签..."
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredMetrics}
        loading={loading}
        rowKey="name"
        size="middle"
        striped
      />

      {/* Record Metric Modal */}
      <Modal
        title="记录指标值"
        open={recordModalVisible}
        onCancel={() => setRecordModalVisible(false)}
        footer={null}
        width={480}
      >
        <Form form={recordForm} layout="vertical" onFinish={handleRecord}>
          <Form.Item name="name" label="指标名称" rules={[{ required: true, message: '请输入指标名称' }]}>
            <Input placeholder="例如：http_requests_total" />
          </Form.Item>
          <Form.Item name="value" label="指标值" rules={[{ required: true, message: '请输入指标值' }]}>
            <InputNumber style={{ width: '100%' }} placeholder="数值" />
          </Form.Item>
          <Form.Item name="tags" label="标签 (JSON)">
            <TextArea rows={3} placeholder='{"method": "GET", "path": "/api"}' />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>提交</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Register Metric Modal */}
      <Modal
        title="注册新指标"
        open={registerModalVisible}
        onCancel={() => setRegisterModalVisible(false)}
        footer={null}
        width={480}
      >
        <Form form={registerForm} layout="vertical" onFinish={handleRegister}>
          <Form.Item name="name" label="指标名称" rules={[{ required: true, message: '请输入指标名称' }]}>
            <Input placeholder="例如：http_requests_total" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select options={[
              { label: 'Counter', value: 'counter' },
              { label: 'Gauge', value: 'gauge' },
              { label: 'Histogram', value: 'histogram' },
              { label: 'Summary', value: 'summary' },
            ]} />
          </Form.Item>
          <Form.Item name="unit" label="单位" rules={[{ required: true, message: '请输入单位' }]}>
            <Input placeholder="例如：requests, ms, bytes" />
          </Form.Item>
          <Form.Item name="tags" label="标签 (JSON)">
            <TextArea rows={3} placeholder='{"service": "api"}' />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>注册</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Metric Detail Drawer */}
      <Drawer
        title={`指标详情: ${selectedMetric?.name}`}
        placement="right"
        width={600}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
      >
        {summaryData && (
          <>
            <Title level={5}>统计摘要</Title>
            <Space direction="vertical" style={{ width: '100%', marginBottom: 24 }}>
              <Space size="large">
                <div><Text type="secondary">平均:</Text><br /><Text strong>{summaryData.avg?.toFixed(2)}</Text></div>
                <div><Text type="secondary">最小:</Text><br /><Text strong>{summaryData.min?.toFixed(2)}</Text></div>
                <div><Text type="secondary">最大:</Text><br /><Text strong>{summaryData.max?.toFixed(2)}</Text></div>
                <div><Text type="secondary">P95:</Text><br /><Text strong>{summaryData.p95?.toFixed(2)}</Text></div>
                <div><Text type="secondary">计数:</Text><br /><Text strong>{summaryData.count}</Text></div>
              </Space>
            </Space>
          </>
        )}
        <Title level={5}>时间序列</Title>
        {seriesData.length > 0 ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            {seriesData.slice(-20).reverse().map((point: MetricSeriesPoint, idx: number) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${colors.light.border.light}` }}>
                <Text type="secondary">{dayjs(point.timestamp).format('HH:mm:ss')}</Text>
                <Text strong>{point.value}</Text>
              </div>
            ))}
          </Space>
        ) : (
          <Text type="secondary">暂无时间序列数据</Text>
        )}
      </Drawer>
    </div>
  );
};

export default MonitoringMetrics;
