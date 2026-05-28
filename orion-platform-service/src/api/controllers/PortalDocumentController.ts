/**
 * PortalDocumentController - Fastify HTTP request/response handlers
 *
 * Bridges HTTP layer to PortalDocumentService
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { tenantContext } from '../../services/tenant/TenantContext';
import {
  PortalDocumentService,
  PortalDocumentServiceError,
} from '../../services/developer-portal/PortalDocumentService';
import { OrionError, ErrorCode } from '../../../errors';

export class PortalDocumentController {
  private service: PortalDocumentService;

  constructor(service: PortalDocumentService) {
    this.service = service;
  }

  /**
   * Get tenant ID from request context
   */
  private getTenantId(request: FastifyRequest): string {
    const tenant = tenantContext.getCurrentTenant();
    if (!tenant) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'No tenant context available');
    }
    return String(tenant.tenantId);
  }

  /**
   * Get author ID from request user context
   */
  private getAuthorId(request: FastifyRequest): string {
    const user = (request as any).user;
    return user?.userId || user?.sub || 'system';
  }

  // ==================== Document CRUD ====================

  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const body = request.body as Record<string, unknown>;

      if (!body.title || !body.slug || !body.content || !body.documentType) {
        await reply.status(400).send({
          success: false,
          error: 'title, slug, content, and documentType are required',
        });
        return;
      }

      const doc = await this.service.createDocument({
        tenantId,
        title: body.title as string,
        slug: body.slug as string,
        content: body.content as string,
        contentFormat: body.contentFormat as string | undefined,
        documentType: body.documentType as string,
        category: body.category as string | undefined,
        tags: (body.tags as string[]) ?? [],
        version: body.version as string | undefined,
        authorId: this.getAuthorId(request),
        metadata: (body.metadata as Record<string, any>) ?? {},
      });

      await reply.status(201).send({ success: true, data: doc });
    } catch (err) {
      if (err instanceof PortalDocumentServiceError && err.code === 'DUPLICATE_SLUG') {
        await reply.status(409).send({ success: false, error: 'Slug already exists' });
        return;
      }
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create document',
      });
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const doc = await this.service.getDocumentById(params.id);
      await reply.send({ success: true, data: doc });
    } catch (err) {
      if (err instanceof PortalDocumentServiceError && err.code === 'DOCUMENT_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Document not found' });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string | undefined>;
      const tags = query.tags ? query.tags.split(',') : undefined;

      const result = await this.service.getDocuments({
        tenantId: this.getTenantId(request),
        type: query.type,
        category: query.category,
        tags,
        published: query.published !== undefined ? query.published === 'true' : undefined,
        page: query.page ? parseInt(query.page, 10) : undefined,
        limit: query.perPage ? parseInt(query.perPage, 10) : undefined,
      });

      await reply.send({
        success: true,
        data: result.data,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, unknown>;

      const doc = await this.service.updateDocument(
        params.id,
        {
          title: body.title as string | undefined,
          slug: body.slug as string | undefined,
          content: body.content as string | undefined,
          contentFormat: body.contentFormat as string | undefined,
          documentType: body.documentType as string | undefined,
          category: body.category as string | undefined,
          tags: body.tags as string[] | undefined,
          version: body.version as string | undefined,
          metadata: body.metadata as Record<string, any> | undefined,
        },
        this.getAuthorId(request),
      );

      await reply.send({ success: true, data: doc });
    } catch (err) {
      if (err instanceof PortalDocumentServiceError && err.code === 'DOCUMENT_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Document not found' });
        return;
      }
      if (err instanceof PortalDocumentServiceError && err.code === 'DUPLICATE_SLUG') {
        await reply.status(409).send({ success: false, error: 'Slug already exists' });
        return;
      }
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update document',
      });
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const deleted = await this.service.deleteDocument(params.id);
      if (!deleted) {
        await reply.status(404).send({ success: false, error: 'Document not found' });
        return;
      }
      await reply.send({ success: true, message: 'Document deleted' });
    } catch (err) {
      if (err instanceof PortalDocumentServiceError && err.code === 'DOCUMENT_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Document not found' });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Search ====================

  async search(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string | undefined>;
      const searchQuery = query.q;

      if (!searchQuery) {
        await reply.status(400).send({
          success: false,
          error: 'Search query parameter "q" is required',
        });
        return;
      }

      const docs = await this.service.searchDocuments(
        this.getTenantId(request),
        searchQuery,
        {
          type: query.type,
          category: query.category,
        },
      );

      await reply.send({ success: true, data: docs, total: docs.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Publishing ====================

  async publish(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const doc = await this.service.publishDocument(params.id);
      await reply.send({ success: true, data: doc, message: 'Document published' });
    } catch (err) {
      if (err instanceof PortalDocumentServiceError && err.code === 'DOCUMENT_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Document not found' });
        return;
      }
      if (err instanceof PortalDocumentServiceError && err.code === 'ALREADY_PUBLISHED') {
        await reply.status(400).send({ success: false, error: 'Document is already published' });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async unpublish(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const doc = await this.service.unpublishDocument(params.id);
      await reply.send({ success: true, data: doc, message: 'Document unpublished' });
    } catch (err) {
      if (err instanceof PortalDocumentServiceError && err.code === 'DOCUMENT_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Document not found' });
        return;
      }
      if (err instanceof PortalDocumentServiceError && err.code === 'NOT_PUBLISHED') {
        await reply.status(400).send({ success: false, error: 'Document is not published' });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Categories ====================

  async getCategories(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const categories = await this.service.getCategories(this.getTenantId(request));
      await reply.send({ success: true, data: categories, total: categories.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Popular Documents ====================

  async getPopular(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string | undefined>;
      const limit = query.limit ? parseInt(query.limit, 10) : 10;
      const docs = await this.service.getPopularDocuments(this.getTenantId(request), limit);
      await reply.send({ success: true, data: docs, total: docs.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Helpful Feedback ====================

  async recordHelpful(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, unknown>;
      const isHelpful = body.isHelpful === true;

      await this.service.recordHelpful(params.id, isHelpful);
      await reply.send({ success: true, message: 'Feedback recorded' });
    } catch (err) {
      if (err instanceof PortalDocumentServiceError && err.code === 'DOCUMENT_NOT_FOUND') {
        await reply.status(404).send({ success: false, error: 'Document not found' });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }
}
