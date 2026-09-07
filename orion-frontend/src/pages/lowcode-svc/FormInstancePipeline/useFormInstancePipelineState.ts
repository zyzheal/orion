/**
 * FormInstancePipeline state hook
 * 抽取自 index.tsx (P2-9 Phase 176)
 */
import { useState, useEffect } from 'react';
import { Form, message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import {
  listInstances,
  getInstance,
  submitInstance,
  approveInstance,
  listForms,
  type FormInstance,
  type FormDefinition,
} from '@/api/lowcode';

export function useFormInstancePipelineState() {
  const [status, setStatus] = useState<string>('');
  const [selectedForm, setSelectedForm] = useState<string>('');

  // Submit modal
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitForm] = Form.useForm();

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<FormInstance | null>(null);

  const operator = localStorage.getItem('username') || 'system';

  const {
    data: instances = [] as FormInstance[],
    isLoading: loading,
    isError: instancesError,
    error: instancesQueryError,
    refetch: loadInstances,
  } = useQuery<FormInstance[]>({
    queryKey: ['form-instances', selectedForm, status],
    queryFn: async () => {
      const data = await listInstances(selectedForm || undefined, status || undefined);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30_000,
  });

  const {
    data: forms = [] as FormDefinition[],
    isError: formsError,
    error: formsQueryError,
  } = useQuery<FormDefinition[]>({
    queryKey: ['lowcode-forms'],
    queryFn: async () => {
      const data = await listForms();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30_000,
  });

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  useEffect(() => {
    if (!instancesError) return;
    message.error(
      instancesQueryError instanceof Error
        ? `加载实例列表失败：${instancesQueryError.message}`
        : '加载实例列表失败'
    );
  }, [instancesError, instancesQueryError]);
  useEffect(() => {
    if (!formsError) return;
    message.error(
      formsQueryError instanceof Error
        ? `加载表单列表失败：${formsQueryError.message}`
        : '加载表单列表失败'
    );
  }, [formsError, formsQueryError]);

  const handleSubmit = async (values: { formId: string; data: Record<string, unknown> }) => {
    setSubmitting(true);
    try {
      const formData: Record<string, unknown> = {};
      if (typeof values.data === 'string') {
        formData.json = JSON.parse(values.data);
      } else if (values.data) {
        formData.json = values.data;
      }
      await submitInstance(values.formId, { data: formData, submitBy: operator });
      message.success('表单实例提交成功');
      setSubmitModalOpen(false);
      submitForm.resetFields();
      loadInstances();
    } catch {
      message.error('提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string, action: 'approve' | 'reject') => {
    try {
      await approveInstance(id, action, operator);
      message.success(action === 'approve' ? '审批通过' : '审批拒绝');
      loadInstances();
    } catch {
      message.error('操作失败');
    }
  };

  const handleViewDetail = async (inst: FormInstance) => {
    try {
      const data = await getInstance(inst.id);
      setSelectedInstance(data || inst);
      setDetailOpen(true);
    } catch {
      setSelectedInstance(inst);
      setDetailOpen(true);
    }
  };

  const openSubmitModal = () => {
    submitForm.resetFields();
    setSubmitModalOpen(true);
  };

  const totalInstances = instances.length;
  const approvedCount = instances.filter((i) => i.status === 'approved').length;
  const pendingCount = instances.filter(
    (i) => i.status === 'submitted' || i.status === 'pending'
  ).length;
  const rejectedCount = instances.filter((i) => i.status === 'rejected').length;

  return {
    // data
    instances,
    forms,
    loading,
    selectedForm,
    setSelectedForm,
    status,
    setStatus,
    selectedInstance,
    // modals
    submitModalOpen,
    setSubmitModalOpen,
    submitting,
    submitForm,
    detailOpen,
    setDetailOpen,
    // counts
    totalInstances,
    approvedCount,
    pendingCount,
    rejectedCount,
    // actions
    loadInstances,
    handleSubmit,
    handleApprove,
    handleViewDetail,
    openSubmitModal,
  };
}
