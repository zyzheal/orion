/**
 * KnowledgeRepository - Database layer for all knowledge operations
 *
 * Handles PostgreSQL CRUD for spaces, documents, chunks, versions, and graph data.
 */
import { DatabasePool } from '../utils/database';
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
  SpaceVisibility,
  SpaceStatus,
  DocStatus,
  DocType,
  GraphQueryRequest,
} from '../types/knowledge';

export class KnowledgeRepository {
  constructor(private pool: DatabasePool) {}

  // ==================== Spaces ====================

  async createSpace(input: CreateSpaceInput): Promise<KnowledgeSpace> {
    const result = await this.pool.query(
      `INSERT INTO knowledge_spaces (name, description, visibility, owner_id, team_id, tags, config, vector_indexing_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        input.name,
        input.description || null,
        input.visibility || 'private',
        input.ownerId,
        input.teamId || null,
        input.tags || [],
        JSON.stringify(input.config || {}),
        (input.config as Record<string, unknown>)?.vectorIndexingEnabled || false,
      ]
    );
    return this.mapSpaceRow(result.rows[0]);
  }

  async getSpaceById(id: string): Promise<KnowledgeSpace | null> {
    const result = await this.pool.query('SELECT * FROM knowledge_spaces WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.mapSpaceRow(result.rows[0]) : null;
  }

  async listSpaces(filter?: {
    ownerId?: string;
    teamId?: string;
    visibility?: SpaceVisibility;
    status?: SpaceStatus;
  }): Promise<KnowledgeSpace[]> {
    let sql = 'SELECT * FROM knowledge_spaces WHERE 1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (filter?.ownerId) {
      sql += ` AND owner_id = $${idx++}`;
      params.push(filter.ownerId);
    }
    if (filter?.teamId) {
      sql += ` AND team_id = $${idx++}`;
      params.push(filter.teamId);
    }
    if (filter?.visibility) {
      sql += ` AND visibility = $${idx++}`;
      params.push(filter.visibility);
    }
    if (filter?.status) {
      sql += ` AND status = $${idx++}`;
      params.push(filter.status);
    }
    sql += ' ORDER BY created_at DESC';

    const result = await this.pool.query(sql, params);
    return result.rows.map((r: Record<string, unknown>) => this.mapSpaceRow(r));
  }

  async updateSpace(id: string, input: UpdateSpaceInput): Promise<KnowledgeSpace | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { sets.push(`name = $${idx++}`); params.push(input.name); }
    if (input.description !== undefined) { sets.push(`description = $${idx++}`); params.push(input.description); }
    if (input.visibility !== undefined) { sets.push(`visibility = $${idx++}`); params.push(input.visibility); }
    if (input.status !== undefined) { sets.push(`status = $${idx++}`); params.push(input.status); }
    if (input.teamId !== undefined) { sets.push(`team_id = $${idx++}`); params.push(input.teamId); }
    if (input.tags !== undefined) { sets.push(`tags = $${idx++}`); params.push(input.tags); }
    if (input.config !== undefined) {
      sets.push(`config = COALESCE(config, '{}'::jsonb) || $${idx++}::jsonb`);
      params.push(JSON.stringify(input.config));
    }
    sets.push(`updated_at = NOW()`);

    if (sets.length <= 1) return null;

    params.push(id);
    const sql = `UPDATE knowledge_spaces SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows.length > 0 ? this.mapSpaceRow(result.rows[0]) : null;
  }

  async deleteSpace(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM knowledge_spaces WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async incrementDocumentCount(spaceId: string, delta: number = 1): Promise<void> {
    await this.pool.query(
      'UPDATE knowledge_spaces SET document_count = document_count + $1, updated_at = NOW() WHERE id = $2',
      [delta, spaceId]
    );
  }

  // ==================== Documents ====================

  async createDoc(input: CreateDocInput): Promise<KnowledgeDoc> {
    const result = await this.pool.query(
      `INSERT INTO knowledge_docs (space_id, title, content, doc_type, tags, metadata, source_url, author_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        input.spaceId,
        input.title,
        input.content,
        input.docType || 'text',
        input.tags || [],
        JSON.stringify(input.metadata || {}),
        input.sourceUrl || null,
        input.authorId || null,
      ]
    );
    return this.mapDocRow(result.rows[0]);
  }

  async getDocById(id: string): Promise<KnowledgeDoc | null> {
    const result = await this.pool.query('SELECT * FROM knowledge_docs WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.mapDocRow(result.rows[0]) : null;
  }

  async listDocs(filter: ListDocsFilter): Promise<PaginatedResult<KnowledgeDoc>> {
    let sql = 'SELECT * FROM knowledge_docs WHERE space_id = $1';
    const params: unknown[] = [filter.spaceId];
    let idx = 2;

    if (filter.status) {
      sql += ` AND status = $${idx++}`;
      params.push(filter.status);
    }
    if (filter.docType) {
      sql += ` AND doc_type = $${idx++}`;
      params.push(filter.docType);
    }
    if (filter.tagFilter && filter.tagFilter.length > 0) {
      sql += ` AND tags && $${idx++}`;
      params.push(filter.tagFilter);
    }

    // Count
    const countSql = `SELECT COUNT(*) as total FROM knowledge_docs WHERE space_id = $1` +
      (filter.status ? ` AND status = $2` : '') +
      (filter.docType ? ` AND doc_type = $${filter.status ? 3 : 2}` : '') +
      (filter.tagFilter && filter.tagFilter.length > 0 ? ` AND tags && $${idx}` : '');
    const countResult = await this.pool.query(countSql, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Pagination
    const page = filter.page || 1;
    const pageSize = filter.pageSize || 20;
    sql += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(pageSize, (page - 1) * pageSize);

    const result = await this.pool.query(sql, params);
    return {
      items: result.rows.map((r: Record<string, unknown>) => this.mapDocRow(r)),
      total,
      page,
      pageSize,
    };
  }

  async updateDoc(id: string, input: UpdateDocInput): Promise<KnowledgeDoc | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (input.title !== undefined) { sets.push(`title = $${idx++}`); params.push(input.title); }
    if (input.content !== undefined) { sets.push(`content = $${idx++}`); params.push(input.content); }
    if (input.status !== undefined) { sets.push(`status = $${idx++}`); params.push(input.status); }
    if (input.summary !== undefined) { sets.push(`summary = $${idx++}`); params.push(input.summary); }
    if (input.tags !== undefined) { sets.push(`tags = $${idx++}`); params.push(input.tags); }
    if (input.metadata !== undefined) {
      sets.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${idx++}::jsonb`);
      params.push(JSON.stringify(input.metadata));
    }
    sets.push(`updated_at = NOW()`);

    if (sets.length <= 1) return null;

    params.push(id);
    const sql = `UPDATE knowledge_docs SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows.length > 0 ? this.mapDocRow(result.rows[0]) : null;
  }

  async updateDocVectorized(id: string, vectorized: boolean, chunkCount?: number): Promise<void> {
    await this.pool.query(
      'UPDATE knowledge_docs SET vectorized = $1, chunk_count = $2, updated_at = NOW() WHERE id = $3',
      [vectorized, chunkCount || null, id]
    );
  }

  async deleteDoc(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM knowledge_docs WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== Document Versions ====================

  async createDocVersion(docId: string, content: string, changeLog?: string, authorId?: string): Promise<DocVersion> {
    // Get current version number
    const currentResult = await this.pool.query(
      'SELECT COALESCE(MAX(version), 0) as max_version FROM doc_versions WHERE doc_id = $1',
      [docId]
    );
    const nextVersion = parseInt(currentResult.rows[0].max_version, 10) + 1;

    const result = await this.pool.query(
      'INSERT INTO doc_versions (doc_id, version, content, change_log, author_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [docId, nextVersion, content, changeLog || null, authorId || null]
    );
    return this.mapVersionRow(result.rows[0]);
  }

  async getDocVersions(docId: string): Promise<DocVersion[]> {
    const result = await this.pool.query(
      'SELECT * FROM doc_versions WHERE doc_id = $1 ORDER BY version DESC',
      [docId]
    );
    return result.rows.map((r: Record<string, unknown>) => this.mapVersionRow(r));
  }

  async getDocVersion(docId: string, version: number): Promise<DocVersion | null> {
    const result = await this.pool.query(
      'SELECT * FROM doc_versions WHERE doc_id = $1 AND version = $2',
      [docId, version]
    );
    return result.rows.length > 0 ? this.mapVersionRow(result.rows[0]) : null;
  }

  // ==================== Document Chunks ====================

  async createChunk(docId: string, chunkIndex: number, content: string, metadata?: Record<string, unknown>, tokenCount?: number): Promise<DocumentChunk> {
    const result = await this.pool.query(
      'INSERT INTO document_chunks (doc_id, chunk_index, content, metadata, token_count) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [docId, chunkIndex, content, JSON.stringify(metadata || {}), tokenCount || null]
    );
    return this.mapChunkRow(result.rows[0]);
  }

  async createChunks(docId: string, chunks: Array<{ chunkIndex: number; content: string; metadata?: Record<string, unknown>; tokenCount?: number }>): Promise<DocumentChunk[]> {
    const results: DocumentChunk[] = [];
    for (const c of chunks) {
      results.push(await this.createChunk(docId, c.chunkIndex, c.content, c.metadata, c.tokenCount));
    }
    return results;
  }

  async getChunksByDocId(docId: string): Promise<DocumentChunk[]> {
    const result = await this.pool.query(
      'SELECT * FROM document_chunks WHERE doc_id = $1 ORDER BY chunk_index ASC',
      [docId]
    );
    return result.rows.map((r: Record<string, unknown>) => this.mapChunkRow(r));
  }

  async deleteChunksByDocId(docId: string): Promise<void> {
    await this.pool.query('DELETE FROM document_chunks WHERE doc_id = $1', [docId]);
  }

  async getChunkById(chunkId: string): Promise<DocumentChunk | null> {
    const result = await this.pool.query('SELECT * FROM document_chunks WHERE id = $1', [chunkId]);
    return result.rows.length > 0 ? this.mapChunkRow(result.rows[0]) : null;
  }

  // ==================== Knowledge Graph ====================

  async createGraphNode(spaceId: string, type: string, label: string, properties: Record<string, unknown>, sourceDocId?: string): Promise<GraphNode> {
    const result = await this.pool.query(
      'INSERT INTO graph_nodes (space_id, type, label, properties, source_doc_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [spaceId, type, label, JSON.stringify(properties), sourceDocId || null]
    );
    return this.mapNodeRow(result.rows[0]);
  }

  async batchCreateGraphNodes(nodes: Array<{ spaceId: string; type: string; label: string; properties: Record<string, unknown>; sourceDocId?: string }>): Promise<GraphNode[]> {
    const results: GraphNode[] = [];
    for (const n of nodes) {
      results.push(await this.createGraphNode(n.spaceId, n.type, n.label, n.properties, n.sourceDocId));
    }
    return results;
  }

  async createGraphEdge(spaceId: string, sourceNodeId: string, targetNodeId: string, type: string, properties: Record<string, unknown>, sourceDocId?: string): Promise<GraphEdge> {
    const result = await this.pool.query(
      'INSERT INTO graph_edges (space_id, source_node_id, target_node_id, type, properties, source_doc_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [spaceId, sourceNodeId, targetNodeId, type, JSON.stringify(properties), sourceDocId || null]
    );
    return this.mapEdgeRow(result.rows[0]);
  }

  async batchCreateGraphEdges(edges: Array<{ spaceId: string; sourceNodeId: string; targetNodeId: string; type: string; properties: Record<string, unknown>; sourceDocId?: string }>): Promise<GraphEdge[]> {
    const results: GraphEdge[] = [];
    for (const e of edges) {
      results.push(await this.createGraphEdge(e.spaceId, e.sourceNodeId, e.targetNodeId, e.type, e.properties, e.sourceDocId));
    }
    return results;
  }

  async queryGraph(request: GraphQueryRequest): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    let nodeSql = 'SELECT * FROM graph_nodes WHERE space_id = $1';
    const params: unknown[] = [request.spaceId];
    let idx = 2;

    if (request.nodeTypes && request.nodeTypes.length > 0) {
      nodeSql += ` AND type = ANY($${idx++})`;
      params.push(request.nodeTypes);
    }
    if (request.labelQuery) {
      nodeSql += ` AND label ILIKE $${idx++}`;
      params.push(`%${request.labelQuery}%`);
    }
    if (request.startNodeIds && request.startNodeIds.length > 0) {
      nodeSql += ` AND id = ANY($${idx++})`;
      params.push(request.startNodeIds);
    }

    const nodesResult = await this.pool.query(nodeSql, params);
    const nodes = nodesResult.rows.map((r: Record<string, unknown>) => this.mapNodeRow(r));

    if (nodes.length === 0) {
      return { nodes: [], edges: [] };
    }

    const nodeIds = nodes.map((n) => n.id);
    let edgeSql = 'SELECT * FROM graph_edges WHERE space_id = $1 AND (source_node_id = ANY($2) OR target_node_id = ANY($3))';
    const edgeParams: unknown[] = [request.spaceId, nodeIds, nodeIds];
    let edgeIdx = 4;

    if (request.edgeTypes && request.edgeTypes.length > 0) {
      edgeSql += ` AND type = ANY($${edgeIdx++})`;
      edgeParams.push(request.edgeTypes);
    }

    const edgesResult = await this.pool.query(edgeSql, edgeParams);
    const edges = edgesResult.rows.map((r: Record<string, unknown>) => this.mapEdgeRow(r));

    // Expand graph to maxDepth if requested
    if (request.maxDepth && request.maxDepth > 1) {
      const visitedNodeIds = new Set(nodeIds);
      let currentLevelIds = nodeIds;

      for (let depth = 1; depth < request.maxDepth; depth++) {
        const expandSql = `
          SELECT DISTINCT gn.* FROM graph_nodes gn
          JOIN graph_edges ge ON (gn.id = ge.source_node_id OR gn.id = ge.target_node_id)
          WHERE gn.space_id = $1 AND (ge.source_node_id = ANY($2) OR ge.target_node_id = ANY($2))
          AND gn.id != ALL($3)
        `;
        const expandResult = await this.pool.query(expandSql, [request.spaceId, currentLevelIds, Array.from(visitedNodeIds)]);
        const newNodes = expandResult.rows.map((r: Record<string, unknown>) => this.mapNodeRow(r));

        if (newNodes.length === 0) break;

        for (const node of newNodes) {
          if (!visitedNodeIds.has(node.id)) {
            visitedNodeIds.add(node.id);
            nodes.push(node);
          }
        }

        currentLevelIds = newNodes.map((n) => n.id);

        // Get edges connecting to new nodes
        const newEdgeSql = `
          SELECT * FROM graph_edges WHERE space_id = $1
          AND (source_node_id = ANY($2) OR target_node_id = ANY($2))
        `;
        const newEdgeResult = await this.pool.query(newEdgeSql, [request.spaceId, currentLevelIds]);
        for (const edge of newEdgeResult.rows) {
          const edgeObj = this.mapEdgeRow(edge as Record<string, unknown>);
          if (!edges.find((e: GraphEdge) => e.id === edgeObj.id)) {
            edges.push(edgeObj);
          }
        }
      }
    }

    return { nodes, edges };
  }

  async getGraphNodeById(id: string): Promise<GraphNode | null> {
    const result = await this.pool.query('SELECT * FROM graph_nodes WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.mapNodeRow(result.rows[0]) : null;
  }

  async getGraphEdgeById(id: string): Promise<GraphEdge | null> {
    const result = await this.pool.query('SELECT * FROM graph_edges WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.mapEdgeRow(result.rows[0]) : null;
  }

  async deleteGraphNode(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM graph_nodes WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async deleteGraphEdge(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM graph_edges WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getGraphStats(spaceId: string): Promise<{ nodeCount: number; edgeCount: number; typeDistribution: Record<string, number> }> {
    const nodeResult = await this.pool.query(
      'SELECT COUNT(*) as count, type FROM graph_nodes WHERE space_id = $1 GROUP BY type',
      [spaceId]
    );
    const typeDistribution: Record<string, number> = {};
    let nodeCount = 0;
    for (const row of nodeResult.rows) {
      typeDistribution[row.type] = parseInt(row.count, 10);
      nodeCount += parseInt(row.count, 10);
    }

    const edgeResult = await this.pool.query(
      'SELECT COUNT(*) as count FROM graph_edges WHERE space_id = $1',
      [spaceId]
    );
    const edgeCount = parseInt(edgeResult.rows[0].count, 10);

    return { nodeCount, edgeCount, typeDistribution };
  }

  // ==================== Row Mappers ====================

  private mapSpaceRow(row: Record<string, unknown>): KnowledgeSpace {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      visibility: row.visibility as SpaceVisibility,
      status: row.status as SpaceStatus,
      ownerId: row.owner_id as string,
      teamId: row.team_id as string | undefined,
      tags: (row.tags as string[]) || [],
      config: ((row.config as Record<string, unknown>) || {}) as Partial<Record<string, string | number | boolean>>,
      documentCount: row.document_count as number,
      vectorIndexingEnabled: (row.vector_indexing_enabled as boolean) || false,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }

  private mapDocRow(row: Record<string, unknown>): KnowledgeDoc {
    return {
      id: row.id as string,
      spaceId: row.space_id as string,
      title: row.title as string,
      content: row.content as string,
      docType: row.doc_type as DocType,
      status: row.status as DocStatus,
      summary: row.summary as string | undefined,
      tags: (row.tags as string[]) || [],
      metadata: ((row.metadata as Record<string, unknown>) || {}) as Record<string, string | number | boolean>,
      sourceUrl: row.source_url as string | undefined,
      version: row.version as number,
      authorId: row.author_id as string | undefined,
      vectorized: row.vectorized as boolean,
      chunkCount: row.chunk_count as number | undefined,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
      publishedAt: row.published_at as Date | undefined,
    };
  }

  private mapChunkRow(row: Record<string, unknown>): DocumentChunk {
    return {
      id: row.id as string,
      docId: row.doc_id as string,
      chunkIndex: row.chunk_index as number,
      content: row.content as string,
      metadata: ((row.metadata as Record<string, unknown>) || {}) as Record<string, string | number | boolean>,
      embeddingId: row.embedding_id as string | undefined,
      tokenCount: row.token_count as number | undefined,
      createdAt: row.created_at as Date,
    };
  }

  private mapVersionRow(row: Record<string, unknown>): DocVersion {
    return {
      id: row.id as string,
      docId: row.doc_id as string,
      version: row.version as number,
      content: row.content as string,
      changeLog: row.change_log as string | undefined,
      authorId: row.author_id as string | undefined,
      createdAt: row.created_at as Date,
    };
  }

  private mapNodeRow(row: Record<string, unknown>): GraphNode {
    return {
      id: row.id as string,
      spaceId: row.space_id as string,
      type: row.type as string,
      label: row.label as string,
      properties: ((row.properties as Record<string, unknown>) || {}) as Record<string, string | number | boolean>,
      sourceDocId: row.source_doc_id as string | undefined,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }

  private mapEdgeRow(row: Record<string, unknown>): GraphEdge {
    return {
      id: row.id as string,
      spaceId: row.space_id as string,
      sourceNodeId: row.source_node_id as string,
      targetNodeId: row.target_node_id as string,
      type: row.type as string,
      properties: ((row.properties as Record<string, unknown>) || {}) as Record<string, string | number | boolean>,
      sourceDocId: row.source_doc_id as string | undefined,
      createdAt: row.created_at as Date,
    };
  }
}
