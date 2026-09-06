/**
 * MetricsTab.tsx - 资源指标 Tab
 * 抽取自 CapacityPlanningPage.tsx (P2-9 Phase 92)
 */
import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Space, Typography, Modal, Form, Input, Select, message } from 'antd';
import { BarChartOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import { listCapacityMetrics, recordCapacityMetric, type CapacityMetric } from '@/api/capacity';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { typeColorMap } from '../constants';

const { Title, Text } = Typography;

interface MetricFormValues {
  resourceType: string;
  resourceId: string;
  metricName: string;
  currentValue: string;
  maxValue: string;
  unit: string;
}

export const MetricsTab: React.FC = () => {
  const [metrics, setMetrics] = useState<CapacityMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<MetricFormValues>();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listCapacityMetrics();
      setMetrics((res.data as { data?: CapacityMetric[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载指标失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (values: MetricFormValues) => {
    setSubmitting(true);
    try {
      await recordCapacityMetric({
        resourceType: values.resourceType,
        resourceId: values.resourceId,
        metricName: values.metricName,
        currentValue: Number(values.currentValue),
        maxValue: Number(values.maxValue),
        unit: values.unit,
      });
      message.success('指标记录成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '记录失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: '资源 ID', dataIndex: 'resourceId', key: 'resourceId' },
    {
      title: '类型',
      dataIndex: 'resourceType',
      key: 'resourceType',
      render: (t: string) => <Tag color={typeColorMap[t]}>{t}</Tag>,
    },
    { title: '指标', dataIndex: 'metricName', key: 'metricName' },
    {
      title: '当前值',
      dataIndex: 'currentValue',
      key: 'currentValue',
      render: (v: number, r: CapacityMetric) => `${v} ${r.unit}`,
    },
    {
      title: '最大值',
      dataIndex: 'maxValue',
      key: 'maxValue',
      render: (v: number, r: CapacityMetric) => `${v} ${r.unit}`,
    },
    {
      title: '使用率',
      dataIndex: 'utilizationPercent',
      key: 'utilizationPercent',
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <div>
          <Title level={3} style={{ marginBottom: spacing.sm }}>
            <BarChartOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            资源指标
          </Title>
          <Text type="secondary">各资源类型的容量指标数据</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            记录指标
          </Button>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={metrics}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="记录容量指标"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText="记录"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="资源类型" name="resourceType" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'compute', label: 'Compute' },
                { value: 'storage', label: 'Storage' },
                { value: 'network', label: 'Network' },
                { value: 'database', label: 'Database' },
              ]}
            />
          </Form.Item>
          <Form.Item label="资源 ID" name="resourceId" rules={[{ required: true }]}>
            <Input placeholder="如: vm-001, db-primary" />
          </Form.Item>
          <Form.Item label="指标名称" name="metricName" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'cpu', label: 'CPU' },
                { value: 'memory', label: 'Memory' },
                { value: 'disk', label: 'Disk' },
                { value: 'iops', label: 'IOPS' },
                { value: 'throughput', label: 'Throughput' },
              ]}
            />
          </Form.Item>
          <Form.Item label="当前值" name="currentValue" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item label="最大值" name="maxValue" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item label="单位" name="unit" rules={[{ required: true }]}>
            <Input placeholder="如: %, GB, MB/s" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
