import { UserManagementModals } from '../UserManagementModals';
import { roleOptions } from '../constants';
import { DetailItems } from './DetailItems';
import type { useUserManagementState } from '../useUserManagementState';

type State = ReturnType<typeof useUserManagementState>;

export function UserManagementModalsBundle({ s }: { s: State }) {
  const detailItems = <DetailItems selectedUser={s.selectedUser} />;

  return (
    <UserManagementModals
      createModalVisible={s.createModalVisible}
      setCreateModalVisible={s.setCreateModalVisible}
      editModalVisible={s.editModalVisible}
      setEditModalVisible={s.setEditModalVisible}
      editingUser={s.editingUser}
      setEditingUser={s.setEditingUser}
      detailDrawerVisible={s.detailDrawerVisible}
      setDetailDrawerVisible={s.setDetailDrawerVisible}
      selectedUser={s.selectedUser}
      setSelectedUser={s.setSelectedUser}
      changePwModalVisible={s.changePwModalVisible}
      setChangePwModalVisible={s.setChangePwModalVisible}
      createForm={s.createForm}
      editForm={s.editForm}
      changePwForm={s.changePwForm}
      submitting={s.submitting}
      setSubmitting={s.setSubmitting}
      handleCreate={s.handleCreate}
      handleEdit={s.handleEdit}
      handleChangePassword={s.handleChangePassword}
      handleEnable={s.handleEnable}
      handleDisable={s.handleDisable}
      openEdit={s.openEdit}
      roleOptions={roleOptions}
      detailItems={detailItems}
    />
  );
}
