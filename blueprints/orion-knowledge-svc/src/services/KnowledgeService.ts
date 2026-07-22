/**
 * KnowledgeService - Business logic layer for knowledge management
 *
 * Handles space/doc/rag/graph operations, document chunking, and RAG retrieval.
 */
import { KnowledgeRepository } from './KnowledgeRepository';
import { VectorRepository } from './VectorRepository';
import {
  KnowledgeSpace,
  KnowledgeDoc,
  DocumentChunk,
  DocVersion,
  GraphNode,
  GraphEdge,
  CreateSpaceInput,
  UpdateSpaceInput,
  CreateDocInput,
  UpdateDocInput,
  ListDocsFilter,
  PaginatedResult,
  RagRetrieveRequest,
  RagResult,
  RagQueryRequest,
  RagQueryResponse,
  GraphQueryRequest,
  GraphQueryResponse,
} from '../types/knowledge';

export class KnowledgeServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'KnowledgeServiceError';
  }
}

/**
 * Simple text chunking utility
 */
function chunkText(text: string, chunkSize: number, chunkOverlap: number): Array<{ content: string; tokenCount: number }> {
  const chunks: Array<{ content: string; tokenCount: number }> = [];
  if (text.length <= chunkSize) {
    chunks.push({ content: text, tokenCount: Math.ceil(text.length / 4) });
    return chunks;
  }

  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);

    // Try to break at word boundary
    if (end < text.length) {
      const lastSpace = chunk.lastIndexOf(' ');
      if (lastSpace > chunkSize * 0.5) {
        chunk = chunk.slice(0, lastSpace);
      }
    }

    chunks.push({ content: chunk.trim(), tokenCount: Math.ceil(chunk.length / 4) });
    start += chunkSize - chunkOverlap;
  }

  return chunks;
}

export class KnowledgeService {
  private repo: KnowledgeRepository;
  private vectorRepo: VectorRepository | null;
  private chunkSize: number;
  private chunkOverlap: number;
  private defaultTopK: number;
  private defaultScoreThreshold: number;

  constructor(
    repo: KnowledgeRepository,
    vectorRepo: VectorRepository | null,
    options?: {
      chunkSize?: number;
      chunkOverlap?: number;
      defaultTopK?: number;
      defaultScoreThreshold?: number;
    }
  ) {
    this.repo = repo;
    this.vectorRepo = vectorRepo;
    this.chunkSize = options?.chunkSize ?? 500;
    this.chunkOverlap = options?.chunkOverlap ?? 50;
    this.defaultTopK = options?.defaultTopK ?? 5;
    this.defaultScoreThreshold = options?.defaultScoreThreshold ?? 0.7;
  }

  // ==================== Spaces ====================

  async createSpace(input: CreateSpaceInput): Promise<KnowledgeSpace> {
    return this.repo.createSpace(input);
  }

  async getSpace(id: string): Promise<KnowledgeSpace> {
    const space = await this.repo.getSpaceById(id);
    if (!space) {
      throw new KnowledgeServiceError(`Space ${id} not found`, 'SPACE_NOT_FOUND');
    }
    return space;
  }

  async listSpaces(filter?: { ownerId?: string; teamId?: string; visibility?: string; status?: string }): Promise<KnowledgeSpace[]> {
    return this.repo.listSpaces(filter as any);
  }

  async updateSpace(id: string, input: UpdateSpaceInput): Promise<KnowledgeSpace> {
    const existing = await this.repo.getSpaceById(id);
    if (!existing) {
      throw new KnowledgeServiceError(`Space ${id} not found`, 'SPACE_NOT_FOUND');
    }
    const updated = await this.repo.updateSpace(id, input);
    if (!updated) {
      throw new KnowledgeServiceError(`Failed to update space ${id}`, 'SPACE_UPDATE_FAILED');
    }
    return updated;
  }

  async deleteSpace(id: string): Promise<boolean> {
    const existing = await this.repo.getSpaceById(id);
    if (!existing) {
      throw new KnowledgeServiceError(`Space ${id} not found`, 'SPACE_NOT_FOUND');
    }
    return this.repo.deleteSpace(id);
  }

  // ==================== Documents ====================

  async createDoc(input: CreateDocInput): Promise<KnowledgeDoc> {
    const space = await this.repo.getSpaceById(input.spaceId);
    if (!space) {
      throw new KnowledgeServiceError(`Space ${input.spaceId} not found`, 'SPACE_NOT_FOUND');
    }
    const doc = await this.repo.createDoc(input);
    await this.repo.incrementDocumentCount(input.spaceId, 1);
    return doc;
  }

