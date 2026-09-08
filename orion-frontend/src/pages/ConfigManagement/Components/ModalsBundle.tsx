import { ConfigCreateModal, ConfigDetailDrawer } from '../ConfigModals';
import type { useConfigManagementState } from '../useConfigManagementState';

type State = ReturnType<typeof useConfigManagementState>;

interface Props {
  state: State;
  form: any;
}

export function ConfigModalsBundle({ state: s, form }: Props) {
  return (
    <>
      <ConfigCreateModal
        open={s.createModalOpen}
        editingConfig={s.editingConfig}
        submitting={s.submitting}
        form={form}
        onCreate={s.handleCreate}
        onCancel={s.handleModalClose}
        onClose={s.handleModalClose}
      />
      <ConfigDetailDrawer
        open={s.detailDrawerOpen}
        selectedConfig={s.selectedConfig}
        onClose={() => s.setDetailDrawerOpen(false)}
      />
    </>
  );
}
