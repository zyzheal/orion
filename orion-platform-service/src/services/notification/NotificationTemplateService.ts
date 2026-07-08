/**
 * NotificationTemplateService - Business logic for notification templates
 *
 * Features:
 * - Variable replacement engine ({{variable}} syntax)
 * - Template inheritance (base template + override)
 * - Template preview
 */

import { NotificationTemplateRepository, NotificationTemplateEntity, CreateNotificationTemplateInput, UpdateNotificationTemplateInput } from '../../repositories/NotificationTemplateRepository';
import { createLogger } from '../../utils/logger';

export class NotificationTemplateServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'NotificationTemplateServiceError';
  }
}

export interface RenderResult {
  subject: string | undefined;
  body: string;
  missingVariables: string[];
}

export interface PreviewInput {
  variables: Record<string, string>;
  channelId?: string;
}

export interface TemplateInheritanceOverride {
  name?: string;
  event_type?: string;
  subject?: string;
  subject_template?: string;
  body_template?: string;
  channel_ids?: string[];
}

export class NotificationTemplateService {
  private logger = createLogger('notification-template');

  constructor(private repository: NotificationTemplateRepository) {}

  // =========================================================================
  // Template Variable Engine
  // =========================================================================

  /**
   * Extract all {{variable}} placeholders from a template string.
   */
  extractVariables(template: string): string[] {
    const regex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_-]*)\s*\}\}/g;
    const vars = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = regex.exec(template)) !== null) {
      vars.add(match[1].trim());
    }
    return Array.from(vars);
  }

  /**
   * Replace {{variable}} placeholders with provided values.
   * Returns the rendered string and list of missing variables.
   */
  renderTemplate(template: string, variables: Record<string, string>): { rendered: string; missing: string[] } {
    const placeholders = this.extractVariables(template);
    let rendered = template;
    const missing: string[] = [];

    for (const key of placeholders) {
      if (key in variables) {
        rendered = rendered.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), variables[key]);
      } else {
        missing.push(key);
      }
    }

    return { rendered, missing };
  }

  /**
   * Render a full template (subject_template + body_template) with variables.
   */
  renderTemplateFull(template: NotificationTemplateEntity, variables: Record<string, string>): RenderResult {
    const subjectTemplate = template.subject_template || template.subject;
    const bodyResult = this.renderTemplate(template.body_template, variables);
    const subjectResult = subjectTemplate
      ? this.renderTemplate(subjectTemplate, variables)
      : { rendered: '', missing: [] as string[] };

    const allMissing = [...new Set([...bodyResult.missing, ...subjectResult.missing])];

    return {
      subject: subjectResult.rendered || template.subject || undefined,
      body: bodyResult.rendered,
      missingVariables: allMissing,
    };
  }

  // =========================================================================
  // Template Inheritance
  // =========================================================================

  /**
   * Resolve template inheritance: merge base template with overrides.
   */
  async resolveInheritance(baseTemplateId: string, overrides: TemplateInheritanceOverride): Promise<NotificationTemplateEntity> {
    const base = await this.repository.findById(baseTemplateId);
    if (!base) {
      throw new NotificationTemplateServiceError(`Template not found: ${baseTemplateId}`, 'NOT_FOUND');
    }

    return {
      ...base,
      name: overrides.name ?? base.name,
      event_type: overrides.event_type ?? base.event_type,
      subject: overrides.subject ?? base.subject,
      subject_template: overrides.subject_template ?? base.subject_template,
      body_template: overrides.body_template ?? base.body_template,
      channel_ids: overrides.channel_ids ?? base.channel_ids,
    };
  }

  /**
   * Create a child template that inherits from a base template.
   */
  async createInheritedTemplate(baseTemplateId: string, input: CreateNotificationTemplateInput): Promise<NotificationTemplateEntity> {
    const base = await this.repository.findById(baseTemplateId);
    if (!base) {
      throw new NotificationTemplateServiceError(`Template not found: ${baseTemplateId}`, 'NOT_FOUND');
    }

    const mergedInput: CreateNotificationTemplateInput = {
      name: input.name,
      event_type: input.event_type ?? base.event_type,
      subject: input.subject,
      body_template: input.body_template ?? base.body_template,
      channel_ids: input.channel_ids ?? base.channel_ids,
    };

    // Validation
    if (!mergedInput.name || !mergedInput.event_type || !mergedInput.body_template) {
      throw new NotificationTemplateServiceError('name, event_type, and body_template are required', 'INVALID_INPUT');
    }

    return this.repository.create(base.tenant_id, mergedInput);
  }

  // =========================================================================
  // Template Preview
  // =========================================================================

  /**
   * Preview a template with sample variables.
   */
  async previewTemplate(id: string, input: PreviewInput): Promise<RenderResult> {
    const template = await this.repository.findById(id);
    if (!template) {
      throw new NotificationTemplateServiceError(`Template not found: ${id}`, 'NOT_FOUND');
    }

    return this.renderTemplateFull(template, input.variables);
  }

  // =========================================================================
  // CRUD
  // =========================================================================

  async createTemplate(input: CreateNotificationTemplateInput): Promise<NotificationTemplateEntity> {
    if (!input.name || !input.event_type || !input.body_template) {
      throw new NotificationTemplateServiceError('name, event_type, and body_template are required', 'INVALID_INPUT');
    }
    // tenant_id will be injected by the repository from context
    const tenantId = (this.repository as any).getTenantId ? (this.repository as any).getTenantId() : 'system';
    return this.repository.create(tenantId, input);
  }

  async getTemplate(id: string): Promise<NotificationTemplateEntity> {
    const template = await this.repository.findById(id);
    if (!template) {
      throw new NotificationTemplateServiceError(`Template not found: ${id}`, 'NOT_FOUND');
    }
    return template;
  }

  async listTemplates(options?: { event_type?: string; limit?: number; offset?: number }): Promise<NotificationTemplateEntity[]> {
    return this.repository.findAll(options);
  }

  async updateTemplate(id: string, updates: UpdateNotificationTemplateInput): Promise<NotificationTemplateEntity> {
    const tenantId = (this.repository as any).getTenantId ? (this.repository as any).getTenantId() : 'system';
    const template = await this.repository.update(id, tenantId, updates);
    if (!template) {
      throw new NotificationTemplateServiceError(`Template not found: ${id}`, 'NOT_FOUND');
    }
    return template;
  }

  async deleteTemplate(id: string): Promise<void> {
    const deleted = await (this.repository as any).delete(id);
    if (!deleted) {
      throw new NotificationTemplateServiceError(`Template not found: ${id}`, 'NOT_FOUND');
    }
  }
}