  async getDoc(id: string): Promise<KnowledgeDoc> {
    const doc = await this.repo.getDocById(id);
    if (!doc) {
      throw new KnowledgeServiceError(`Document ${id} not found`, 'DOC_NOT_FOUND');
    }
    return doc;
  }

  async listDocs(filter: ListDocsFilter): Promise<PaginatedResult<KnowledgeDoc>> {
    return this.repo.listDocs(filter);
  }

  async updateDoc(id: string, input: UpdateDocInput): Promise<KnowledgeDoc> {
    const existing = await this.repo.getDocById(id);
    if (!existing) {
      throw new KnowledgeServiceError(`Document ${id} not found`, 'DOC_NOT_FOUND');
    }

    // If content is changing, create a version
    if (input.content !== undefined && input.content !== existing.content) {
      await this.repo.createDocVersion(id, existing.content, `Updated to version ${existing.version + 1}`, existing.authorId);
      await this.repo.updateDoc(id, input);
      const updated = await this.repo.getDocById(id);
      if (!updated) {
        throw new KnowledgeServiceError(`Document ${id} not found after update`, 'DOC_UPDATE_FAILED');
      }
      return updated;
    }

    const updated = await this.repo.updateDoc(id, input);
    if (!updated) {
      throw new KnowledgeServiceError(`Failed to update document ${id}`, 'DOC_UPDATE_FAILED');
    }
    return updated;
  }

  async deleteDoc(id: string): Promise<boolean> {
    const doc = await this.repo.getDocById(id);
    if (!doc) {
      throw new KnowledgeServiceError(`Document ${id} not found`, 'DOC_NOT_FOUND');
    }
    await this.repo.deleteChunksByDocId(id);
    if (this.vectorRepo) {
      await this.vectorRepo.deleteVectorsByRefId(id);
    }
    await this.repo.incrementDocumentCount(doc.spaceId, -1);
    return this.repo.deleteDoc(id);
  }

  async publishDoc(id: string): Promise<KnowledgeDoc> {
    const doc = await this.repo.getDocById(id);
    if (!doc) {
      throw new KnowledgeServiceError(`Document ${id} not found`, 'DOC_NOT_FOUND');
    }
    const updated = await this.repo.updateDoc(id, { status: 'published' });
    if (!updated) {
      throw new KnowledgeServiceError(`Failed to publish document ${id}`, 'DOC_PUBLISH_FAILED');
    }
    return updated;
  }

  // ==================== Document Versions ====================

  async getDocVersions(docId: string): Promise<DocVersion[]> {
    const doc = await this.repo.getDocById(docId);
    if (!doc) {
      throw new KnowledgeServiceError(`Document ${docId} not found`, 'DOC_NOT_FOUND');
    }
    return this.repo.getDocVersions(docId);
  }

  async getDocVersion(docId: string, version: number): Promise<DocVersion> {
    const v = await this.repo.getDocVersion(docId, version);
    if (!v) {
      throw new KnowledgeServiceError(`Version ${version} of document ${docId} not found`, 'VERSION_NOT_FOUND');
    }
    return v;
  }

  // ==================== Document Chunking ====================

  async chunkDocument(docId: string, chunkSize?: number, chunkOverlap?: number): Promise<DocumentChunk[]> {
    const doc = await this.repo.getDocById(docId);
    if (!doc) {
      throw new KnowledgeServiceError(`Document ${docId} not found`, 'DOC_NOT_FOUND');
    }

    await this.repo.deleteChunksByDocId(docId);

    const size = chunkSize ?? this.chunkSize;
    const overlap = chunkOverlap ?? this.chunkOverlap;
    const chunks = chunkText(doc.content, size, overlap);

    const createdChunks: DocumentChunk[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const c = await this.repo.createChunk(docId, i, chunks[i].content, {
        docId: doc.id,
        spaceId: doc.spaceId,
        docType: doc.docType,
        title: doc.title,
      }, chunks[i].tokenCount);
      createdChunks.push(c);
    }

    await this.repo.updateDocVectorized(docId, false, createdChunks.length);
    return createdChunks;
  }

  // ==================== RAG Retrieval ====================

