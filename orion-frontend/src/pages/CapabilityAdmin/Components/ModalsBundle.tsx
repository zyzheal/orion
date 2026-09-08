import { CapabilityModal } from '../Modals/CapabilityModal';
import { GrantTemporaryModal } from '../Modals/GrantTemporaryModal';
import { RequestPermissionModal } from '../Modals/RequestPermissionModal';
import type { useCapabilityAdminState } from '../useCapabilityAdminState';

type State = ReturnType<typeof useCapabilityAdminState>;

export function CapabilityModalsBundle({ s }: { s: State }) {
  return (
    <>
      <CapabilityModal
        visible={s.modalVisible}
        modalType={s.modalType}
        form={s.form}
        capabilities={s.capabilities}
        onSubmit={s.handleSubmit}
        onCancel={() => s.setModalVisible(false)}
      />
      <GrantTemporaryModal
        visible={s.tempPermModalVisible}
        form={s.tempPermForm}
        capabilities={s.capabilities}
        onSubmit={s.handleGrantTempPerm}
        onCancel={() => s.setTempPermModalVisible(false)}
      />
      <RequestPermissionModal
        visible={s.requestModalVisible}
        form={s.requestForm}
        capabilities={s.capabilities}
        onSubmit={s.handleRequestPermission}
        onCancel={() => s.setRequestModalVisible(false)}
      />
    </>
  );
}
