import { ProblemModals } from '../ProblemModals';
import type { useProblemState } from '../useProblemState';
import type { useProblemHandlers } from '../useProblemHandlers';

type State = ReturnType<typeof useProblemState>;
type Handlers = ReturnType<typeof useProblemHandlers>;

interface Props {
  s: State;
  h: Handlers;
  createForm: any;
  editForm: any;
  linkForm: any;
  kedbForm: any;
  kedbEditForm: any;
}

export function ProblemModalsBundle({ s, h, createForm, editForm, linkForm, kedbForm, kedbEditForm }: Props) {
  return (
    <ProblemModals
      createModalVisible={s.createModalVisible}
      setCreateModalVisible={s.setCreateModalVisible}
      createForm={createForm}
      handleCreate={h.handleCreate}
      editModalVisible={s.editModalVisible}
      setEditModalVisible={s.setEditModalVisible}
      editForm={editForm}
      handleEdit={h.handleEdit}
      linkIncidentModalVisible={s.linkIncidentModalVisible}
      setLinkIncidentModalVisible={s.setLinkIncidentModalVisible}
      linkForm={linkForm}
      handleLinkIncident={h.handleLinkIncident}
      linkingLoading={s.linkingLoading}
      linkChangeModalVisible={s.linkChangeModalVisible}
      setLinkChangeModalVisible={s.setLinkChangeModalVisible}
      handleLinkChange={h.handleLinkChange}
      kedbModalVisible={s.kedbModalVisible}
      setKedbModalVisible={s.setKedbModalVisible}
      kedbForm={kedbForm}
      handleCreateKnownError={h.handleCreateKnownError}
      kedbEditModalVisible={s.kedbEditModalVisible}
      setKedbEditModalVisible={s.setKedbEditModalVisible}
      kedbEditForm={kedbEditForm}
      handleEditKnownError={h.handleEditKnownError}
      setEditingKnownError={s.setEditingKnownError}
    />
  );
}