  async retrieve(request: RagRetrieveRequest): Promise<RagResult[]> {
    if (!this.vectorRepo) {
      throw new KnowledgeServiceError('Vector repository not available for RAG retrieval', 'VECTOR_UNAVAILABLE');
    }

    const topK = request.topK ?? this.defaultTopK;
    const scoreThreshold = request.scoreThreshold ?? this.defaultScoreThreshold;
    const spaceIds = request.spaceIds || [];

    const metadataFilter: Record<string, unknown> = {};
    if (spaceIds.length > 0) {
      metadataFilter.spaceIds = spaceIds;
    }
    if (request.tagFilter && request.tagFilter.length > 0) {
      metadataFilter.tags = request.tagFilter;
    }
    if (request.metadataFilter) {
      Object.assign(metadataFilter, request.metadataFilter);
    }

    const searchResults = await this.vectorRepo.semanticSearch(request.query, {
      topK,
      scoreThreshold,
      metadataFilter,
    });

    const results: RagResult[] = [];
    for (const sr of searchResults) {
      const chunk = await this.repo.getChunkById(sr.refId);
      if (!chunk) continue;

      const doc = await this.repo.getDocById(chunk.docId);
      if (!doc) continue;

      results.push({
        chunkId: chunk.id,
        docId: doc.id,
        docTitle: doc.title,
        spaceId: doc.spaceId,
        content: request.includeContent !== false ? chunk.content : '',
        score: sr.score,
        metadata: chunk.metadata,
        tags: doc.tags,
        chunkIndex: chunk.chunkIndex,
      });
    }

    return results;
  }

  async queryRag(request: RagQueryRequest): Promise<RagQueryResponse> {
    const page = request.page || 1;
    const pageSize = request.pageSize || 20;

    const docFilter: ListDocsFilter = {
      spaceId: request.spaceId || '',
      status: request.status,
      page,
      pageSize,
    };

    const docsResult = await this.repo.listDocs(docFilter);
    const queryLower = request.query.toLowerCase();
    const scoredChunks: Array<{ chunk: DocumentChunk; score: number; doc: KnowledgeDoc }> = [];

    for (const doc of docsResult.items) {
      const chunks = await this.repo.getChunksByDocId(doc.id);
      if (chunks.length === 0) {
        // No chunks, score the doc content directly
        const contentLower = doc.content.toLowerCase();
        const titleLower = doc.title.toLowerCase();
        let score = 0;
        if (titleLower.includes(queryLower)) score += 1.0;
        const contentScore = contentLower.split(queryLower).length - 1;
        score += contentScore * 0.3;
        if (score > 0) {
          scoredChunks.push({
            chunk: { id: doc.id, docId: doc.id, chunkIndex: 0, content: doc.content, metadata: {}, createdAt: doc.createdAt },
            score: Math.min(score, 1.0),
            doc,
          });
        }
        continue;
      }

      for (const chunk of chunks) {
        const contentLower = chunk.content.toLowerCase();
        const titleLower = doc.title.toLowerCase();
        let score = 0;
        if (titleLower.includes(queryLower)) score += 1.0;
        const contentScore = contentLower.split(queryLower).length - 1;
        score += contentScore * 0.3;
        if (score > 0) {
          scoredChunks.push({ chunk, score: Math.min(score, 1.0), doc });
        }
      }
    }

    scoredChunks.sort((a, b) => b.score - a.score);
    const paginatedResults = scoredChunks.slice((page - 1) * pageSize, page * pageSize);

    const results: RagResult[] = paginatedResults.map((sc) => ({
      chunkId: sc.chunk.id,
      docId: sc.doc.id,
      docTitle: sc.doc.title,
      spaceId: sc.doc.spaceId,
      content: sc.chunk.content,
      score: sc.score,
      metadata: sc.chunk.metadata,
      tags: sc.doc.tags,
      chunkIndex: sc.chunk.chunkIndex,
    }));

    return { results, total: scoredChunks.length, page, pageSize };
  }

  async vectorizeDocument(docId: string): Promise<{ chunkCount: number; vectorCount: number }> {
    if (!this.vectorRepo) {
      throw new KnowledgeServiceError('Vector repository not available', 'VECTOR_UNAVAILABLE');
    }

    const doc = await this.repo.getDocById(docId);
    if (!doc) {
      throw new KnowledgeServiceError(`Document ${docId} not found`, 'DOC_NOT_FOUND');
    }

    const chunks = await this.chunkDocument(docId);
    await this.vectorRepo.deleteVectorsByRefId(docId);

    const vectorIds: string[] = [];
    const vectors: number[][] = [];
    const metadataList: Record<string, unknown>[] = [];

    for (const chunk of chunks) {
      const embedding = await this.vectorRepo.embed(chunk.content);
      vectorIds.push(chunk.id);
      vectors.push(embedding);
      metadataList.push({
        docId: doc.id,
        spaceId: doc.spaceId,
        chunkIndex: chunk.chunkIndex,
        docTitle: doc.title,
        tags: doc.tags,
      });
    }

    // Find an active vector store for this document's space, or use the first available store
    const stores = await this.vectorRepo.listStores({ spaceId: doc.spaceId, status: 'active' });
    if (stores.length === 0) {
      throw new KnowledgeServiceError(`No active vector store found for space ${doc.spaceId}`, 'NO_VECTOR_STORE');
    }
    const storeId = stores[0].id;

    const stored = await this.vectorRepo.batchStoreVectors(storeId, vectorIds, vectors, metadataList, 'chunk');
    await this.repo.updateDocVectorized(docId, true, chunks.length);

    return { chunkCount: chunks.length, vectorCount: stored.length };
  }

