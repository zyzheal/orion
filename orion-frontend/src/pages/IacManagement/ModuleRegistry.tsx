/**
 * IaC Module Registry - Module browser, search, version management
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
} from 'antd';
import { spacing } from '@/tokens';
import { PlusOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getModules,
  createModule,
  deleteModule,
  type IaCModule,
  type ModuleInput,
} from '@/api/iac';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const providerOptions = [
  { label: '全部', value: 'all' },
  { label: 'AWS', value: 'aws' },
  { label: 'Azure', value: 'azure' },
  { label: 'GCP', value: 'gcp' },
  { label: 'Kubernetes', value: 'kubernetes' },
  { label: '通用', value: 'generic' },
];

const ModuleRegistry: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [modules, setModules] = useState<IaCModule[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getModules();
      setModules(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to load modules：${error.message}`);
      } else {
        message.error('Failed to load modules');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredModules = useMemo(() => {
    return modules.filter((mod) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!mod.name.toLowerCase().includes(q) && !mod.description.toLowerCase().includes(q))
          return false;
      }
      if (filters.provider && filters.provider !== 'all' && mod.provider !== filters.provider)
        return false;
      return true;
    });
  }, [searchQuery, filters, modules]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload: ModuleInput = {
        name: values.name,
        description: values.description,
        provider: values.provider,
        version: values.version || '1.0.0',
        source: values.source,
        config: values.config,
      };
      await createModule(payload);
      message.success('模块注册成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        const msg = error instanceof Error ? error.message : '注册失败';
        message.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteModule(id);
      message.success('模块已删除');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败：${error.message}`);
      } else {
        message.error('删除失败');
      }
    }
  };

  const columns: TableColumn<IaCModule>[] = [
    {
      key: 'name',
      title: '模块名称',
      dataIndex: 'name',
      width: 200,
      sortable: true,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'description',
      title: '描述',
      dataIndex: 'description',
      width: 240,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {String(v)}
        </Text>
      ),
    },
    {
      key: 'provider',
      title: 'Provider',
      dataIndex: 'provider',
      width: 120,
      render: (v: unknown) => <Tag color="blue">{String(v)}</Tag>,
    },
    {
      key: 'versions',
      title: '版本',
      dataIndex: 'versions',
      width: 160,
      render: (v: unknown) => (
        <Space size={4} wrap>
          {Array.isArray(v) ? (
            v.slice(-3).map((ver) => <Tag key={ver}>{ver}</Tag>)
          ) : (
            <Tag>{String(v)}</Tag>
          )}
        </Space>
      ),
    },
    {
      key: 'source',
      title: '来源',
      dataIndex: 'source',
      width: 200,
      render: (v: unknown) => (
        <Text code style={{ fontSize: spacing[3] }}>
          {String(v)}
        </Text>
      ),
    },
    {
      key: 'downloadCount',
      title: '下载量',
      dataIndex: 'downloadCount',
      width: 100,
      sortable: true,
      render: (v: unknown) => <Text>{String(v)}</Text>,
    },
    {
      key: 'createdAt',
      title: '注册时间',
      dataIndex: 'createdAt',
      width: 160,
      sortable: true,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(v)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 120,
      render: (_: unknown, record: any) => (
        <Space size="small">
          <Button type="link" size="small">
            查看
          </Button>
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const filterDefs: FilterDefinition[] = [
    { key: 'provider', label: 'Provider', options: providerOptions },
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
          <Title level={2} style={{ marginBottom: 8 }}>
            <BlockOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            模块注册
          </Title>
          <Text type="secondary">IaC 模块浏览与版本管理</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            注册模块
          </Button>
        </Space>
      </div>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={filterDefs}
            searchPlaceholder="搜索模块..."
          />
        </div>
        <Table
          columns={columns}
          dataSource={filteredModules}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="注册模块"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="模块名称" rules={[{ required: true }]}>
            <Input placeholder="vpc-module" />
          </Form.Item>
          <Form.Item name="description" label="描述" rules={[{ required: true }]}>
            <Input placeholder="VPC 网络模块" />
          </Form.Item>
          <Form.Item name="provider" label="Provider" rules={[{ required: true }]}>
            <Select options={providerOptions.slice(1)} />
          </Form.Item>
          <Form.Item name="version" label="版本" initialValue="1.0.0">
            <Input placeholder="1.0.0" />
          </Form.Item>
          <Form.Item name="source" label="来源" rules={[{ required: true }]}>
            <Input placeholder="git::https://..." />
          </Form.Item>
          <Form.Item name="config" label="配置">
            <Input.TextArea rows={3} placeholder="模块配置..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ModuleRegistry;
