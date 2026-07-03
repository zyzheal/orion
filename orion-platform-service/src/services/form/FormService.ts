import { FormRepository, FormDefinition, FormFieldDefinition, FormInstance, CreateFormDefinitionInput, CreateFormFieldInput, CreateFormInstanceInput } from './FormRepository';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { OrionError } from '../../errors';
import { createLogger } from '../utils/logger';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface FormDefinitionWithFields extends FormDefinition {
  fields: FormFieldDefinition[];
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export class FormService {
  constructor(private formRepo: FormRepository) {}

  // ---- Definition CRUD ----

  async listDefinitions(options?: { enabled?: boolean; limit?: number; offset?: number }): Promise<{ rows: FormDefinition[]; total: number }> {
    return this.formRepo.findDefinitions(options);
  }

  async getDefinition(id: string): Promise<FormDefinitionWithFields> {
    const def = await this.formRepo.findDefinitionById(id);
    if (!def) throw new OrionError(`Form definition not found: ${id}`, 'NOT_FOUND');
    const fields = await this.formRepo.findFieldsByFormId(id);
    return { ...def, fields };
  }

  async createDefinition(input: CreateFormDefinitionInput, fields: CreateFormFieldInput[], userId?: string): Promise<FormDefinitionWithFields> {
    const def = await this.formRepo.createDefinition({ ...input, created_by: userId });

    const createdFields: FormFieldDefinition[] = [];
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const created = await this.formRepo.createField({
        ...field,
        form_id: def.id,
        sort_order: field.sort_order ?? i,
      });
      createdFields.push(created);
    }

    logger.info({ definitionId: def.id, name: def.name, fieldCount: createdFields.length }, '[FormService] Definition created');

    return { ...def, fields: createdFields };
  }

  async updateDefinition(id: string, data: { name?: string; description?: string; layout?: string; enabled?: boolean }): Promise<FormDefinition> {
    const existing = await this.formRepo.findDefinitionById(id);
    if (!existing) throw new OrionError(`Form definition not found: ${id}`, 'NOT_FOUND');
    const updated = await this.formRepo.updateDefinition(id, data);
    return updated!;
  }

  async deleteDefinition(id: string): Promise<boolean> {
    const existing = await this.formRepo.findDefinitionById(id);
    if (!existing) throw new OrionError(`Form definition not found: ${id}`, 'NOT_FOUND');
    // Fields cascade-delete via FK
    return this.formRepo.deleteDefinition(id);
  }

  // ---- Field Management ----

  async replaceFields(formId: string, fields: CreateFormFieldInput[]): Promise<FormFieldDefinition[]> {
    // Verify form exists
    const def = await this.formRepo.findDefinitionById(formId);
    if (!def) throw new OrionError(`Form definition not found: ${formId}`, 'NOT_FOUND');

    // Delete existing fields
    await this.formRepo.deleteFieldsByFormId(formId);

    // Create new fields
    const created: FormFieldDefinition[] = [];
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const c = await this.formRepo.createField({
        ...field,
        form_id: formId,
        sort_order: field.sort_order ?? i,
      });
      created.push(c);
    }

    return created;
  }

  // ---- Instance CRUD ----

  async getInstance(id: string): Promise<FormInstance> {
    const inst = await this.formRepo.findInstanceById(id);
    if (!inst) throw new OrionError(`Form instance not found: ${id}`, 'NOT_FOUND');
    return inst;
  }

  async listInstances(options?: { definitionId?: string; entityType?: string; entityId?: string; limit?: number; offset?: number }): Promise<{ rows: FormInstance[]; total: number }> {
    return this.formRepo.findInstances(options);
  }

  async submitInstance(input: CreateFormInstanceInput, userId?: string): Promise<FormInstance> {
    // Validate that the definition exists
    const def = await this.formRepo.findDefinitionById(input.definition_id);
    if (!def) throw new OrionError(`Form definition not found: ${input.definition_id}`, 'NOT_FOUND');

    // Validate form data against field definitions
    const validation = await this.validateFormData(input.definition_id, input.form_data);
    if (!validation.valid) {
      throw new OrionError('Form validation failed', 'VALIDATION_ERROR', false, { errors: validation.errors });
    }

    return this.formRepo.createInstance({ ...input, submitted_by: userId });
  }

  async updateInstance(id: string, data: Record<string, unknown>): Promise<FormInstance> {
    const existing = await this.formRepo.findInstanceById(id);
    if (!existing) throw new OrionError(`Form instance not found: ${id}`, 'NOT_FOUND');

    // Validate against definition
    const validation = await this.validateFormData(existing.definition_id, data);
    if (!validation.valid) {
      throw new OrionError('Form validation failed', 'VALIDATION_ERROR', false, { errors: validation.errors });
    }

    const updated = await this.formRepo.updateInstance(id, { form_data: data });
    return updated!;
  }

  // ---- Validation ----

  async validateFormData(definitionId: string, data: Record<string, unknown>): Promise<ValidationResult> {
    const fields = await this.formRepo.findFieldsByFormId(definitionId);
    const errors: Record<string, string> = {};

    for (const field of fields) {
      const value = data[field.field_key];

      // Required check
      if (field.required && (value === undefined || value === null || value === '')) {
        errors[field.field_key] = `${field.label}为必填项`;
        continue;
      }

      // Skip further validation if value is empty and not required
      if (value === undefined || value === null || value === '') continue;

      // Pattern validation
      const rules = field.rules as Record<string, unknown> | null;
      if (rules?.pattern && typeof value === 'string' && !new RegExp(rules.pattern as string).test(value)) {
        errors[field.field_key] = (rules.message as string) || `${field.label}格式不正确`;
      }

      // Min length
      if (rules?.min && typeof value === 'string' && value.length < (rules.min as number)) {
        errors[field.field_key] = `${field.label}最少${rules.min}个字符`;
      }

      // Max length
      if (rules?.max && typeof value === 'string' && value.length > (rules.max as number)) {
        errors[field.field_key] = `${field.label}最多${rules.max}个字符`;
      }
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }
}
