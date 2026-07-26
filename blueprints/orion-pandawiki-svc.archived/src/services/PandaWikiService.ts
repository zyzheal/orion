/**
 * PandaWiki Service - Core knowledge base proxy
 *
 * Proxies requests to PandaWiki backend while adding
 * tenant isolation, NATS integration, and unified API.
 */

import { config } from '../config';
import type { WikiSpace, WikiDocument, WikiQuery, WikiSearchResult } from '../types/pandawiki';

export class PandaWikiService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.pandawiki.url;
    this.apiKey = config.pandawiki.apiKey;
  }

  private async proxyToPandaWiki(method: string, path: string, body?: unknown): Promise<any> {
    const url = `${this.baseUrl}/api${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(config.pandawiki.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`PandaWiki backend error (${response.status}): ${error}`);
    }

    return response.json();
  }

  // ==================== Space Management ====================

  async createSpace(tenantId: string, input: { name: string; description?: string }): Promise<WikiSpace> {
    const result = await this.proxyToPandaWiki('POST', '/v1/spaces', {
      ...input,
      tenantId,
    });
    return result.data;
  }

  async listSpaces(tenantId: string): Promise<WikiSpace[]> {
    const result = await this.proxyToPandaWiki('GET', `/v1/spaces?tenantId=${tenantId}`);
    return result.data;
  }

  async getSpace(id: string): Promise<WikiSpace | null> {
    const result = await this.proxyToPandaWiki('GET', `/v1/spaces/${id}`);
    return result.data;
  }

  // ==================== Document Management ====================

  async createDocument(tenantId: string, userId: string, input: {
    spaceId: string;
    title: string;
    content: string;
    parentId?: string;
    tags?: string[];
  }): Promise<WikiDocument> {
    const result = await this.proxyToPandaWiki('POST', '/v1/documents', {
      ...input,
      tenantId,
      createdBy: userId,
    });
    return result.data;
  }

  async getDocument(id: string): Promise<WikiDocument | null> {
    const result = await this.proxyToPandaWiki('GET', `/v1/documents/${id}`);
    return result.data;
  }

  async updateDocument(id: string, input: Partial<WikiDocument>): Promise<WikiDocument> {
    const result = await this.proxyToPandaWiki('PUT', `/v1/documents/${id}`, input);
    return result.data;
  }

  async deleteDocument(id: string): Promise<void> {
    await this.proxyToPandaWiki('DELETE', `/v1/documents/${id}`);
  }

  async listDocuments(query: WikiQuery): Promise<{ data: WikiDocument[]; total: number }> {
    const params = new URLSearchParams();
    if (query.spaceId) params.set('spaceId', query.spaceId);
    if (query.tenantId) params.set('tenantId', query.tenantId);
    if (query.q) params.set('q', query.q);
    params.set('page', String(query.page || 1));
    params.set('limit', String(query.limit || 20));

    const result = await this.proxyToPandaWiki('GET', `/v1/documents?${params.toString()}`);
    return result.data;
  }

  // ==================== Search ====================

  async search(query: WikiQuery): Promise<WikiSearchResult[]> {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (query.spaceId) params.set('spaceId', query.spaceId);
    if (query.tenantId) params.set('tenantId', query.tenantId);

    const result = await this.proxyToPandaWiki('GET', `/v1/search?${params.toString()}`);
    return result.data;
  }

  // ==================== AI Query ====================

  async askQuestion(spaceId: string, question: string): Promise<{ answer: string; sources: string[] }> {
    const result = await this.proxyToPandaWiki('POST', '/v1/ai/ask', {
      spaceId,
      question,
    });
    return result.data;
  }
}
