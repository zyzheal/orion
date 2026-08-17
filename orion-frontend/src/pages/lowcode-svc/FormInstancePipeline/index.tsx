/**
 * 表单实例流水线 (Form Instance Pipeline)
 * 提交 → 审批 → 完成 全流程管理
 */
import React, { useState, useEffect, useCallback } from 'react';
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
  Row,
  Col,
  message,
  Typography,
  Empty,
  Descriptions,
  Popconfirm,
} from 'antd';
import {
  FileOutlined,
  SendOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { colors, spacing, themeVars } from '@/tokens';
import {
  listInstances,
  getInstance,
  submitInstance,
  approveInstance,
  listForms,
  type FormInstance,
  type FormDefinition,
} from '@/api/lowcode';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  submitted: { color: 'gold', label: '已提交' },
  approved: { color: 'green', label: '已批准' },
  rejected: { color: 'red', label: '已拒绝' },
  pending: { color: 'orange', label: '待审批' },
};

const FormInstancePipeline: React.FC = () => {
  const [instances, setInstances] = useState<FormInstance[]>([]);
  const [forms, setForms] = useState<FormDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [selectedForm, setSelectedForm] = useState<string>('');

  // Submit modal
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitForm] = Form.useForm();

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<FormInstance | null>(null);

  const operator = localStorage.getItem('username') || 'system';

  const loadInstances = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listInstances(selectedForm || undefined, status || undefined);
      setInstances(Array.isArray(data) ? data : []);
    } catch {
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }, [selectedForm, status]);

  const loadForms = useCallback(async () => {
    try {
      const data = await listForms();
      setForms(Array.isArray(data) ? data : []);
    } catch {
      setForms([]);
    }
  }, []);

  useEffect(() => { loadInstances(); }, [loadInstances]);
  useEffect(() => { loadForms(); }, [loadForms]);

  const handleSubmit = async (values: { formId: string; data: Record<string, unknown> }) => {
    try {
      const formData: Record<string, unknown> = {};
      if (typeof values.data === 'string') {
        formData.json = JSON.parse(values.data);
      } else if (values.data) {
        formData.json = values.data;
      }
      await submitInstance(values.formId, { data: formData, submitBy: operator });
      message.success('表单实例提交成功');
      setSubmitModalOpen(false);
      submitForm.resetFields();
      loadInstances();
    } catch {
      message.error('提交失败');
    }
  };

  const handleApprove = async (id: string, action: 'approve' | 'reject') => {
    try {
      await approveInstance(id, action, operator);
      message.success(action === 'approve' ? '审批通过' : '审批拒绝');
      loadInstances();
    } catch {
      message.error('操作失败');
    }
  };

  const handleViewDetail = async (inst: FormInstance) => {
    try {
      const data = await getInstance(inst.id);
      setSelectedInstance(data || inst);
      setDetailOpen(true);
    } catch {
      setSelectedInstance(inst);
      setDetailOpen(true);
    }
  };

  const totalInstances = instances.length;
  const approvedCount = instances.filter((i) => i.status === 'approved').length;
  const pendingCount = instances.filter((i) => i.status === 'submitted' || i.status === 'pending').length;
  const rejectedCount = instances.filter((i) => i.status === 'rejected').length;

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 100, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const cfg = STATUS_CONFIG[v];
        return <Tag color={cfg?.color}>{cfg?.label || v}</Tag>;
      },
    },
    {
      title: '提交者',
      dataIndex: 'submittedBy',
      key: 'submittedBy',
      width: 100,
    },
    {
      title: '审批人',
      dataIndex: 'approvedBy',
      key: 'approvedBy',
      width: 100,
      render: (v: string) => v || '-',
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: '审批时间',
      dataIndex: 'approvedAt',
      key: 'approvedAt',
      width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: FormInstance) => (
        <Space>
          <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          {(record.status === 'submitted' || record.status === 'pending') && (
            <>
              <Popconfirm title="确认审批通过？" onConfirm={() => handleApprove(record.id, 'approve')}>
                <Button size="small" type="link" icon={<CheckOutlined />}>通过</Button>
              </Popconfirm>
              <Popconfirm title="确认拒绝？" onConfirm={() => handleApprove(record.id, 'reject')}>
                <Button size="small" type="link" danger icon={<CloseOutlined />}>拒绝</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: 8, color: colors.neutral[900], fontWeight: 600 }}>
        <FileOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        表单实例流水线
      </Title>
      <Text type="secondary" style={{ marginBottom: spacing.md, display: 'block' }}>
        表单提交 → 审批 → 完成 全流程追踪
      </Text>

      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card>
            <Text type="secondary">实例总数</Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.primary[500] }}>{totalInstances}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">待审批</Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.warning[500] }}>{pendingCount}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">已通过</Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.success[500] }}>{approvedCount}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">已拒绝</Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.error[500] }}>{rejectedCount}</div>
          </Card>
        </Col>
      </Row>

      <Card
        title="实例列表"
        extra={
          <Space>
            <Select
              style={{ width: 140 }}
              value={selectedForm}
              onChange={setSelectedForm}
              allowClear
              placeholder="选择表单"
            >
              {forms.map((f) => (
                <Option key={f.id} value={f.id}>{f.name}</Option>
              ))}
            </Select>
            <Select
              style={{ width: 120 }}
              value={status}
              onChange={setStatus}
              allowClear
              placeholder="状态"
            >
              <Option value="submitted">已提交</Option>
              <Option value="approved">已批准</Option>
              <Option value="rejected">已拒绝</Option>
            </Select>
            <Button icon={<ReloadOutlined />} size="small" onClick={loadInstances} loading={loading}>刷新</Button>
            <Button type="primary" icon={<SendOutlined />} onClick={() => {
              submitForm.resetFields();
              setSubmitModalOpen(true);
            }}>提交实例</Button>
          </Space>
        }
      >
        {instances.length === 0 ? (
          <Empty description="暂无表单实例" />
        ) : (
          <Table
            columns={columns}
            dataSource={instances}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            size="small"
          />
        )}
      </Card>

      <Modal
        title="提交表单实例"
        open={submitModalOpen}
        onCancel={() => setSubmitModalOpen(false)}
        onOk={() => submitForm.submit()}
        width={600}
      >
        <Form form={submitForm} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="formId" label="选择表单" rules={[{ required: true }]}>
            <Select>
              {forms.map((f) => (
                <Option key={f.id} value={f.id}>{f.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="data" label="表单数据 (JSON)" rules={[{ required: true }]}>
            <TextArea
              rows={6}
              placeholder='{"name": "example", "value": 123}'
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="实例详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
        width={600}
      >
        {selectedInstance && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="实例 ID">{selectedInstance.id}</Descriptions.Item>
            <Descriptions.Item label="表单 ID">{selectedInstance.formId}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={STATUS_CONFIG[selectedInstance.status]?.color}>
                {STATUS_CONFIG[selectedInstance.status]?.label || selectedInstance.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="提交者">{selectedInstance.submittedBy}</Descriptions.Item>
            <Descriptions.Item label="审批人">{selectedInstance.approvedBy || '-'}</Descriptions.Item>
            <Descriptions.Item label="提交时间">
              {selectedInstance.submittedAt ? new Date(selectedInstance.submittedAt).toLocaleString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="审批时间">
              {selectedInstance.approvedAt ? new Date(selectedInstance.approvedAt).toLocaleString() : '-'}
            </Descriptions.Item>
            {selectedInstance.data && (
              <Descriptions.Item label="数据">
                <pre style={{ margin: 0, fontSize: 12, maxHeight: 200, overflow: 'auto', background: themeVars.bgSecondary, padding: 8, borderRadius: 4 }}>
                  {JSON.stringify(selectedInstance.data, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default FormInstancePipeline;