import type { FormInstance } from 'antd';
import { CreateArtifactModal } from '../CreateArtifactModal';
import { EditArtifactModal } from '../EditArtifactModal';
import { PromotionModal } from '../PromotionModal';
import { TagModal } from '../TagModal';
import { ArtifactDetailDrawer } from '../ArtifactDetailDrawer';

interface Props {
  createModalVisible: boolean;
  setCreateModalVisible: (v: boolean) => void;
  editModalVisible: boolean;
  setEditModalVisible: (v: boolean) => void;
  promotionModalVisible: boolean;
  setPromotionModalVisible: (v: boolean) => void;
  tagModalVisible: boolean;
  setTagModalVisible: (v: boolean) => void;
  detailDrawerVisible: boolean;
  setDetailDrawerVisible: (v: boolean) => void;
  selectedArtifact: any;
  detailTabItems: any;
  submitting: boolean;
  namespaces: string[];
  createForm: FormInstance<any>;
  editForm: FormInstance<any>;
  promotionForm: FormInstance<any>;
  tagForm: FormInstance<any>;
  handleCreate: () => void;
  handleEdit: () => void;
  handlePromote: () => void;
  handleAddTags: () => void;
}

export function Modals({
  createModalVisible,
  setCreateModalVisible,
  editModalVisible,
  setEditModalVisible,
  promotionModalVisible,
  setPromotionModalVisible,
  tagModalVisible,
  setTagModalVisible,
  detailDrawerVisible,
  setDetailDrawerVisible,
  selectedArtifact,
  detailTabItems,
  submitting,
  namespaces,
  createForm,
  editForm,
  promotionForm,
  tagForm,
  handleCreate,
  handleEdit,
  handlePromote,
  handleAddTags,
}: Props) {
  return (
    <>
      <CreateArtifactModal
        visible={createModalVisible}
        form={createForm}
        submitting={submitting}
        namespaces={namespaces}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
      />
      <EditArtifactModal
        visible={editModalVisible}
        form={editForm}
        submitting={submitting}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleEdit}
      />
      <PromotionModal
        visible={promotionModalVisible}
        form={promotionForm}
        submitting={submitting}
        selectedArtifact={selectedArtifact}
        onCancel={() => setPromotionModalVisible(false)}
        onOk={handlePromote}
      />
      <TagModal
        visible={tagModalVisible}
        form={tagForm}
        submitting={submitting}
        onCancel={() => setTagModalVisible(false)}
        onOk={handleAddTags}
      />
      <ArtifactDetailDrawer
        visible={detailDrawerVisible}
        selectedArtifact={selectedArtifact}
        detailTabItems={detailTabItems}
        onClose={() => setDetailDrawerVisible(false)}
      />
    </>
  );
}
