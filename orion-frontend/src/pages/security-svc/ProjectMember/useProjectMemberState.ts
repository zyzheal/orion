import { useState, useEffect, useCallback } from 'react';
import { message, Form } from 'antd';
import {
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
  type ProjectMember,
} from '@/api/project-member';

export function useProjectMemberState(propProjectId?: string) {
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [projectId, setProjectId] = useState(propProjectId || 'default-project');
  const [form] = Form.useForm();

  const fetchMembers = useCallback(async () => {
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
  }, [projectId]);

  useEffect(() => {
    if (projectId) fetchMembers();
  }, [projectId, fetchMembers]);

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

  return {
    loading, members, modalOpen, setModalOpen,
    projectId, setProjectId, form,
    fetchMembers, handleAdd, handleRemove,
  };
}

export type ProjectMemberState = ReturnType<typeof useProjectMemberState>;
