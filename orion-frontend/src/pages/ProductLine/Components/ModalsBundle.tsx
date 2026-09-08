import { ProductLineModals } from '../ProductLineModals';
import type { useProductLineState } from '../useProductLineState';

type State = ReturnType<typeof useProductLineState>;

interface Props {
  state: State;
  detailTabItems: any;
}

export function ProductLineModalsBundle({ state: s, detailTabItems }: Props) {
  return (
    <ProductLineModals
      createModalVisible={s.createModalVisible}
      setCreateModalVisible={s.setCreateModalVisible}
      editModalVisible={s.editModalVisible}
      setEditModalVisible={s.setEditModalVisible}
      editingPL={s.editingPL}
      setEditingPL={s.setEditingPL}
      detailDrawerVisible={s.detailDrawerVisible}
      setDetailDrawerVisible={s.setDetailDrawerVisible}
      selectedPL={s.selectedPL}
      setSelectedPL={s.setSelectedPL}
      releaseTrains={s.releaseTrains}
      hotfixChannels={s.hotfixChannels}
      rtModalVisible={s.rtModalVisible}
      setRtModalVisible={s.setRtModalVisible}
      hfModalVisible={s.hfModalVisible}
      setHfModalVisible={s.setHfModalVisible}
      createForm={s.createForm}
      editForm={s.editForm}
      rtForm={s.rtForm}
      hfForm={s.hfForm}
      submitting={s.submitting}
      setSubmitting={s.setSubmitting}
      handleCreate={s.handleCreate}
      handleEdit={s.handleEdit}
      handleCreateRT={s.handleCreateRT}
      handleCreateHF={s.handleCreateHF}
      productLines={s.productLines}
      detailTabItems={detailTabItems}
    />
  );
}
