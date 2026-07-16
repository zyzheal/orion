/**
 * TASK-5.11: Ticket Template Service
 *
 * Provides ticket template CRUD operations and template application
 * for quick ticket creation with predefined configurations.
 */

import { createLogger } from '../../utils/logger';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { TicketingRepository } from './TicketingRepository';
import {
  TicketTemplate,
  CreateTicketTemplateInput,
  UpdateTicketTemplateInput,
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from './types';

const logger = createLogger('ticket-template-service');

export class TicketTemplateServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'TicketTemplateServiceError'; }
}

export class TicketTemplateService {
  private repository: TicketingRepository;

  constructor(repository: TicketingRepository) {
    this.repository = repository;
  }

  /**
   * Create a new ticket template
   */
  async createTemplate(input: CreateTicketTemplateInput): Promise<TicketTemplate> {
    const tenantId = getCurrentTenantId();

    const templateInput: CreateTicketTemplateInput = {
      ...input,
      createdBy: input.createdBy,
    };

    const template = await this.repository.createTemplate(templateInput, tenantId);
    logger.info(
      { traceId: getCurrentTenantId(), tenantId, templateId: template.id, name: template.name },
      '[TicketTemplateService] Template created'
    );
    return template;
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<TicketTemplate | null> {
    const tenantId = getCurrentTenantId();
    return this.repository.findTemplateById(templateId, tenantId);
  }

  /**
   * List templates for current tenant
   */
  async listTemplates(options?: { category?: TicketCategory; isPublic?: boolean; limit?: number; offset?: number }): Promise<{ data: TicketTemplate[]; total: number }> {
    const tenantId = getCurrentTenantId();
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const [templates, total] = await Promise.all([
      this.repository.findAllTemplates(tenantId, options),
      this.repository.countTemplates(tenantId, options?.category),
    ]);

    return { data: templates, total };
  }

  /**
   * Update a template
   */
  async updateTemplate(templateId: string, input: UpdateTicketTemplateInput): Promise<TicketTemplate> {
    const tenantId = getCurrentTenantId();
    const template = await this.repository.updateTemplate(templateId, input, tenantId);
    if (!template) {
      throw new TicketTemplateServiceError(`Template not found: ${templateId}`, 'NOT_FOUND');
    }
    logger.info(
      { traceId: getCurrentTenantId(), tenantId, templateId },
      '[TicketTemplateService] Template updated'
    );
    return template;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    const deleted = await this.repository.deleteTemplate(templateId, tenantId);
    if (!deleted) {
      throw new TicketTemplateServiceError(`Template not found: ${templateId}`, 'NOT_FOUND');
    }
    logger.info(
      { traceId: getCurrentTenantId(), tenantId, templateId },
      '[TicketTemplateService] Template deleted'
    );
  }

  /**
   * Apply a template to create a new ticket
   */
  async applyTemplate(templateId: string, overrides?: Partial<{
    title: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    assigneeId: string;
    tags: string[];
    reporter: string;
  }>): Promise<Ticket> {
    const tenantId = getCurrentTenantId();
    let template = await this.repository.findTemplateById(templateId, tenantId);
    if (!template) {
      // Try to find public template
      const publicTemplates = await this.repository.findAllTemplates(tenantId, { isPublic: true, limit: 1 });
      const found = publicTemplates.find(t => t.id === templateId);
      if (!found) {
        throw new TicketTemplateServiceError(`Template not found: ${templateId}`, 'NOT_FOUND');
      }
      template = found;
    }

    // Increment usage count
    await this.repository.incrementTemplateUsage(templateId, tenantId);

    // Build ticket from template with overrides
    const ticketData: Partial<Ticket> = {
      title: overrides?.title || template.title,
      description: overrides?.description || template.templateBody,
      category: overrides?.category || template.category,
      priority: overrides?.priority || template.priority,
      status: overrides?.status || template.status,
      tags: (overrides?.tags || template.tags) as unknown as Record<string, string> | undefined,
    };

    if (overrides?.assigneeId) {
      ticketData.assignee = overrides.assigneeId;
    } else if (template.assigneeId) {
      ticketData.assignee = template.assigneeId;
    }

    // Merge field defaults
    if (template.fieldDefaults && Object.keys(template.fieldDefaults).length > 0) {
      Object.assign(ticketData, template.fieldDefaults);
    }

    logger.info(
      { traceId: getCurrentTenantId(), tenantId, templateId, ticketTitle: ticketData.title },
      '[TicketTemplateService] Template applied'
    );

    // Return a partial ticket - the actual creation should be handled by the caller (TicketingService)
    // Here we just return the merged data for the caller to create the ticket
    return ticketData as Ticket;
  }

  /**
   * Get most used templates
   */
  async getMostUsedTemplates(tenantId?: string, limit = 10): Promise<TicketTemplate[]> {
    const actualTenantId = tenantId || getCurrentTenantId();
    return this.repository.findAllTemplates(actualTenantId, { limit });
  }
}
