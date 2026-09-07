/**
 * DataQualityFix types
 * 抽取自 index.tsx (P2-9 Phase 146)
 */

export type ProblemType = 'null' | 'duplicate' | 'format' | 'out_of_range' | 'inconsistent';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Status = 'pending' | 'processing' | 'fixed' | 'ignored';

export interface QualityIssue {
  id: string;
  tableField: string;
  problemType: ProblemType;
  severity: Severity;
  affectedRows: number;
  discoveredAt: string;
  status: Status;
}

export interface RepairHistory {
  id: string;
  time: string;
  issue: string;
  operator: string;
  result: 'success' | 'failed';
}

export interface DimensionScore {
  name: string;
  score: number;
}

export interface DataQualityFixState {
  filterType: ProblemType | undefined;
  setFilterType: React.Dispatch<React.SetStateAction<ProblemType | undefined>>;
  filterSeverity: Severity | undefined;
  setFilterSeverity: React.Dispatch<React.SetStateAction<Severity | undefined>>;
  filterStatus: Status | undefined;
  setFilterStatus: React.Dispatch<React.SetStateAction<Status | undefined>>;
  overallScore: number;
  filteredIssues: QualityIssue[];
  ruleCount: number;
  problemCount: number;
  fixedCount: number;
  pendingCount: number;
}
