/**
 * RDM state hook
 * 抽取自 index.tsx (P2-9 Phase 155)
 */
import { useCallback, useEffect, useState } from 'react';
import { Form, Modal, message } from 'antd';
import {
  Requirement,
  CreateRequirementInput,
  Defect,
  Sprint,
  Task,
  listRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  listDefects,
  createDefect,
  updateDefect,
  deleteDefect,
  listSprints,
  createSprint,
  updateSprint,
  deleteSprint,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
} from '@/api/rdm';
import { listUsers, type User } from '@/api/users';
import type { EntityType, TabKey } from './types';

export function useRDMState() {
  const [activeTab, setActiveTab] = useState<TabKey>('requirements');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form] = Form.useForm();

  // Data states
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await listUsers({ page: 1, limit: 100 });
      setUsers(res.data.data ?? []);
    } catch {
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'requirements': {
          const res = await listRequirements();
          setRequirements(res.data ?? []);
          break;
        }
        case 'defects': {
          const res = await listDefects();
          setDefects(res.data ?? []);
          break;
        }
        case 'sprints': {
          const res = await listSprints();
          setSprints(res.data ?? []);
          break;
        }
        case 'tasks': {
          const res = await listTasks();
          setTasks(res.data ?? []);
          break;
        }
      }
    } catch (err: any) {
      message.error(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = useCallback(() => {
    setEditingItem(null);
    form.resetFields();
    setModalOpen(true);
  }, [form]);

  const handleEdit = useCallback(
    (record: any) => {
      setEditingItem(record);
      form.setFieldsValue(record);
      setModalOpen(true);
    },
    [form],
  );

  const handleDelete = useCallback(
    (id: string) => {
      Modal.confirm({
        title: '确认删除',
        content: '删除后不可恢复，确定要删除吗？',
        okText: '确认',
        cancelText: '取消',
        onOk: async () => {
          try {
            switch (activeTab) {
              case 'requirements':
                await deleteRequirement(id);
                break;
              case 'defects':
                await deleteDefect(id);
                break;
              case 'sprints':
                await deleteSprint(id);
                break;
              case 'tasks':
                await deleteTask(id);
                break;
            }
            message.success('删除成功');
            fetchData();
          } catch (err: any) {
            message.error(err?.message || '删除失败');
          }
        },
      });
    },
    [activeTab, fetchData],
  );

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        switch (activeTab) {
          case 'requirements':
            await updateRequirement(editingItem.id, values);
            break;
          case 'defects':
            await updateDefect(editingItem.id, values);
            break;
          case 'sprints':
            await updateSprint(editingItem.id, values);
            break;
          case 'tasks':
            await updateTask(editingItem.id, values);
            break;
        }
        message.success('更新成功');
      } else {
        switch (activeTab) {
          case 'requirements':
            await createRequirement(values as CreateRequirementInput);
            break;
          case 'defects':
            await createDefect(values);
            break;
          case 'sprints':
            await createSprint(values);
            break;
          case 'tasks':
            await createTask(values);
            break;
        }
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      if (err?.message) message.error(err.message);
    }
  }, [form, editingItem, activeTab, fetchData]);

  const getEntityName = useCallback((): EntityType => {
    switch (activeTab) {
      case 'requirements':
        return 'requirement';
      case 'defects':
        return 'defect';
      case 'sprints':
        return 'sprint';
      case 'tasks':
        return 'task';
    }
  }, [activeTab]);

  return {
    activeTab,
    setActiveTab,
    loading,
    modalOpen,
    setModalOpen,
    editingItem,
    form,
    requirements,
    defects,
    sprints,
    tasks,
    users,
    fetchData,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSubmit,
    getEntityName,
  };
}

export type RDMState = ReturnType<typeof useRDMState>;
