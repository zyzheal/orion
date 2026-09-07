/**
 * SBOM helpers
 * 抽取自 index.tsx (P2-9 Phase 134)
 */
import { cSuccess, cInfo, cWarning, cError } from './constants';

export const vulnTagColor = (count: number): string => {
  if (count === 0) return cSuccess;
  if (count <= 2) return cInfo;
  if (count <= 4) return cWarning;
  return cError;
};
