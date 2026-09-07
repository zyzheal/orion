/**
 * Executive Dashboard type definitions
 * 抽取自 index.tsx (P2-9 Phase 158)
 */

export interface AlertCard {
  title: string;
  value: number;
  suffix: string;
  color: string;
  icon: React.ReactNode;
}
