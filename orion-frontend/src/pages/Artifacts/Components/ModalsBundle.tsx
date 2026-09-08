import { Modals } from './Modals';
import type { useArtifactState } from '../useArtifactState';

type State = ReturnType<typeof useArtifactState>;

interface Props {
  state: State;
  detailTabItems: any;
}

export function ArtifactModalsBundle({ state: s, detailTabItems }: Props) {
  return (
    <Modals
      createModalVisible={s.createModalVisible}
      setCreateModalVisible={s.setCreateModalVisible}
      editModalVisible={s.editModalVisible}
      setEditModalVisible={s.setEditModalVisible}
      promotionModalVisible={s.promotionModalVisible}
      setPromotionModalVisible={s.setPromotionModalVisible}
      tagModalVisible={s.tagModalVisible}
      setTagModalVisible={s.setTagModalVisible}
      detailDrawerVisible={s.detailDrawerVisible}
      setDetailDrawerVisible={s.setDetailDrawerVisible}
      selectedArtifact={s.selectedArtifact}
      detailTabItems={detailTabItems}
      submitting={s.submitting}
      namespaces={s.namespaces}
      createForm={s.createForm}
      editForm={s.editForm}
      promotionForm={s.promotionForm}
      tagForm={s.tagForm}
      handleCreate={s.handleCreate}
      handleEdit={s.handleEdit}
      handlePromote={s.handlePromote}
      handleAddTags={s.handleAddTags}
    />
  );
}
