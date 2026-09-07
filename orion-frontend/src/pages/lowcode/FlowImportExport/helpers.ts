/**
 * FlowImportExport validation helpers
 * 抽取自 index.tsx (P2-9 Phase 138)
 */
import type { ValidateInput, ValidateResult } from './types';

export const validateWorkflowJson = (
  data: ValidateInput
): ValidateResult => {
  const result: ValidateResult = { valid: true, errors: [], warnings: [] };
  if (!data.name || data.name.trim().length === 0) {
    result.valid = false;
    result.errors.push('流程名称不能为空');
  }
  if (!Array.isArray(data.nodes)) {
    result.valid = false;
    result.errors.push('nodes 必须是数组');
  } else if (data.nodes.length === 0) {
    result.warnings.push('nodes 数组为空，流程没有节点');
  }
  if (!Array.isArray(data.edges)) {
    result.valid = false;
    result.errors.push('edges 必须是数组');
  }
  return result;
};
