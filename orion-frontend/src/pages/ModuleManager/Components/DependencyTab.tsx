/**
 * DependencyTab - 依赖关系图 Tab
 * 抽取自 index.tsx (P2-9 Phase 117)
 */
import React from 'react';
import DependencyGraph from '../DependencyGraph';
import type { ModuleManagerState } from '../useModuleManagerState';

interface DependencyTabProps {
  state: ModuleManagerState;
  showReverseDeps?: boolean;
}

export const DependencyTab: React.FC<DependencyTabProps> = ({ state, showReverseDeps = false }) => {
  const { modules, levelFilter } = state;

  return (
    <DependencyGraph
      modules={modules}
      showReverseDeps={showReverseDeps}
      levelFilter={levelFilter !== 'all' ? levelFilter : undefined}
    />
  );
};
