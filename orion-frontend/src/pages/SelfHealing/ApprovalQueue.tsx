/**
 * Self-Healing - Approval Queue
 * Pending approvals for self-healing actions
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
  Form,
  Input,
  Select,
  message,
  Radio,
} from 'antd';
import { CheckOutlined, CloseOutlined, ReloadOutlined, CheckCircleOutlined,} from '@ant-design/icons';
import { getApprovals, respondToApproval } from '@/api/self-healing';
import type { SelfHealingApproval } from '@/api/self-healing';
import dayjs from 'dayjs';
import { colors } from '@/tokens';

const { Title, Text } = Typography;
const { TextArea } = Input;

const ApprovalQueue: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SelfHealingApproval[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [respondModalOpen, setRespondModalOpen] = useState(false);
  const [currentApproval, setCurrentApproval] = useState<SelfHealingApproval | null>(null);
  const [respondForm] = Form.useForm();
  const [respondLoading, setRespondLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getApprovals({ status: statusFilter, page, pageSize });
      setData((res.data as any).items || []);
      setTotal((res.data as any).total || 0);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载审批队列失败：${error.message}`);
      } else {
        message.error('加载审批队列失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, pageSize, statusFilter]);

  const openRespondModal = (approval: SelfHealingApproval, action: 'approved' | 'rejected') => {
    setCurrentApproval(approval);
    respondForm.setFieldsValue({ action });
    setRespondModalOpen(true);
  };

  const handleRespond = async (values: { action: string; reason?: string }) => {
    if (!currentApproval) return;
    setRespondLoading(true);
    try {
      await respondToApproval(currentApproval.id, {
        action: values.action as 'approved' | 'rejected',
        reason: values.reason,
      });
      message.success('审批已提交');
      setRespondModalOpen(false);
      respondForm.resetFields();
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`提交审批失败：${error.message}`);
      } else {
        message.error('提交审批失败，请稍后重试');
      }
    } finally {
      setRespondLoading(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'green';
      case 'rejected':
        return 'red';
      case 'pending':
        return 'orange';
      default:
        return 'default';
    }
  };

  const statusText = (status: string) => {
    switch (status) {
      case 'approved':
        return '已批准';
      case 'rejected':
        return '已拒绝';
      case 'pending':
        return '待审批';
      default:
        return status;
    }
  };

  const columns = [
    { title: '审批 ID', dataIndex: 'id', key: 'id', width: 140, ellipsis: true },
    { title: '事件 ID', dataIndex: 'incidentId', key: 'incidentId', width: 140 },
    { title: '策略 ID', dataIndex: 'strategyId', key: 'strategyId', width: 140 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag color={statusColor(status)}>{statusText(status)}</Tag>,
    },
    {
      title: '审批人',
      dataIndex: 'respondedBy',
      key: 'respondedBy',
      width: 100,
      render: (text?: string) => text || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (ts: string) => dayjs(ts).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: SelfHealingApproval) => (
        <Space>
          {record.status === 'pending' && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => openRespondModal(record, 'approved')}
              >
                批准
              </Button>
              <Button
                danger
                size="small"
                icon={<CloseOutlined />}
                onClick={() => openRespondModal(record, 'rejected')}
              >
                拒绝
              </Button>
            </>
          )}
          {record.status !== 'pending' && (
            <Tag color={statusColor(record.status)}>{statusText(record.status)}</Tag>
          )}
        </Space>
      ),
    },
  ];

  const tableData = data.map((r) => ({ ...r, key: r.id }));

  const pendingCount = data.filter((r) => r.status === 'pending').length;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <CheckCircleOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            审批队列
          </Title>
          <Text type="secondary">
            待审批: <Tag color="orange">{pendingCount}</Tag>
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData}>
          刷新
        </Button>
      </div>

      {/* Filter */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Select
            placeholder="状态"
            allowClear
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
            style={{ width: 140 }}
          >
            <Select.Option value="pending">待审批</Select.Option>
            <Select.Option value="approved">已批准</Select.Option>
            <Select.Option value="rejected">已拒绝</Select.Option>
          </Select>
        </Space>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={tableData}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          size="small"
        />
      </Card>

      {/* Respond Modal */}
      <Modal
        title="审批响应"
        open={respondModalOpen}
        onCancel={() => setRespondModalOpen(false)}
        footer={null}
      >
        <Form form={respondForm} layout="vertical" onFinish={handleRespond}>
          <Form.Item
            name="action"
            label="审批结果"
            rules={[{ required: true, message: '请选择审批结果' }]}
          >
            <Radio.Group>
              <Radio.Button value="approved">批准</Radio.Button>
              <Radio.Button value="rejected">拒绝</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="reason" label="原因">
            <TextArea rows={3} placeholder="请输入审批原因..." />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={respondLoading} block>
              提交
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ApprovalQueue;
