/**
 * DataQualityFix state hook
 * 抽取自 index.tsx (P2-9 Phase 146)
 */
import { useMemo, useState } from 'react';
import { MOCK_ISSUES, RULE_COUNT } from './constants';
import { getOverallScore } from './helpers';
import type { ProblemType, Severity, Status } from './types';

export const useDataQualityFixState = () => {
  const [filterType, setFilterType] = useState<ProblemType | undefined>();
  const [filterSeverity, setFilterSeverity] = useState<Severity | undefined>();
  const [filterStatus, setFilterStatus] = useState<Status | undefined>();

  const overallScore = useMemo(getOverallScore, []);

  const filteredIssues = useMemo(() => {
    return MOCK_ISSUES.filter((issue) => {
      if (filterType && issue.problemType !== filterType) return false;
      if (filterSeverity && issue.severity !== filterSeverity) return false;
      if (filterStatus && issue.status !== filterStatus) return false;
      return true;
    });
  }, [filterType, filterSeverity, filterStatus]);

  const ruleCount = RULE_COUNT;
  const problemCount = MOCK_ISSUES.length;
  const fixedCount = MOCK_ISSUES.filter((i) => i.status === 'fixed').length;
  const pendingCount = MOCK_ISSUES.filter((i) => i.status === 'pending').length;

  return {
    filterType,
    setFilterType,
    filterSeverity,
    setFilterSeverity,
    filterStatus,
    setFilterStatus,
    overallScore,
    filteredIssues,
    ruleCount,
    problemCount,
    fixedCount,
    pendingCount,
  };
};

export type DataQualityFixState = ReturnType<typeof useDataQualityFixState>;
