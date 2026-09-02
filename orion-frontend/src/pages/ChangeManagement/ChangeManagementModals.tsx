/**
 * ChangeManagement Modals — all 8 modals extracted from index.tsx
 *
 * Wraps: Create/Edit Change, Status Change Note, Add Timeline Event,
 *         RFC Create/Edit, RFC Detail, CAB Create/Edit, CAB Detail, Decision
 */
import { Modal, Button, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { RFC, CABMeeting } from '@/api/change';
import { statusConfig } from './config';
import { ChangeForm } from './ChangeForm';
import { RFCForm } from './RFCForm';
import { CABForm } from './CABForm';
import { DecisionForm } from './DecisionForm';
import { StatusNoteForm } from './StatusNoteForm';
import { TimelineEventForm } from './TimelineEventForm';
import { RFCDetailContent } from './RFCDetailContent';
import { CABDetailContent } from './CABDetailContent';

interface ChangeManagementModalsProps {
  // Create Change
  createModalOpen: boolean;
  createForm: ReturnType<typeof import('antd').Form.useForm>[0];
  createSubmitting: boolean;
  onCreate: () => Promise<void>;
  onCreateCancel: () => void;
  // Edit Change
  editModalOpen: boolean;
  editForm: ReturnType<typeof import('antd').Form.useForm>[0];
  editSubmitting: boolean;
  onEdit: () => Promise<void>;
  onEditCancel: () => void;
  // Status Change Note
  statusNoteModalOpen: boolean;
  statusNoteForm: ReturnType<typeof import('antd').Form.useForm>[0];
  pendingStatusChange: string;
  onStatusConfirm: () => Promise<void>;
  onStatusCancel: () => void;
  // Add Timeline Event
  addEventModalOpen: boolean;
  eventForm: ReturnType<typeof import('antd').Form.useForm>[0];
  onEventAdd: () => Promise<void>;
  onEventCancel: () => void;
  // RFC Create/Edit
  rfcModalOpen: boolean;
  rfcForm: ReturnType<typeof import('antd').Form.useForm>[0];
  editRfcId: string | null;
  onCreateRfc: () => Promise<void>;
  onUpdateRfc: () => Promise<void>;
  onRfcCancel: () => void;
  // RFC Detail
  rfcDetailModalOpen: boolean;
  selectedRfc: RFC | null;
  onRfcDetailCancel: () => void;
  // CAB Create/Edit
  cabModalOpen: boolean;
  cabForm: ReturnType<typeof import('antd').Form.useForm>[0];
  editCabId: string | null;
  onCreateCab: () => Promise<void>;
  onUpdateCab: () => Promise<void>;
  onCabCancel: () => void;
  // CAB Detail
  cabDetailModalOpen: boolean;
  selectedCab: CABMeeting | null;
  onCabDetailCancel: () => void;
  onOpenDecision: () => void;
  // Decision
  decisionModalOpen: boolean;
  decisionForm: ReturnType<typeof import('antd').Form.useForm>[0];
  onDecisionAdd: () => Promise<void>;
  onDecisionCancel: () => void;
}

type FormInstance = ReturnType<typeof import('antd').Form.useForm>[0];

export function ChangeManagementModals({
  createModalOpen,
  createForm,
  createSubmitting,
  onCreate,
  onCreateCancel,
  editModalOpen,
  editForm,
  editSubmitting,
  onEdit,
  onEditCancel,
  statusNoteModalOpen,
  statusNoteForm,
  pendingStatusChange,
  onStatusConfirm,
  onStatusCancel,
  addEventModalOpen,
  eventForm,
  onEventAdd,
  onEventCancel,
  rfcModalOpen,
  rfcForm,
  editRfcId,
  onCreateRfc,
  onUpdateRfc,
  onRfcCancel,
  rfcDetailModalOpen,
  selectedRfc,
  onRfcDetailCancel,
  cabModalOpen,
  cabForm,
  editCabId,
  onCreateCab,
  onUpdateCab,
  onCabCancel,
  cabDetailModalOpen,
  selectedCab,
  onCabDetailCancel,
  onOpenDecision,
  decisionModalOpen,
  decisionForm,
  onDecisionAdd,
  onDecisionCancel,
}: ChangeManagementModalsProps) {
  return (
    <>
      <Modal
        title="新建变更请求"
        open={createModalOpen}
        onOk={onCreate}
        onCancel={onCreateCancel}
        width={720}
        okText="创建"
        cancelText="取消"
        confirmLoading={createSubmitting}
      >
        <ChangeForm formInstance={createForm as FormInstance} />
      </Modal>

      <Modal
        title="编辑变更请求"
        open={editModalOpen}
        onOk={onEdit}
        onCancel={onEditCancel}
        width={720}
        okText="保存"
        cancelText="取消"
        confirmLoading={editSubmitting}
      >
        <ChangeForm formInstance={editForm as FormInstance} />
      </Modal>

      <Modal
        title={`状态变更: ${statusConfig[pendingStatusChange as keyof typeof statusConfig]?.label || pendingStatusChange}`}
        open={statusNoteModalOpen}
        onOk={onStatusConfirm}
        onCancel={onStatusCancel}
        width={480}
        okText="确认变更"
        cancelText="取消"
      >
        <StatusNoteForm formInstance={statusNoteForm as FormInstance} />
      </Modal>

      <Modal
        title="添加时间线事件"
        open={addEventModalOpen}
        onOk={onEventAdd}
        onCancel={onEventCancel}
        width={480}
        okText="添加"
        cancelText="取消"
      >
        <TimelineEventForm formInstance={eventForm as FormInstance} />
      </Modal>

      <Modal
        title={editRfcId ? '编辑 RFC' : '新建 RFC'}
        open={rfcModalOpen}
        onOk={editRfcId ? onUpdateRfc : onCreateRfc}
        onCancel={onRfcCancel}
        width={640}
        okText={editRfcId ? '保存' : '创建'}
        cancelText="取消"
      >
        <RFCForm formInstance={rfcForm as FormInstance} />
      </Modal>

      <Modal
        title="RFC 详情"
        open={rfcDetailModalOpen}
        onCancel={onRfcDetailCancel}
        width={640}
        footer={null}
      >
        {selectedRfc && <RFCDetailContent rfc={selectedRfc} />}
      </Modal>

      <Modal
        title={editCabId ? '编辑 CAB 会议' : '新建 CAB 会议'}
        open={cabModalOpen}
        onOk={editCabId ? onUpdateCab : onCreateCab}
        onCancel={onCabCancel}
        width={560}
        okText={editCabId ? '保存' : '创建'}
        cancelText="取消"
      >
        <CABForm formInstance={cabForm as FormInstance} />
      </Modal>

      <Modal
        title="CAB 会议详情"
        open={cabDetailModalOpen}
        onCancel={onCabDetailCancel}
        width={720}
        footer={
          selectedCab ? (
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={onOpenDecision}>
                添加决策
              </Button>
              <Button onClick={onCabDetailCancel}>关闭</Button>
            </Space>
          ) : null
        }
      >
        {selectedCab && <CABDetailContent cab={selectedCab} />}
      </Modal>

      <Modal
        title="添加 CAB 决策"
        open={decisionModalOpen}
        onOk={onDecisionAdd}
        onCancel={onDecisionCancel}
        width={480}
        okText="添加"
        cancelText="取消"
      >
        <DecisionForm formInstance={decisionForm as FormInstance} />
      </Modal>
    </>
  );
}
