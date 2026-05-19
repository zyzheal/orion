/**
 * Project Member Management Page
 * 项目成员管理界面
 */

import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, Modal, Form, Input, Select, message } from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getProjectMembers, addProjectMember, removeProjectMember, type ProjectMember } from '@/api/project-member';

const { Option } = Select;

interface Props {
  projectId?: string;
}

const ProjectMemberManagement: React.FC<Props> = ({ projectId: propProjectId }) => {
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [projectId, setProjectId] = useState(propProjectId || 'default-project');
  const [form] = Form.useForm();

  const fetchMembers = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await getProjectMembers(projectId);
      setMembers(res.data);
    } catch (err: any) {
      message.error('获取成员失败: ' + (err.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchMembers();
  }, [projectId]);

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      await addProjectMember(projectId, values.userId, values.role);
      message.success('成员添加成功');
      setModalOpen(false);
      form.resetFields();
      fetchMembers();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('添加失败: ' + (err.message || '未知错误'));
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await removeProjectMember(projectId, userId);
      message.success('成员移除成功');
      fetchMembers();
    } catch (err: any) {
      message.error('移除失败: ' + (err.message || '未知错误'));
    }
  };

  const columns: ColumnsType<ProjectMember> = [
    {
      title: '用户ID',
      dataIndex: 'user_id',
      key: 'user_id',
      render: (val) => (
        <Space>
          <UserOutlined />
          <span>{val}</span>
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (val) => {
        const colorMap: Record<string, string> = {
          admin: 'red',
          developer: 'blue',
          viewer: 'green',
          approver: 'orange',
        };
        return <Tag color={colorMap[val] || 'default'}>{val}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: ProjectMember) => (
        <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleRemove(record.user_id)}>
          移除
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="项目成员管理"
        extra={
          <Space>
            <Input.Search
              placeholder="输入项目ID"
              defaultValue={projectId}
              onSearch={(val) => { setProjectId(val); }}
              style={{ width: 200 }}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchMembers}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>添加成员</Button>
          </Space>
        }
      >
        <Table dataSource={members} columns={columns} rowKey="user_id" loading={loading} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal title="添加项目成员" open={modalOpen} onOk={handleAdd} onCancel={() => { setModalOpen(false); form.resetFields(); }}>
        <Form form={form} layout="vertical">
          <Form.Item name="userId" label="用户ID" rules={[{ required: true, message: '请输入用户ID' }]}>
            <Input placeholder="请输入用户ID" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select placeholder="选择角色">
              <Option value="admin">管理员</Option>
              <Option value="developer">开发者</Option>
              <Option value="viewer">查看者</Option>
              <Option value="approver">审批者</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectMemberManagement;