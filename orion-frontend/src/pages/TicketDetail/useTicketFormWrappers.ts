import { useCallback, useState } from 'react';
import { Form } from 'antd';
import type { AssignValues, EscalateValues, ResolveValues, TransferValues } from './types';

interface Props {
  handleAssign: (v: AssignValues) => Promise<void>;
  handleEscalate: (v: EscalateValues) => Promise<void>;
  handleResolve: (v: ResolveValues) => Promise<void>;
  handleTransfer: (v: TransferValues) => Promise<void>;
}

export function useTicketFormWrappers({ handleAssign, handleEscalate, handleResolve, handleTransfer }: Props) {
  const [assignForm] = Form.useForm();
  const [escalateForm] = Form.useForm();
  const [resolveForm] = Form.useForm();
  const [transferForm] = Form.useForm();

  const [assignLoading, setAssignLoading] = useState(false);
  const [escalateLoading, setEscalateLoading] = useState(false);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);

  const handleAssignWrapper = useCallback(async () => {
    try {
      const values = await assignForm.validateFields();
      setAssignLoading(true);
      await handleAssign(values as AssignValues);
      assignForm.resetFields();
    } catch {
      // validation error or hook already showed error
    } finally {
      setAssignLoading(false);
    }
  }, [assignForm, handleAssign]);

  const handleEscalateWrapper = useCallback(async () => {
    try {
      const values = await escalateForm.validateFields();
      setEscalateLoading(true);
      await handleEscalate(values as EscalateValues);
      escalateForm.resetFields();
    } catch {
      // validation error
    } finally {
      setEscalateLoading(false);
    }
  }, [escalateForm, handleEscalate]);

  const handleResolveWrapper = useCallback(async () => {
    try {
      const values = await resolveForm.validateFields();
      setResolveLoading(true);
      await handleResolve(values as ResolveValues);
      resolveForm.resetFields();
    } catch {
      // validation error or hook already showed error
    } finally {
      setResolveLoading(false);
    }
  }, [resolveForm, handleResolve]);

  const handleTransferWrapper = useCallback(async () => {
    try {
      const values = await transferForm.validateFields();
      setTransferLoading(true);
      await handleTransfer(values as TransferValues);
      transferForm.resetFields();
    } catch {
      // validation error or hook already showed error
    } finally {
      setTransferLoading(false);
    }
  }, [transferForm, handleTransfer]);

  return {
    assignForm, escalateForm, resolveForm, transferForm,
    assignLoading, escalateLoading, resolveLoading, transferLoading,
    handleAssignWrapper, handleEscalateWrapper, handleResolveWrapper, handleTransferWrapper,
  };
}

export type TicketFormWrappers = ReturnType<typeof useTicketFormWrappers>;
