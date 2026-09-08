import { ChangeManagementModals } from '../ChangeManagementModals';
import type { useChangeManagementState } from '../useChangeManagementState';
import type { useChangeFormWrappers } from '../useChangeFormWrappers';

type State = ReturnType<typeof useChangeManagementState>;
type Wrappers = ReturnType<typeof useChangeFormWrappers>;

interface Props {
  state: State;
  wrappers: Wrappers;
}

export function ModalsBundle({ state: s, wrappers: w }: Props) {
  return (
    <ChangeManagementModals
      createModalOpen={s.createModalOpen}
      createForm={w.createForm}
      createSubmitting={s.createSubmitting}
      onCreate={w.handleCreateWrapper}
      onCreateCancel={w.cancelCreateModal}
      editModalOpen={s.editModalOpen}
      editForm={w.editForm}
      editSubmitting={s.editSubmitting}
      onEdit={w.handleEditWrapper}
      onEditCancel={w.cancelEditModal}
      statusNoteModalOpen={s.statusNoteModalOpen}
      statusNoteForm={w.statusNoteForm}
      pendingStatusChange={s.pendingStatusChange}
      onStatusConfirm={w.handleConfirmStatusChangeWrapper}
      onStatusCancel={w.cancelStatusModal}
      addEventModalOpen={s.addEventModalOpen}
      eventForm={w.eventForm}
      onEventAdd={w.handleAddTimelineEventWrapper}
      onEventCancel={w.cancelEventModal}
      rfcModalOpen={s.rfcModalOpen}
      rfcForm={w.rfcForm}
      editRfcId={s.editRfcId}
      onCreateRfc={w.handleCreateRfcWrapper}
      onUpdateRfc={w.handleUpdateRfcWrapper}
      onRfcCancel={w.cancelRfcModal}
      rfcDetailModalOpen={s.rfcDetailModalOpen}
      selectedRfc={s.selectedRfc}
      onRfcDetailCancel={() => {
        s.setRfcDetailModalOpen(false);
        w.cancelRfcDetailModal();
      }}
      cabModalOpen={s.cabModalOpen}
      cabForm={w.cabForm}
      editCabId={s.editCabId}
      onCreateCab={w.handleCreateCabWrapper}
      onUpdateCab={w.handleUpdateCabWrapper}
      onCabCancel={w.cancelCabModal}
      cabDetailModalOpen={s.cabDetailModalOpen}
      selectedCab={s.selectedCab}
      onCabDetailCancel={() => s.setCabDetailModalOpen(false)}
      onOpenDecision={w.openDecisionModal}
      decisionModalOpen={s.decisionModalOpen}
      decisionForm={w.decisionForm}
      onDecisionAdd={w.handleAddDecisionWrapper}
      onDecisionCancel={w.cancelDecisionModal}
    />
  );
}
