/**
 * Change Management - form wrapper hook
 * 抽取自 index.tsx (P2-9 Phase 160)
 *
 * 10 个 wrapper: validateFields + resetFields + call hook handler
 */
import { useCallback } from 'react';
import { Form } from 'antd';
import dayjs from 'dayjs';
import type { ChangeRequest, RFC, CABMeeting } from '@/api/change';
import type {
  CreateChangeInput,
  TimelineEventInput,
  CreateRfcInput,
  CreateCabInput,
  AddDecisionInput,
} from './useChangeManagementState';

export function useChangeFormWrappers(deps: {
  handleCreate: (values: CreateChangeInput) => Promise<void>;
  handleEdit: (values: CreateChangeInput) => Promise<void>;
  handleConfirmStatusChange: (note: string) => Promise<void>;
  handleAddTimelineEvent: (values: TimelineEventInput) => Promise<void>;
  handleCreateRfc: (values: CreateRfcInput) => Promise<void>;
  handleUpdateRfc: (values: CreateRfcInput) => Promise<void>;
  handleCreateCab: (values: CreateCabInput) => Promise<void>;
  handleUpdateCab: (values: CreateCabInput) => Promise<void>;
  handleAddDecision: (values: AddDecisionInput) => Promise<void>;
  selectedChange: ChangeRequest | null;
  setCreateModalOpen: (v: boolean) => void;
  setEditModalOpen: (v: boolean) => void;
  setAddEventModalOpen: (v: boolean) => void;
  setStatusNoteModalOpen: (v: boolean) => void;
  setPendingStatusChange: (v: string) => void;
  setRfcModalOpen: (v: boolean) => void;
  setRfcDetailModalOpen: (v: boolean) => void;
  setSelectedRfc: (v: RFC | null) => void;
  setEditRfcId: (v: string | null) => void;
  setCabModalOpen: (v: boolean) => void;
  setCabDetailModalOpen: (v: boolean) => void;
  setEditCabId: (v: string | null) => void;
  setDecisionModalOpen: (v: boolean) => void;
}) {
  // 7 Form instances
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [eventForm] = Form.useForm();
  const [statusNoteForm] = Form.useForm();
  const [rfcForm] = Form.useForm();
  const [cabForm] = Form.useForm();
  const [decisionForm] = Form.useForm();

  const {
    handleCreate,
    handleEdit,
    handleConfirmStatusChange,
    handleAddTimelineEvent,
    handleCreateRfc,
    handleUpdateRfc,
    handleCreateCab,
    handleUpdateCab,
    handleAddDecision,
    selectedChange,
    setCreateModalOpen,
    setEditModalOpen,
    setAddEventModalOpen,
    setStatusNoteModalOpen,
    setPendingStatusChange,
    setRfcModalOpen,
    setSelectedRfc,
    setEditRfcId,
    setCabModalOpen,
    setEditCabId,
    setDecisionModalOpen,
  } = deps;

  const handleCreateWrapper = useCallback(async () => {
    try {
      const values = await createForm.validateFields();
      await handleCreate(values);
      createForm.resetFields();
    } catch {
      // form validation error - ignore
    }
  }, [createForm, handleCreate]);

  const handleEditWrapper = useCallback(async () => {
    try {
      const values = await editForm.validateFields();
      await handleEdit(values);
      editForm.resetFields();
    } catch {
      // form validation error - ignore
    }
  }, [editForm, handleEdit]);

  const handleOpenEditModalWrapper = useCallback(() => {
    if (!selectedChange) return;
    editForm.setFieldsValue({
      title: selectedChange.title,
      description: selectedChange.description,
      type: selectedChange.type,
      category: selectedChange.category,
      priority: selectedChange.priority,
      risk_level: selectedChange.risk_level,
      impact_description: selectedChange.impact_description,
      rollback_plan: selectedChange.rollback_plan,
      implementation_plan: selectedChange.implementation_plan,
      scheduled_start: selectedChange.scheduled_start
        ? dayjs(selectedChange.scheduled_start)
        : undefined,
      scheduled_end: selectedChange.scheduled_end ? dayjs(selectedChange.scheduled_end) : undefined,
      assigned_to: selectedChange.assigned_to,
      affected_services: selectedChange.affected_services?.join(', '),
    });
    setEditModalOpen(true);
  }, [selectedChange, editForm, setEditModalOpen]);

  const handleConfirmStatusChangeWrapper = useCallback(async () => {
    try {
      const values = await statusNoteForm.validateFields();
      await handleConfirmStatusChange(values.note);
      statusNoteForm.resetFields();
    } catch {
      // form validation error - ignore
    }
  }, [statusNoteForm, handleConfirmStatusChange]);

  const handleAddTimelineEventWrapper = useCallback(async () => {
    try {
      const values = await eventForm.validateFields();
      await handleAddTimelineEvent(values);
      eventForm.resetFields();
    } catch {
      // form validation error - ignore
    }
  }, [eventForm, handleAddTimelineEvent]);

  const handleCreateRfcWrapper = useCallback(async () => {
    try {
      const values = await rfcForm.validateFields();
      await handleCreateRfc(values);
      rfcForm.resetFields();
      setEditRfcId(null);
    } catch {
      // form validation error - ignore
    }
  }, [rfcForm, handleCreateRfc, setEditRfcId]);

  const handleUpdateRfcWrapper = useCallback(async () => {
    try {
      const values = await rfcForm.validateFields();
      await handleUpdateRfc(values);
      rfcForm.resetFields();
      setEditRfcId(null);
    } catch {
      // form validation error - ignore
    }
  }, [rfcForm, handleUpdateRfc, setEditRfcId]);

  const handleEditRfcWrapper = useCallback((record: RFC) => {
    setEditRfcId(record.id);
    rfcForm.setFieldsValue({
      change_request_id: record.change_request_id,
      justification: record.justification,
      risk_assessment: record.risk_assessment,
      test_plan: record.test_plan,
      communication_plan: record.communication_plan,
      backout_plan: record.backout_plan,
    });
    setRfcModalOpen(true);
  }, [rfcForm, setRfcModalOpen, setEditRfcId]);

  const handleCreateCabWrapper = useCallback(async () => {
    try {
      const values = await cabForm.validateFields();
      await handleCreateCab(values);
      cabForm.resetFields();
      setEditCabId(null);
    } catch {
      // form validation error - ignore
    }
  }, [cabForm, handleCreateCab, setEditCabId]);

  const handleUpdateCabWrapper = useCallback(async () => {
    try {
      const values = await cabForm.validateFields();
      await handleUpdateCab(values);
      cabForm.resetFields();
      setEditCabId(null);
    } catch {
      // form validation error - ignore
    }
  }, [cabForm, handleUpdateCab, setEditCabId]);

  const handleEditCabWrapper = useCallback((record: CABMeeting) => {
    setEditCabId(record.id);
    cabForm.setFieldsValue({
      title: record.title,
      description: record.description,
      scheduled_at: dayjs(record.scheduled_at),
      location: record.location,
      attendees: record.attendees?.join(', '),
    });
    setCabModalOpen(true);
  }, [cabForm, setCabModalOpen, setEditCabId]);

  const handleAddDecisionWrapper = useCallback(async () => {
    try {
      const values = await decisionForm.validateFields();
      await handleAddDecision(values);
      decisionForm.resetFields();
    } catch {
      // form validation error - ignore
    }
  }, [decisionForm, handleAddDecision]);

  // Openers (reset form + open modal)
  const openCreateModal = useCallback(() => {
    createForm.resetFields();
    setCreateModalOpen(true);
  }, [createForm, setCreateModalOpen]);

  const openAddEventModal = useCallback(() => {
    eventForm.resetFields();
    setAddEventModalOpen(true);
  }, [eventForm, setAddEventModalOpen]);

  const openRfcModal = useCallback(() => {
    rfcForm.resetFields();
    setEditRfcId(null);
    setRfcModalOpen(true);
  }, [rfcForm, setRfcModalOpen, setEditRfcId]);

  const openCabModal = useCallback(() => {
    cabForm.resetFields();
    setEditCabId(null);
    setCabModalOpen(true);
  }, [cabForm, setCabModalOpen, setEditCabId]);

  const openDecisionModal = useCallback(() => {
    decisionForm.resetFields();
    setDecisionModalOpen(true);
  }, [decisionForm, setDecisionModalOpen]);

  // Cancellers (close modal + reset form)
  const cancelCreateModal = useCallback(() => {
    setCreateModalOpen(false);
    createForm.resetFields();
  }, [createForm, setCreateModalOpen]);

  const cancelEditModal = useCallback(() => {
    setEditModalOpen(false);
    editForm.resetFields();
  }, [editForm, setEditModalOpen]);

  const cancelStatusModal = useCallback(() => {
    setStatusNoteModalOpen(false);
    statusNoteForm.resetFields();
    setPendingStatusChange('');
  }, [statusNoteForm, setStatusNoteModalOpen, setPendingStatusChange]);

  const cancelEventModal = useCallback(() => {
    setAddEventModalOpen(false);
    eventForm.resetFields();
  }, [eventForm, setAddEventModalOpen]);

  const cancelRfcModal = useCallback(() => {
    setRfcModalOpen(false);
    rfcForm.resetFields();
    setEditRfcId(null);
  }, [rfcForm, setRfcModalOpen, setEditRfcId]);

  const cancelRfcDetailModal = useCallback(() => {
    setSelectedRfc(null);
  }, [setSelectedRfc]);

  const cancelCabModal = useCallback(() => {
    setCabModalOpen(false);
    cabForm.resetFields();
    setEditCabId(null);
  }, [cabForm, setCabModalOpen, setEditCabId]);

  const cancelDecisionModal = useCallback(() => {
    setDecisionModalOpen(false);
    decisionForm.resetFields();
  }, [decisionForm, setDecisionModalOpen]);

  return {
    createForm,
    editForm,
    eventForm,
    statusNoteForm,
    rfcForm,
    cabForm,
    decisionForm,
    handleCreateWrapper,
    handleEditWrapper,
    handleOpenEditModalWrapper,
    handleConfirmStatusChangeWrapper,
    handleAddTimelineEventWrapper,
    handleCreateRfcWrapper,
    handleUpdateRfcWrapper,
    handleEditRfcWrapper,
    handleCreateCabWrapper,
    handleUpdateCabWrapper,
    handleEditCabWrapper,
    handleAddDecisionWrapper,
    openCreateModal,
    openAddEventModal,
    openRfcModal,
    openCabModal,
    openDecisionModal,
    cancelCreateModal,
    cancelEditModal,
    cancelStatusModal,
    cancelEventModal,
    cancelRfcModal,
    cancelRfcDetailModal,
    cancelCabModal,
    cancelDecisionModal,
  };
}
