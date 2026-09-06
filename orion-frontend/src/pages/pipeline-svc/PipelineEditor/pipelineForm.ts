/**
 * pipelineForm.ts - Pipeline 基本信息表单类型
 * 抽取自 pipeline-svc/PipelineEditor/index.tsx (P2-9 Phase 102)
 * 注意: 与共享 types.ts 的 PipelineFormData 不同 (该类型包含 stages 字段)
 */
export interface PipelineForm {
  name: string;
  version: string;
  description?: string;
}
