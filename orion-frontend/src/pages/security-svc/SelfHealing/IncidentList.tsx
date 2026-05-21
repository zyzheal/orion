/**
 * Self-Healing - Incident List
 * Active incident management and monitoring
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  Input,
  Select,
  Modal,
  Form,
  message,
} from 'antd';
import { PlusOutlined, ReloadOutlined, EyeOutlined, UnorderedListOutlined,} from '@ant-design/icons';
import { getHealingHistory, createIncident } from '@/api/self-healing';
import type { SelfHealingIncident } from '@/api/self-healing';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const IncidentList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SelfHealingIncident[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<{ severity?: string; status?: string }>({});
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [createLoading, setCreateLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getHealingHistory({ ...filters, page, pageSize });
      setData(res.data.data?.items || []);
      setTotal(res.data.data?.total || 0);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载事件列表失败：${error.message}`);
      } else {
        message.error('加载事件列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, pageSize, filters]);

  const handleCreate = async (values: any) => {
    setCreateLoading(true);
    try {
      await createIncident(values);
      message.success('事件已创建');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`创建事件失败：${error.message}`);
      } else {
        message.error('创建事件失败，请稍后重试');
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'red';
      case 'warning':
        return 'orange';
      case 'info':
        return 'blue';
      default:
        return 'default';
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'green';
      case 'healing':
        return 'blue';
      case 'pending':
        return 'orange';
      case 'failed':
        return 'red';
      default:
        return 'default';
    }
  };

  const columns = [
    { title: '事件 ID', dataIndex: 'id', key: 'id', width: 120, ellipsis: true },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: string) => <Tag color={severityColor(severity)}>{severity}</Tag>,
    },
    { title: '应用', dataIndex: 'appName', key: 'appName', width: 150 },
    { title: '环境', dataIndex: 'environment', key: 'environment', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag color={statusColor(status)}>{status}</Tag>,
    },
    {
      title: '策略',
      dataIndex: 'strategy',
      key: 'strategy',
      width: 120,
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
      width: 100,
      render: (_: any, record: SelfHealingIncident) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/self-healing/incidents/${record.id}`)}
        >
          详情
        </Button>
      ),
    },
  ];

  const tableData = data.map((r) => ({ ...r, key: r.id }));

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <UnorderedListOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            事件列表
          </Title>
          <Text type="secondary">管理自愈合事件</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          创建事件
        </Button>
      </div>

      {/* Filter Bar */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="严重程度"
            allowClear
            value={filters.severity}
            onChange={(value) => {
              setFilters({ ...filters, severity: value });
              setPage(1);
            }}
            style={{ width: 140 }}
          >
            <Select.Option value="critical">Critical</Select.Option>
            <Select.Option value="warning">Warning</Select.Option>
            <Select.Option value="info">Info</Select.Option>
          </Select>
          <Select
            placeholder="状态"
            allowClear
            value={filters.status}
            onChange={(value) => {
              setFilters({ ...filters, status: value });
              setPage(1);
            }}
            style={{ width: 140 }}
          >
            <Select.Option value="pending">待处理</Select.Option>
            <Select.Option value="healing">修复中</Select.Option>
            <Select.Option value="resolved">已解决</Select.Option>
            <Select.Option value="failed">修复失败</Select.Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            刷新
          </Button>
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

      {/* Create Modal */}
      <Modal
        title="创建自愈合事件"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="type"
            label="事件类型"
            rules={[{ required: true, message: '请输入事件类型' }]}
          >
            <Input placeholder="例如：high-memory-usage" />
          </Form.Item>
          <Form.Item
            name="severity"
            label="严重程度"
            rules={[{ required: true, message: '请选择严重程度' }]}
          >
            <Select>
              <Select.Option value="critical">Critical</Select.Option>
              <Select.Option value="warning">Warning</Select.Option>
              <Select.Option value="info">Info</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="appName"
            label="应用名称"
            rules={[{ required: true, message: '请输入应用名称' }]}
          >
            <Input placeholder="例如：orion-api" />
          </Form.Item>
          <Form.Item
            name="environment"
            label="环境"
            rules={[{ required: true, message: '请输入环境' }]}
          >
            <Select>
              <Select.Option value="production">Production</Select.Option>
              <Select.Option value="staging">Staging</Select.Option>
              <Select.Option value="development">Development</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="strategyId" label="关联策略">
            <Input placeholder="可选策略 ID" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={createLoading} block>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default IncidentList;
