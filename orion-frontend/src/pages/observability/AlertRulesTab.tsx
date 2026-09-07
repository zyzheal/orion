/**
 * AlertRulesTab
 * 告警规则 Tab（抽取自 ObservabilityPage.tsx）
 */
import React, { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Space,
  Button,
  Form,
  Input,
  Select,
  message,
  Modal,
  Switch,
  Row,
  Col,
  Typography,
} from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useQuery } from '@/providers/QueryProvider';
import { spacing } from '@/tokens';
import {
  getAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  toggleAlertRule,
  type AlertRule as AlertRuleType,
  type AlertRuleInput,
} from '@/api/observability';
import { severityColorMap, conditionLabels } from './constants';

const { Text } = Typography;

export const AlertRulesTab: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRuleType | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const {
    data: rules = [],
    isLoading,
    isError,
    error: queryError,
    refetch,
  } = useQuery<AlertRuleType[]>({
    queryKey: ['alert-rules'],
    queryFn: async () => {
      const res = await getAlertRules();
      return res.data?.rules || [];
    },
    staleTime: 30_000,
  });

  const loadRules = () => {
    void refetch();
  };

  const loading = isLoading;

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (isError) {
      message.error(`加载告警规则失败: ${queryError instanceof Error ? queryError.message : ''}`);
    }
  }, [isError, queryError]);

  const openCreateModal = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({ duration: '5m', severity: 'warning' });
    setModalVisible(true);
  };

  const openEditModal = (rule: AlertRuleType) => {
    setEditingRule(rule);
    form.setFieldsValue({
      name: rule.name,
      metric: rule.metric,
      condition: rule.condition,
      threshold: rule.threshold,
      duration: rule.duration,
      severity: rule.severity,
      summary: rule.annotations?.summary,
      description: rule.annotations?.description,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload: AlertRuleInput = {
        name: values.name,
        metric: values.metric,
        condition: values.condition,
        threshold: values.threshold,
        duration: values.duration,
        severity: values.severity,
        annotations: values.summary
          ? { summary: values.summary, description: values.description || '' }
          : undefined,
      };

      if (editingRule) {
        await updateAlertRule(editingRule.id, payload);
        message.success('告警规则已更新');
      } else {
        await createAlertRule(payload);
        message.success('告警规则已创建');
      }
      setModalVisible(false);
      loadRules();
    } catch (error: unknown) {
      if (!(error as { errorFields?: unknown }).errorFields) {
        message.error(`操作失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (ruleId: string) => {
    try {
      await toggleAlertRule(ruleId);
      message.success('规则状态已切换');
      loadRules();
    } catch (error: unknown) {
      message.error(`切换失败: ${(error as Error).message}`);
    }
  };

  const handleDelete = (ruleId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      onOk: async () => {
        try {
          await deleteAlertRule(ruleId);
          message.success('告警规则已删除');
          loadRules();
        } catch (error: unknown) {
          message.error(`删除失败: ${(error as Error).message}`);
        }
      },
    });
  };

  const columns = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    { title: '指标', dataIndex: 'metric', key: 'metric', width: 140 },
    {
      title: '条件',
      key: 'condition',
      width: 100,
      render: (_: unknown, record: AlertRuleType) => (
        <Tag>
          {conditionLabels[record.condition] || record.condition} {record.threshold}
        </Tag>
      ),
    },
    { title: '持续时间', dataIndex: 'duration', key: 'duration', width: 80 },
    {
      title: '严重度',
      dataIndex: 'severity',
      key: 'severity',
      width: 90,
      render: (v: string) => <Tag color={severityColorMap[v]}>{v}</Tag>,
    },
    {
      title: '状态',
      key: 'enabled',
      width: 80,
      render: (_: unknown, record: AlertRuleType) => (
        <Switch checked={record.enabled} size="small" onChange={() => handleToggle(record.id)} />
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_: unknown, record: AlertRuleType) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => openEditModal(record)}>
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: spacing.md, display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary">管理和配置自定义告警规则</Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadRules} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            创建规则
          </Button>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={rules}
        rowKey="id"
        loading={loading}
        size="middle"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingRule ? '编辑告警规则' : '创建告警规则'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}>
            <Input placeholder="如: CPU 使用率过高" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="metric" label="指标名称" rules={[{ required: true }]}>
                <Input placeholder="如: cpu_usage" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="condition" label="条件" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: '> 大于', value: 'gt' },
                    { label: '< 小于', value: 'lt' },
                    { label: '>= 大于等于', value: 'gte' },
                    { label: '<= 小于等于', value: 'lte' },
                    { label: '== 等于', value: 'eq' },
                    { label: '!= 不等于', value: 'neq' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="threshold" label="阈值" rules={[{ required: true }]}>
                <Input type="number" placeholder="90" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="duration" label="持续时间">
                <Input placeholder="如: 5m, 10m, 1h" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="severity" label="严重度" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: 'Critical', value: 'critical' },
                    { label: 'Warning', value: 'warning' },
                    { label: 'Info', value: 'info' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="summary" label="告警摘要">
            <Input placeholder="简短描述告警触发原因" />
          </Form.Item>
          <Form.Item name="description" label="详细描述">
            <Input.TextArea rows={3} placeholder="详细描述告警条件和影响" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
