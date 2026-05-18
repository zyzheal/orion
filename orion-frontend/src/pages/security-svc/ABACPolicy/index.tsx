/**
 * ABAC Policy Management Page
 * 策略管理界面
 */

import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, Modal, Form, Input, Select, Switch, message, Drawer } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getAllPolicies, createPolicy, updatePolicy, deletePolicy, togglePolicy, type AbacPolicy } from '@/api/abac-policy';

const { TextArea } = Input;
const { Option } = Select;

const ABACPolicyManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [policies, setPolicies] = useState<AbacPolicy[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<AbacPolicy | null>(null);
  const [form] = Form.useForm();

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const res = await getAllPolicies();
      setPolicies(res.data);
    } catch (err: any) {
      message.error('获取策略失败: ' + (err.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await createPolicy(values);
      message.success('策略创建成功');
      setModalOpen(false);
      form.resetFields();
      fetchPolicies();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('创建失败: ' + (err.message || '未知错误'));
    }
  };

  const handleUpdate = async () => {
    if (!selectedPolicy) return;
    try {
      const values = await form.validateFields();
      await updatePolicy(selectedPolicy.id, values);
      message.success('策略更新成功');
      setModalOpen(false);
      form.resetFields();
      setSelectedPolicy(null);
      fetchPolicies();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('更新失败: ' + (err.message || '未知错误'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePolicy(id);
      message.success('策略删除成功');
      fetchPolicies();
    } catch (err: any) {
      message.error('删除失败: ' + (err.message || '未知错误'));
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await togglePolicy(id);
      message.success('策略状态已切换');
      fetchPolicies();
    } catch (err: any) {
      message.error('切换失败: ' + (err.message || '未知错误'));
    }
  };

  const openEdit = (policy: AbacPolicy) => {
    setSelectedPolicy(policy);
    form.setFieldsValue(policy);
    setModalOpen(true);
  };

  const openDetail = (policy: AbacPolicy) => {
    setSelectedPolicy(policy);
    setDrawerOpen(true);
  };

  const columns: ColumnsType<AbacPolicy> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (val, record) => (
        <Space>
          <span>{val}</span>
          <InfoCircleOutlined onClick={() => openDetail(record)} style={{ cursor: 'pointer', color: '#1890ff' }} />
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '资源类型',
      dataIndex: 'resourceType',
      key: 'resourceType',
      width: 120,
      render: (val) => <Tag color="blue">{Array.isArray(val) ? val.join(', ') : val}</Tag>,
    },
    {
      title: '操作类型',
      dataIndex: 'actionType',
      key: 'actionType',
      width: 120,
      render: (val) => <Tag>{Array.isArray(val) ? val.join(', ') : val}</Tag>,
    },
    {
      title: '效果',
      dataIndex: 'effect',
      key: 'effect',
      width: 80,
      render: (val) => <Tag color={val === 'allow' ? 'green' : 'red'}>{val === 'allow' ? '允许' : '拒绝'}</Tag>,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      sorter: (a, b) => (a.priority || 0) - (b.priority || 0),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (val, record) => (
        <Switch checked={val} onChange={() => handleToggle(record.id)} checkedChildren="启用" unCheckedChildren="禁用" />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: AbacPolicy) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} disabled={record.id.startsWith('system-')}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="ABAC 策略管理" extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchPolicies}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setSelectedPolicy(null); form.resetFields(); setModalOpen(true); }}>新建策略</Button>
        </Space>
      }>
        <Table dataSource={policies} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal title={selectedPolicy ? '编辑策略' : '新建策略'} open={modalOpen} onOk={selectedPolicy ? handleUpdate : handleCreate} onCancel={() => { setModalOpen(false); form.resetFields(); setSelectedPolicy(null); }} width={600}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="策略名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input /></Form.Item>
          <Form.Item name="resourceType" label="资源类型" rules={[{ required: true }]}>
            <Select mode="multiple" placeholder="选择资源类型">
              <Option value="*">所有资源</Option>
              <Option value="pipeline">流水线</Option>
              <Option value="deployment">部署</Option>
              <Option value="cmdb">CMDB</Option>
              <Option value="user">用户</Option>
              <Option value="tenant">租户</Option>
            </Select>
          </Form.Item>
          <Form.Item name="actionType" label="操作类型" rules={[{ required: true }]}>
            <Select mode="multiple" placeholder="选择操作类型">
              <Option value="*">所有操作</Option>
              <Option value="read">读取</Option>
              <Option value="create">创建</Option>
              <Option value="update">更新</Option>
              <Option value="delete">删除</Option>
              <Option value="execute">执行</Option>
            </Select>
          </Form.Item>
          <Form.Item name="effect" label="效果" rules={[{ required: true }]}>
            <Select placeholder="选择效果"><Option value="allow">允许</Option><Option value="deny">拒绝</Option></Select>
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue={50}><Input type="number" /></Form.Item>
          <Form.Item name="conditions" label="条件 (JSON)"><TextArea rows={4} placeholder='{"condition": {"attribute": "user.role", "operator": "equals", "value": "admin"}}' /></Form.Item>
        </Form>
      </Modal>

      <Drawer title="策略详情" open={drawerOpen} onClose={() => setDrawerOpen(false)} width={500}>
        {selectedPolicy && (
          <>
            <p><strong>ID:</strong> {selectedPolicy.id}</p>
            <p><strong>名称:</strong> {selectedPolicy.name}</p>
            <p><strong>描述:</strong> {selectedPolicy.description || '-'}</p>
            <p><strong>资源类型:</strong> {Array.isArray(selectedPolicy.resourceType) ? selectedPolicy.resourceType.join(', ') : selectedPolicy.resourceType}</p>
            <p><strong>操作类型:</strong> {Array.isArray(selectedPolicy.actionType) ? selectedPolicy.actionType.join(', ') : selectedPolicy.actionType}</p>
            <p><strong>效果:</strong> {selectedPolicy.effect === 'allow' ? '允许' : '拒绝'}</p>
            <p><strong>优先级:</strong> {selectedPolicy.priority}</p>
            <p><strong>状态:</strong> {selectedPolicy.enabled ? '启用' : '禁用'}</p>
            <p><strong>条件:</strong></p>
            <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>{JSON.stringify(selectedPolicy.conditions, null, 2)}</pre>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default ABACPolicyManagement;