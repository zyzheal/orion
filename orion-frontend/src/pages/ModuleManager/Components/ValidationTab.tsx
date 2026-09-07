/**
 * ValidationTab - 校验报告 Tab
 * 抽取自 index.tsx (P2-9 Phase 117)
 */
import React from 'react';
import ValidationReport from '../ValidationReport';
import type { ModuleManagerState } from '../useModuleManagerState';

interface ValidationTabProps {
  state: ModuleManagerState;
}

export const ValidationTab: React.FC<ValidationTabProps> = ({ state }) => {
  const { validationResult, validationLoading, startupOrder } = state;

  return (
    <ValidationReport
      validation={validationResult}
      loading={validationLoading}
      startupOrder={startupOrder}
    />
  );
};
