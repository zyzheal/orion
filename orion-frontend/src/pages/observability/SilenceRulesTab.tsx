/**
 * SilenceRulesTab
 * 静默规则 Tab（抽取自 ObservabilityPage.tsx）
 */
import React, { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Space,
  Button,
  Form,
  Input,
  message,
  Modal,
  DatePicker,
  Typography,
} from 'antd';
import { ReloadOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import {
  getSilenceRules,
  createSilenceRule,
  deleteSilenceRule,
  type SilenceRule as SilenceRuleType,
  type SilenceRuleInput,
} from '@/api/observability';

const { Text } = Typography;
const { RangePicker } = DatePicker;

export const SilenceRulesTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<SilenceRuleType[]>([]);
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await getSilenceRules();
      setRules(res.data?.rules || []);
    } catch (error: unknown) {
      message.error(`加载静默规则失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const [start, end] = values.timeRange;
      const payload: SilenceRuleInput = {
        matchers: [
          { name: 'alertname', value: values.alertName, isRegex: false },
          ...(values.service ? [{ name: 'service', value: values.service, isRegex: false }] : []),
        ],
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        comment: values.comment,
      };
      await createSilenceRule(payload);
      message.success('静默规则已创建');
      setModalVisible(false);
      form.resetFields();
      loadRules();
    } catch (error: unknown) {
      if (!(error as { errorFields?: unknown }).errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await deleteSilenceRule(ruleId);
      message.success('静默规则已删除');
      loadRules();
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  const columns = [
    {
      title: '匹配器',
      key: 'matchers',
      width: 240,
      render: (_: unknown, record: SilenceRuleType) => (
        <Space wrap>
          {record.matchers.map((m, i) => (
            <Tag key={String(i)} color="blue">
              {m.name}="{m.value}"
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '开始时间',
      dataIndex: 'startsAt',
      key: 'startsAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '结束时间',
      dataIndex: 'endsAt',
      key: 'endsAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v: string) => <Tag color={v === 'active' ? 'success' : 'default'}>{v}</Tag>,
    },
    { title: '备注', dataIndex: 'comment', key: 'comment', ellipsis: true },
    { title: '创建人', dataIndex: 'createdBy', key: 'createdBy', width: 120 },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: SilenceRuleType) => (
        <Button
          type="link"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(record.id)}
        />
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: spacing.md, display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary">配置告警静默规则，在维护期间抑制告警通知</Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadRules} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            创建静默规则
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
        title="创建静默规则"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="alertName" label="告警名称" rules={[{ required: true }]}>
            <Input placeholder="要静默的告警名称" />
          </Form.Item>
          <Form.Item name="service" label="服务 (可选)">
            <Input placeholder="限定服务名称" />
          </Form.Item>
          <Form.Item name="timeRange" label="静默时间段" rules={[{ required: true }]}>
            <RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="comment" label="备注" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="静默原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
