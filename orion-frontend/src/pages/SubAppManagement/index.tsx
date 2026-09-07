/**
 * SubApp Management Page
 *
 * Page-based sub-application configuration management
 * Enables adding, editing, and managing sub-apps without code changes.
 *
 * P2-9 Phase 127 拆分:
 * - useSubAppManagementState.tsx  状态 hook (Form.useForm + 7 useState + 2 useEffect + 7 handlers)
 * - subAppColumns.tsx             buildSubAppColumns 8列
 * - Components/SubAppManagementHeader.tsx
 * - Components/InfoAlert.tsx
 * - Components/SubAppTable.tsx
 * - Components/CreateEditModal.tsx
 * - Components/HistoryDrawer.tsx
 */
import React from 'react';
import { useSubAppManagementState } from './useSubAppManagementState';
import { SubAppManagementHeader } from './Components/SubAppManagementHeader';
import { InfoAlert } from './Components/InfoAlert';
import { SubAppTable } from './Components/SubAppTable';
import { CreateEditModal } from './Components/CreateEditModal';
import { HistoryDrawer } from './Components/HistoryDrawer';

const SubAppManagement: React.FC = () => {
  const state = useSubAppManagementState();

  return (
    <div style={{ padding: 0 }}>
      <SubAppManagementHeader state={state} />
      <InfoAlert />
      <SubAppTable state={state} />
      <CreateEditModal state={state} />
      <HistoryDrawer state={state} />
    </div>
  );
};

export default SubAppManagement;
