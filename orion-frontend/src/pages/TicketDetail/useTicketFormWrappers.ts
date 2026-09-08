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

  const handleAssignWrapper = async () => {
    try {
      const values = await assignForm.validateFields();
      await handleAssign(values as AssignValues);
      assignForm.resetFields();
    } catch {
      // validation error or hook already showed error
    }
  };

  const handleEscalateWrapper = async () => {
    try {
      const values = await escalateForm.validateFields();
      await handleEscalate(values as EscalateValues);
      escalateForm.resetFields();
    } catch {
      // validation error
    }
  };

  const handleResolveWrapper = async () => {
    try {
      const values = await resolveForm.validateFields();
      await handleResolve(values as ResolveValues);
      resolveForm.resetFields();
    } catch {
      // validation error or hook already showed error
    }
  };

  const handleTransferWrapper = async () => {
    try {
      const values = await transferForm.validateFields();
      await handleTransfer(values as TransferValues);
      transferForm.resetFields();
    } catch {
      // validation error or hook already showed error
    }
  };

  return {
    assignForm, escalateForm, resolveForm, transferForm,
    handleAssignWrapper, handleEscalateWrapper, handleResolveWrapper, handleTransferWrapper,
  };
}

export type TicketFormWrappers = ReturnType<typeof useTicketFormWrappers>;
