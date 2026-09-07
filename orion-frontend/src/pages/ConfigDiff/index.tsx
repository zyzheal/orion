/**
 * Configuration Version Diff Page
 * Compare two versions of a config item, visualize changes, and rollback.
 *
 * P2-9 Phase 122 拆分:
 * - useConfigDiffState.tsx    状态 hook (11 useState + 2 useEffect + 5 handlers + versionOptions)
 * - constants.tsx             operationColor + operationIcon
 * - configColumns.tsx         buildChangeColumns + reportColumns
 * - Components/ConfigDiffHeader.tsx
 * - Components/SelectionPanel.tsx
 * - Components/StatsPanel.tsx
 * - Components/DiffTable.tsx
 * - Components/EmptyState.tsx
 * - Components/DiffReport.tsx
 * - Components/ChangeDetailModal.tsx
 * - Components/RollbackModal.tsx
 */
import React from 'react';
import { spacing } from '@/tokens';
import { useConfigDiffState } from './useConfigDiffState';
import { ConfigDiffHeader } from './Components/ConfigDiffHeader';
import { SelectionPanel } from './Components/SelectionPanel';
import { StatsPanel } from './Components/StatsPanel';
import { DiffTable } from './Components/DiffTable';
import { EmptyState } from './Components/EmptyState';
import { DiffReport } from './Components/DiffReport';
import { ChangeDetailModal } from './Components/ChangeDetailModal';
import { RollbackModal } from './Components/RollbackModal';

const ConfigDiffPage: React.FC = () => {
  const state = useConfigDiffState();
  const { selectedConfigId, changeDetail, setChangeDetail } = state;

  return (
    <div style={{ padding: spacing.lg }}>
      <ConfigDiffHeader state={state} />
      <SelectionPanel state={state} />
      <StatsPanel state={state} />
      <DiffTable state={state} />
      {!selectedConfigId && <EmptyState />}
      <DiffReport state={state} />
      <ChangeDetailModal changeDetail={changeDetail} onChangeDetail={setChangeDetail} />
      <RollbackModal state={state} />
    </div>
  );
};

export default ConfigDiffPage;