  // ==================== Knowledge Graph ====================

  async addGraphNode(spaceId: string, type: string, label: string, properties: Record<string, unknown>, sourceDocId?: string): Promise<GraphNode> {
    const space = await this.repo.getSpaceById(spaceId);
    if (!space) {
      throw new KnowledgeServiceError(`Space ${spaceId} not found`, 'SPACE_NOT_FOUND');
    }
    return this.repo.createGraphNode(spaceId, type, label, properties, sourceDocId);
  }

  async addGraphEdge(spaceId: string, sourceNodeId: string, targetNodeId: string, type: string, properties: Record<string, unknown>, sourceDocId?: string): Promise<GraphEdge> {
    const source = await this.repo.getGraphNodeById(sourceNodeId);
    if (!source) {
      throw new KnowledgeServiceError(`Source node ${sourceNodeId} not found`, 'NODE_NOT_FOUND');
    }
    const target = await this.repo.getGraphNodeById(targetNodeId);
    if (!target) {
      throw new KnowledgeServiceError(`Target node ${targetNodeId} not found`, 'NODE_NOT_FOUND');
    }
    return this.repo.createGraphEdge(spaceId, sourceNodeId, targetNodeId, type, properties, sourceDocId);
  }

  async queryGraph(request: GraphQueryRequest): Promise<GraphQueryResponse> {
    return this.repo.queryGraph(request);
  }

  async deleteGraphNode(id: string): Promise<boolean> {
    return this.repo.deleteGraphNode(id);
  }

  async deleteGraphEdge(id: string): Promise<boolean> {
    return this.repo.deleteGraphEdge(id);
  }

  async getGraphStats(spaceId: string): Promise<{ nodeCount: number; edgeCount: number; typeDistribution: Record<string, number> }> {
    return this.repo.getGraphStats(spaceId);
  }

  async extractGraphFromDoc(spaceId: string, docId: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const doc = await this.repo.getDocById(docId);
    if (!doc) {
      throw new KnowledgeServiceError(`Document ${docId} not found`, 'DOC_NOT_FOUND');
    }
    if (doc.spaceId !== spaceId) {
      throw new KnowledgeServiceError(`Document ${docId} does not belong to space ${spaceId}`, 'DOC_SPACE_MISMATCH');
    }

    const content = doc.content;
    const sentences = content.split(/[.!?]\s+/).filter((s) => s.trim().length > 0);

    const entityRegex = /"([^"]+)"|([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)/g;
    const entities = new Set<string>();
    let match;

    while ((match = entityRegex.exec(content)) !== null) {
      const entity = (match[1] || match[2] || '').trim();
      if (entity.length > 2) {
        entities.add(entity);
      }
    }

    const nodes: GraphNode[] = [];
    const entityToNodeId = new Map<string, string>();

    for (const entity of entities) {
      const node = await this.repo.createGraphNode(spaceId, 'entity', entity, { source: doc.id, extractedFrom: doc.title }, docId);
      nodes.push(node);
      entityToNodeId.set(entity, node.id);
    }

    const edges: GraphEdge[] = [];
    for (const sentence of sentences) {
      const sentenceEntities: string[] = [];
      let entityMatch;
      const localRegex = /"([^"]+)"|([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)/g;
      while ((entityMatch = localRegex.exec(sentence)) !== null) {
        const entity = (entityMatch[1] || entityMatch[2] || '').trim();
        if (entity.length > 2 && entityToNodeId.has(entity)) {
          sentenceEntities.push(entity);
        }
      }

      for (let i = 0; i < sentenceEntities.length; i++) {
        for (let j = i + 1; j < sentenceEntities.length; j++) {
          const sourceId = entityToNodeId.get(sentenceEntities[i])!;
          const targetId = entityToNodeId.get(sentenceEntities[j])!;

          const existing = edges.find(
            (e) =>
              (e.sourceNodeId === sourceId && e.targetNodeId === targetId) ||
              (e.sourceNodeId === targetId && e.targetNodeId === sourceId)
          );

          if (!existing) {
            const edge = await this.repo.createGraphEdge(spaceId, sourceId, targetId, 'co-occurrence', { sentence, weight: 1, source: doc.id }, docId);
            edges.push(edge);
          }
        }
      }
    }

    return { nodes, edges };
  }
}
