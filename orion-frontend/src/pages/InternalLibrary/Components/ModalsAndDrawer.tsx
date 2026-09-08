import CreateLibraryModal from '../CreateLibraryModal';
import { DeprecateModal } from '../DeprecateModal';
import { PublishVersionModal } from '../PublishVersionModal';
import { DeprecateVersionModal } from '../DeprecateVersionModal';
import { AddDependentModal } from '../AddDependentModal';
import { LibraryDetailDrawer } from '../LibraryDetailDrawer';
import type { useInternalLibraryState } from '../useInternalLibraryState';
import type { useInternalLibraryHandlers } from '../useInternalLibraryHandlers';

type State = ReturnType<typeof useInternalLibraryState>;
type Handlers = ReturnType<typeof useInternalLibraryHandlers>;

interface Props {
  state: State;
  handlers: Handlers;
}

export function ModalsAndDrawer({ state: s, handlers: h }: Props) {
  return (
    <>
      <CreateLibraryModal
        visible={s.createModalVisible}
        form={s.createForm}
        submitting={s.submitting}
        onCancel={() => s.setCreateModalVisible(false)}
        onOk={s.handleCreate}
      />

      <DeprecateModal
        visible={s.deprecateModalVisible}
        form={s.deprecateForm}
        submitting={s.submitting}
        onCancel={() => s.setDeprecateModalVisible(false)}
        onOk={s.handleDeprecate}
      />

      <PublishVersionModal
        visible={s.versionModalVisible}
        form={s.versionForm}
        submitting={s.submitting}
        onCancel={() => s.setVersionModalVisible(false)}
        onOk={s.handlePublishVersion}
      />

      <DeprecateVersionModal
        visible={s.deprecateVersionModalVisible}
        form={s.deprecateVersionForm}
        submitting={s.submitting}
        onCancel={() => s.setDeprecateVersionModalVisible(false)}
        onOk={s.handleDeprecateVersion}
      />

      <AddDependentModal
        visible={s.addDependentModalVisible}
        form={s.addDependentForm}
        submitting={s.submitting}
        onCancel={() => s.setAddDependentModalVisible(false)}
        onOk={s.handleAddDependent}
      />

      <LibraryDetailDrawer
        visible={s.detailDrawerVisible}
        selectedLib={s.selectedLib}
        onClose={() => s.setDetailDrawerVisible(false)}
        detailActiveKey={h.detailActiveKey}
        detailTabChange={h.detailTabChange}
        detailTabItems={h.detailTabItems}
      />
    </>
  );
}
