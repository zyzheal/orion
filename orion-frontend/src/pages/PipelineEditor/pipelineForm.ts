/**
 * Pipeline Editor 表单类型
 * PipelineForm 只包含基本信息 (name/version/description)
 * 与共享 types.ts 中 PipelineFormData 不同 (后者包含 stages)
 */
export interface PipelineForm {
  name: string;
  version: string;
  description?: string;
}
