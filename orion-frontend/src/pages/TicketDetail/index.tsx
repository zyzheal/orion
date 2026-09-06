/**
 * TicketDetail Page
 * - 布局编排: Header + 两列布局 + Modals
 * - 4 Form.useForm + 4 wrapper handlers + hook 委托
 * 抽取自 773 行原始文件 (P2-9 Phase 58)
 */
import React from 'react';
import { Form, Row, Col, Result, Button } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useTicketDetailState } from './useTicketDetailState';
import { TicketHeader } from './TicketHeader';
import { TicketMainColumn } from './TicketMainColumn';
import { TicketSidebar } from './TicketSidebar';
import { TicketDetailModals } from './TicketDetailModals';
import type { AssignValues, ResolveValues, TransferValues, EscalateValues } from './types';

const TicketDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [assignForm] = Form.useForm();
  const [escalateForm] = Form.useForm();
  const [resolveForm] = Form.useForm();
  const [transferForm] = Form.useForm();

  const {
    ticket,
    engineers,
    relations,
    transfers,
    history,
    sla,
    assignModalOpen, setAssignModalOpen,
    escalateModalOpen, setEscalateModalOpen,
    resolveModalOpen, setResolveModalOpen,
    transferModalOpen, setTransferModalOpen,
    canAssign, canEscalate, canResolve, canClose, canTransfer,
    handleAssign,
    handleEscalate,
    handleResolve,
    handleTransfer,
    handleClose,
  } = useTicketDetailState(id);

  // --- Form wrapper handlers (validateFields → call hook handler → resetFields) ---

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

  // --- 404 guard ---
  if (!ticket) {
    return (
      <Result
        status="404"
        title="工单不存在"
        subTitle={`未找到工单 ${id}`}
        extra={
          <Button type="primary" onClick={() => navigate('/tickets')}>
            返回工单列表
          </Button>
        }
        data-testid="ticket-not-found"
      />
    );
  }

  return (
    <div style={{ padding: 0 }} data-testid="ticket-detail-page">
      <TicketHeader
        ticket={ticket}
        canAssign={canAssign}
        canEscalate={canEscalate}
        canResolve={canResolve}
        canClose={canClose}
        canTransfer={canTransfer}
        onBack={() => navigate('/tickets')}
        onAssign={() => setAssignModalOpen(true)}
        onEscalate={() => setEscalateModalOpen(true)}
        onResolve={() => setResolveModalOpen(true)}
        onClose={handleClose}
        onTransfer={() => setTransferModalOpen(true)}
      />

      <Row gutter={24}>
        <Col span={16}>
          <TicketMainColumn
            ticket={ticket}
            sla={sla}
            relations={relations}
            transfers={transfers}
            onNavigate={navigate}
          />
        </Col>
        <Col span={8}>
          <TicketSidebar ticket={ticket} history={history} />
        </Col>
      </Row>

      <TicketDetailModals
        assignModalOpen={assignModalOpen}
        setAssignModalOpen={setAssignModalOpen}
        assignForm={assignForm}
        escalateModalOpen={escalateModalOpen}
        setEscalateModalOpen={setEscalateModalOpen}
        escalateForm={escalateForm}
        resolveModalOpen={resolveModalOpen}
        setResolveModalOpen={setResolveModalOpen}
        resolveForm={resolveForm}
        transferModalOpen={transferModalOpen}
        setTransferModalOpen={setTransferModalOpen}
        transferForm={transferForm}
        engineers={engineers as any}
        handleAssign={handleAssignWrapper}
        handleEscalate={handleEscalateWrapper}
        handleResolve={handleResolveWrapper}
        handleTransfer={handleTransferWrapper}
      />
    </div>
  );
};

export default TicketDetail;
