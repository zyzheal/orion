/**
 * TicketDetail Page
 * - 布局编排: Header + 两列布局 + Modals
 * - 4 Form.useForm + 4 wrapper handlers + hook 委托
 *
 * P2-9 Phase 270 refactor: 已抽取 useTicketFormWrappers (4 Form useForm + 4 wrapper handlers)
 * + Components/TicketNotFound (404 Result)
 */
import React from 'react';
import { Row, Col } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useTicketDetailState } from './useTicketDetailState';
import { useTicketFormWrappers } from './useTicketFormWrappers';
import { TicketHeader } from './TicketHeader';
import { TicketMainColumn } from './TicketMainColumn';
import { TicketSidebar } from './TicketSidebar';
import { TicketDetailModals } from './TicketDetailModals';
import { TicketNotFound } from './Components/TicketNotFound';

const TicketDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

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

  const {
    assignForm, escalateForm, resolveForm, transferForm,
    handleAssignWrapper, handleEscalateWrapper, handleResolveWrapper, handleTransferWrapper,
  } = useTicketFormWrappers({ handleAssign, handleEscalate, handleResolve, handleTransfer });

  // --- 404 guard ---
  if (!ticket) {
    return <TicketNotFound id={id} onBack={() => navigate('/tickets')} />;
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
