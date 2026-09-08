/**
 * useProblemHandlers.tsx - Problem 表单校验包装器 handlers
 * 抽取自 index.tsx (P2-9 Phase 233)
 *
 * 将 5 个 form.validateFields() + state hook handler + resetFields 包装器
 * 从 index.tsx 中抽离，让 index.tsx 更聚焦于组合层
 */
import { Form } from 'antd';
import { useProblemState } from './useProblemState';
import type { KnownError, Problem } from '@/api/problem';

interface Props {
  state: ReturnType<typeof useProblemState>;
  createForm: ReturnType<typeof Form.useForm>[0];
  editForm: ReturnType<typeof Form.useForm>[0];
  linkForm: ReturnType<typeof Form.useForm>[0];
  kedbForm: ReturnType<typeof Form.useForm>[0];
  kedbEditForm: ReturnType<typeof Form.useForm>[0];
}

export function useProblemHandlers({
  state: s,
  createForm,
  editForm,
  linkForm,
  kedbForm,
  kedbEditForm,
}: Props) {
  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await s.handleCreate(values);
      createForm.resetFields();
    } catch {}
  };

  const handleEdit = async () => {
    try {
      const values = await editForm.validateFields();
      await s.handleEdit(values);
      editForm.resetFields();
    } catch {}
  };

  const handleLinkIncident = async () => {
    try {
      const values = await linkForm.validateFields();
      await s.handleLinkIncident((values as any).id);
      linkForm.resetFields();
    } catch {}
  };

  const handleLinkChange = async () => {
    try {
      const values = await linkForm.validateFields();
      await s.handleLinkChange((values as any).id);
      linkForm.resetFields();
    } catch {}
  };

  const handleCreateKnownError = async () => {
    try {
      const values = await kedbForm.validateFields();
      await s.handleCreateKnownError(values);
      kedbForm.resetFields();
    } catch {}
  };

  const handleEditKnownError = async () => {
    try {
      const values = await kedbEditForm.validateFields();
      await s.handleEditKnownError(values);
      kedbEditForm.resetFields();
    } catch {}
  };

  const handleOpenEditModal = (problem: Problem) => {
    s.setSelectedProblem(problem);
    editForm.setFieldsValue({
      title: problem.title,
      description: problem.description,
      severity: problem.severity,
      category: problem.category,
      assigned_to: problem.assigned_to,
      root_cause: problem.root_cause,
      workaround: problem.workaround,
      resolution: problem.resolution,
    });
    s.setEditModalVisible(true);
  };

  const handleOpenKedbEditModal = (ke: KnownError) => {
    s.setEditingKnownError(ke);
    kedbEditForm.setFieldsValue({
      title: ke.title,
      description: ke.description,
      symptoms: ke.symptoms,
      root_cause: ke.root_cause,
      workaround: ke.workaround,
      keywords: ke.keywords?.join(', '),
      status: ke.status,
    });
    s.setKedbEditModalVisible(true);
  };

  return {
    handleCreate,
    handleEdit,
    handleLinkIncident,
    handleLinkChange,
    handleCreateKnownError,
    handleEditKnownError,
    handleOpenEditModal,
    handleOpenKedbEditModal,
  };
}
