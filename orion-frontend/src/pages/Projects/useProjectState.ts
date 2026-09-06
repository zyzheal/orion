/**
 * useProjectState.ts - 项目管理状态 Hook
 * 抽取自 Projects/index.tsx (P2-9 Phase 83)
 */
import { useState, useEffect, useMemo } from 'react';
import { message, Form } from 'antd';
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  getProjectResources,
  type Project,
  type CreateProjectInput,
  type UpdateProjectInput,
  type ProjectResource,
} from '@/api/projects';

const splitCsv = (raw?: string): string[] | undefined =>
  raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

export const useProjectState = () => {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectResources, setProjectResources] = useState<ProjectResource[]>([]);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getProjects({ tenantId: 'tenant-1' });
      const data = res.data?.data;
      if (Array.isArray(data)) {
        setProjects(data);
      } else if (Array.isArray((data as unknown as { data?: unknown }).data)) {
        setProjects((data as unknown as { data: Project[] }).data);
      } else {
        setProjects([]);
      }
    } catch (error: unknown) {
      setProjects([]);
      message.error(`加载项目数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredData = useMemo(() => {
    return projects.filter((p) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !(p.description && p.description.toLowerCase().includes(q)) &&
          !(p.slug && p.slug.toLowerCase().includes(q))
        )
          return false;
      }
      if (filters.status && filters.status !== 'all' && p.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, projects]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload: CreateProjectInput = {
        name: values.name,
        tenantId: values.tenantId || 'tenant-1',
        description: values.description,
        teamLead: values.teamLead,
        teamMembers: splitCsv(values.teamMembers),
        environments: splitCsv(values.environments),
      };
      await createProject(payload);
      message.success('项目创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`创建失败：${error.message}`);
      } else {
        message.error('创建失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingProject) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      const payload: UpdateProjectInput = {
        name: values.name,
        description: values.description,
        teamLead: values.teamLead,
        teamMembers: splitCsv(values.teamMembers),
        environments: splitCsv(values.environments),
      };
      await updateProject(editingProject.id, payload);
      message.success('项目更新成功');
      setEditModalVisible(false);
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`更新失败：${error.message}`);
        } else {
          message.error('更新失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id);
      message.success('项目已删除');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败：${error.message}`);
      } else {
        message.error('删除失败');
      }
    }
  };

  const loadResources = async (projectId: string) => {
    try {
      const res = await getProjectResources(projectId);
      setProjectResources(Array.isArray(res.data) ? res.data : []);
    } catch {
      setProjectResources([]);
    }
  };

  const openEdit = (p: Project) => {
    setEditingProject(p);
    editForm.setFieldsValue({
      name: p.name,
      description: p.description,
      teamLead: p.teamLead,
      teamMembers: p.teamMembers?.join(', '),
      environments: p.environments?.join(', '),
    });
    setEditModalVisible(true);
  };

  const openDetail = async (p: Project) => {
    setSelectedProject(p);
    setDetailDrawerVisible(true);
    loadResources(p.id);
  };

  return {
    loading,
    projects,
    setSearchQuery,
    setFilters,
    createModalVisible,
    setCreateModalVisible,
    editModalVisible,
    setEditModalVisible,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedProject,
    projectResources,
    createForm,
    editForm,
    submitting,
    filteredData,
    loadData,
    handleCreate,
    handleEdit,
    handleDelete,
    openEdit,
    openDetail,
  };
};
