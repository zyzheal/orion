/**
 * Multi-Cloud Management Page
 * Phase 4 - Cloud account management, resource tracking, cross-cloud deployment
 *
 * Features:
 * - Cloud account management
 * - Resource tracking across providers
 * - Cross-cloud deployment
 * - Cost comparison
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
} from 'antd';
import {
  CloudServerOutlined,
  PlusOutlined,
  ReloadOutlined,
  CloudOutlined,
} from '@ant-design/icons';
import {
  multiCloudApi,
  type CloudAccount,
  type CloudResource,
} from '@/api/multi-cloud';
import { colors } from '@/tokens';

const { Title, Text } = Typography;

const providerTypeColor: Record<string, string> = {
  aws: 'orange',
  azure: 'blue',
  gcp: 'red',
  aliyun: 'green',
  tencent: 'cyan',
};

const providerLabelMap: Record<string, string> = {
  aws: 'AWS',
  azure: 'Azure',
  gcp: 'Google Cloud',
  aliyun: '阿里云',
  tencent: '腾讯云',
};

const statusColorMap: Record<string, string> = {
  active: 'green',
  inactive: 'default',
  error: 'red',
};

const statusLabelMap: Record<string, string> = {
  active: '已连接',
  inactive: '未激活',
  error: '错误',
};

const MultiCloudPage: React.FC = () => {
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [resources, setResources] = useState<CloudResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accountsRes, resourcesRes] = await Promise.allSettled([
        multiCloudApi.listCloudAccounts(),
        multiCloudApi.listCloudResources(),
      ]);
      if (accountsRes.status === 'fulfilled') {
        setAccounts(Array.isArray(accountsRes.value) ? accountsRes.value : []);
      }
      if (resourcesRes.status === 'fulfilled') {
        setResources(Array.isArray(resourcesRes.value) ? resourcesRes.value : []);
      }
    } catch (error: unknown) {
      message.error(`加载多云数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      await multiCloudApi.registerCloudAccount({
        provider: values.provider,
        name: values.name,
        region: values.region,
        credentials: {},
      });
      message.success('云账号注册成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`注册失败: ${(error as Error).message}`);
    }
  };

  // Stats
  const stats = useMemo(() => ({
    total: accounts.length,
    active: accounts.filter((a) => a.status === 'active').length,
    error: accounts.filter((a) => a.status === 'error').length,
    resources: resources.length,
  }), [accounts, resources]);

  // Account columns
  const accountColumns = [
    {
      title: '账号名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
    },
    {
      title: '云厂商',
      dataIndex: 'provider',
      key: 'provider',
      width: 120,
      render: (v: string) => <Tag color={providerTypeColor[v] || 'default'}>{providerLabelMap[v] || v}</Tag>,
    },
    { title: '区域', dataIndex: 'region', key: 'region', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <Tag color={statusColorMap[v] || 'default'}>{statusLabelMap[v] || v}</Tag>,
    },
    {
      title: '资源数',
      key: 'resourceCount',
      width: 80,
      render: (_: unknown, record: CloudAccount) => resources.filter((r) => r.accountId === record.id).length,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
  ];

  // Resource columns
  const resourceColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 160 },
    {
      title: '云厂商',
      dataIndex: 'provider',
      key: 'provider',
      width: 100,
      render: (v: string) => <Tag>{providerLabelMap[v] || v}</Tag>,
    },
    { title: '类型', dataIndex: 'type', key: 'type', width: 120 },
    { title: '区域', dataIndex: 'region', key: 'region', width: 120 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
    {
      title: '标签',
      key: 'tags',
      width: 160,
      render: (_: unknown, record: CloudResource) =>
        record.tags ? Object.entries(record.tags).slice(0, 2).map(([k, v]) => <Tag key={k}>{k}: {v}</Tag>) : '-',
    },
  ];

  const tabItems = [
    {
      key: 'accounts',
      label: '云账号',
      children: (
        <Table
          columns={accountColumns}
          dataSource={accounts}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      ),
    },
    {
      key: 'resources',
      label: '云资源',
      children: (
        <Table
          columns={resourceColumns}
          dataSource={resources}
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
            <CloudOutlined style={{ marginRight: 8 }} />
            多云管理
          </Title>
          <Text type="secondary">管理多云账号、资源跟踪和跨云编排</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            添加云账号
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="云账号总数" value={stats.total} prefix={<CloudServerOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已连接" value={stats.active} valueStyle={{ color: colors.success[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="异常"
              value={stats.error}
              valueStyle={{ color: stats.error > 0 ? colors.error[400] : undefined }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="云资源总数" value={stats.resources} />
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Card>
        <Tabs items={tabItems} />
      </Card>

      {/* Create Modal */}
      <Modal
        title="添加云账号"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="账号名称" name="name" rules={[{ required: true, message: '请输入账号名称' }]}>
            <Input placeholder="如: AWS Production" />
          </Form.Item>
          <Form.Item label="云厂商" name="provider" rules={[{ required: true, message: '请选择云厂商' }]}>
            <Select
              options={[
                { value: 'aws', label: 'AWS' },
                { value: 'azure', label: 'Azure' },
                { value: 'gcp', label: 'Google Cloud' },
                { value: 'aliyun', label: '阿里云' },
                { value: 'tencent', label: '腾讯云' },
              ]}
            />
          </Form.Item>
          <Form.Item label="区域" name="region" rules={[{ required: true, message: '请输入区域' }]}>
            <Input placeholder="如: us-east-1" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MultiCloudPage;
