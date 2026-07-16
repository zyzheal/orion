import { createLogger } from '../../utils/logger';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { TicketKnowledgeMappingRepository, TicketKnowledgeMappingEntity } from '../../repositories/TicketKnowledgeMappingRepository';
import { OrionError } from '../../errors';

const logger = createLogger('TicketToKnowledgeService');

export interface TicketData {
  id: string;
  title: string;
  description?: string;
  solution?: string;
  steps?: Array<{ action: string; result: string }>;
  comments?: Array<{ author: string; content: string; createdAt: string }>;
  tags?: string[];
  priority?: string;
  assignee?: string;
  status?: string;
}

export interface ConvertOptions {
  categoryId?: string;
  includeComments?: boolean;
  autoClassify?: boolean;
}

export interface ConversionPreview {
  title: string;
  content: string;
  tags: string[];
  suggestedCategoryId?: string;
}

/**
 * ContentSanitizer - Sanitizes sensitive information from content
 */
export class ContentSanitizer {
  private readonly patterns: Array<[RegExp, string]> = [
    // Passwords
    [/(password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]+['"]?/gi, '$1: ******'],
    // Tokens
    [/(token|secret|api[_-]?key)\s*[:=]\s*['"]?[a-zA-Z0-9]{8,}['"]?/gi, '$1: ******'],
    // IP addresses
    [/(\d{1,3}\.){3}\d{1,3}/g, '***.***.***.***'],
    // Phone numbers (CN)
    [/1[3-9]\d{9}/g, '1**********'],
    // ID card
    [/\d{17}[\dXx]/g, '******************'],
    // Email (keep domain)
    [/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '***@$2'],
  ];

  sanitize(content: string): string {
    let result = content;
    for (const [pattern, replacement] of this.patterns) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }
}

/**
 * TicketToKnowledgeService - Converts resolved tickets to knowledge articles
 */
export class TicketToKnowledgeService {
  private sanitizer: ContentSanitizer;

  constructor(
    private readonly mappingRepo: TicketKnowledgeMappingRepository,
  ) {
    this.sanitizer = new ContentSanitizer();
  }

  /**
   * Preview the conversion result without actually creating the knowledge article
   */
  async preview(ticket: TicketData): Promise<ConversionPreview> {
    const content = this.buildContent(ticket, true);
    const sanitizedContent = this.sanitizer.sanitize(content);

    return {
      title: ticket.title,
      content: sanitizedContent,
      tags: ticket.tags ?? [],
    };
  }

  /**
   * Convert a ticket to a knowledge article
   * Returns the created article ID from the knowledge service
   */
  async convert(
    ticket: TicketData,
    options: ConvertOptions,
    knowledgeService: { createDoc: (input: any) => Promise<string> },
    convertedBy: string,
  ): Promise<string> {
    const tenantId = getCurrentTenantId();

    // Check if already converted
    const alreadyConverted = await this.mappingRepo.existsByTicketId(tenantId, ticket.id);
    if (alreadyConverted) {
      throw new OrionError(`Ticket already converted to knowledge: ${ticket.id}`, 'ALREADY_EXISTS');
    }

    // Build and sanitize content
    const content = this.buildContent(ticket, options.includeComments ?? false);
    const sanitizedContent = this.sanitizer.sanitize(content);

    // Validate content length
    if (sanitizedContent.length < 50) {
      throw new OrionError('Ticket content too short for conversion (minimum 50 characters)', 'VALIDATION_ERROR');
    }

    // Create knowledge article via knowledge service
    const articleId = await knowledgeService.createDoc({
      title: ticket.title,
      content: sanitizedContent,
      categoryId: options.categoryId,
      tags: ticket.tags ?? [],
      metadata: {
        source: 'ticket',
        sourceId: ticket.id,
        priority: ticket.priority,
        originalAssignee: ticket.assignee,
      },
    });

    // Create mapping record
    await this.mappingRepo.create({
      tenantId,
      ticketId: ticket.id,
      knowledgeDocId: articleId,
      convertedBy,
      conversionType: options.autoClassify ? 'auto' : 'manual',
      includeComments: options.includeComments ?? false,
      metadata: {
        ticketTitle: ticket.title,
        ticketStatus: ticket.status,
      },
    });

    logger.info({ ticketId: ticket.id, articleId, convertedBy }, 'Ticket converted to knowledge');
    return articleId;
  }

  /**
   * Get knowledge articles associated with a ticket
   */
  async getMappingsByTicket(ticketId: string): Promise<TicketKnowledgeMappingEntity[]> {
    const tenantId = getCurrentTenantId();
    return this.mappingRepo.findByTicketId(tenantId, ticketId);
  }

  /**
   * Get the source ticket for a knowledge article
   */
  async getMappingByArticle(articleId: string): Promise<TicketKnowledgeMappingEntity | undefined> {
    const tenantId = getCurrentTenantId();
    return this.mappingRepo.findByKnowledgeDocId(tenantId, articleId);
  }

  /**
   * Build markdown content from ticket data
   */
  private buildContent(ticket: TicketData, includeComments: boolean): string {
    let content = `## Problem Description\n${ticket.description ?? 'N/A'}\n\n`;

    if (ticket.solution) {
      content += `## Solution\n${ticket.solution}\n\n`;
    }

    if (ticket.steps?.length) {
      content += `## Processing Steps\n`;
      ticket.steps.forEach((step, i) => {
        content += `${i + 1}. ${step.action} - ${step.result}\n`;
      });
      content += '\n';
    }

    if (includeComments && ticket.comments?.length) {
      content += `## Appendix (Comment History)\n`;
      ticket.comments.forEach((comment) => {
        content += `> **${comment.author}** at ${comment.createdAt}:\n> ${comment.content}\n\n`;
      });
    }

    return content;
  }
}
