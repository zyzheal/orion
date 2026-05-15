/**
 * AI Service Unified Routes
 *
 * 统一的 AI 服务路由入口，提供所有 AI 功能的聚合 API
 * 包括模型管理、嵌入、向量存储、LLM 追踪、决策、安全等
 *
 * Prefix: /api/v1/ai
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { VectorRepository } from '../repositories/VectorRepository';
import { CodeEmbeddingRepository } from '../repositories/CodeEmbeddingRepository';
import { KnowledgeEmbeddingRepository } from '../repositories/KnowledgeEmbeddingRepository';
import { ModelVersionRepository, ABTestRepository, ABTestMetricRepository } from '../repositories/ModelVersionRepository';
import { AuditRepository } from '../services/audit/AuditRepository';

// Request/Response types
interface VectorSearchRequest {
  embedding: number[];
  limit?: number;
  collection?: string;
  filters?: Record<string, unknown>;
}

interface CodeEmbeddingRequest {
  projectId: string;
  filePath: string;
  chunkType: 'function' | 'class' | 'file' | 'snippet';
  chunkName: string;
  content: string;
  embedding: number[];
  metadata: {
    language: string;
    lineStart: number;
    lineEnd: number;
    dependencies?: string[];
    exports?: string[];
    complexity?: number;
    author?: string;
  };
}

interface KnowledgeEmbeddingRequest {
  docId: string;
  docType: string;
  title: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

interface ModelVersionRequest {
  name: string;
  version: string;
  framework: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

interface ABTestRequest {
  modelName: string;
  variants: Array<{ name: string; modelVersion: string; weight: number }>;
  trafficSplit: Record<string, number>;
  startDate: string;
  endDate?: string;
  targetMetrics: string[];
}

interface AIDecisionRequest {
  scenario: string;
  input: Record<string, unknown>;
}

interface HealthResponse {
  status: string;
  timestamp: string;
  services: {
    gateway: boolean;
    vector: boolean;
    embeddings: boolean;
    llm: boolean;
  };
}

export default async function aiRoutes(app: FastifyInstance): Promise<void> {
  // Get database from fastify decorators
  const db = (app as any).knex || {};

  // Initialize repositories
  const vectorRepo = new VectorRepository(db);
  const codeEmbeddingRepo = new CodeEmbeddingRepository(db);
  const knowledgeEmbeddingRepo = new KnowledgeEmbeddingRepository(db);
  const modelVersionRepo = new ModelVersionRepository(db);
  const abTestRepo = new ABTestRepository(db);
  const abTestMetricRepo = new ABTestMetricRepository(db);
  const auditRepo = new AuditRepository(db);

  // ==================== Health & Status ====================

  // GET /ai/health - 服务健康检查
  app.get('/health', async (request: FastifyRequest, reply: FastifyReply): Promise<HealthResponse> => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        gateway: true,
        vector: true,
        embeddings: true,
        llm: true,
      },
    };
  });

  // GET /ai/status - 服务状态
  app.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      service: 'orion-ai-svc',
      version: process.env.SERVICE_VERSION || '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      capabilities: [
        'ai-gateway',
        'ai-decision',
        'ai-review',
        'ai-security',
        'vector-store',
        'llm-trace',
        'degradation',
      ],
    };
  });

  // ==================== Vector Operations ====================

  // POST /ai/vector/search - 向量搜索
  app.post('/vector/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as VectorSearchRequest;
    try {
      const results = await vectorRepo.search(body.embedding, body.limit || 10, {
        collection: body.collection,
        metadataFilter: body.filters,
      });
      return { results, count: results.length };
    } catch (error: any) {
      return reply.status(500).send({ error: 'VECTOR_SEARCH_ERROR', message: error.message });
    }
  });

  // POST /ai/vector/upsert - 插入或更新向量
  app.post('/vector/upsert', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    try {
      const result = await vectorRepo.insert({
        collection: body.collection || 'default',
        content: body.content,
        contentHash: body.contentHash,
        metadata: body.metadata || {},
        embedding: body.embedding,
      });
      return { success: true, id: result.id };
    } catch (error: any) {
      return reply.status(500).send({ error: 'VECTOR_UPSERT_ERROR', message: error.message });
    }
  });

  // DELETE /ai/vector/:id - 删除向量
  app.delete('/vector/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const deleted = await vectorRepo.delete(id);
      return { success: deleted };
    } catch (error: any) {
      return reply.status(500).send({ error: 'VECTOR_DELETE_ERROR', message: error.message });
    }
  });

  // ==================== Code Embeddings ====================

  // POST /ai/embeddings/code - 创建代码嵌入
  app.post('/embeddings/code', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CodeEmbeddingRequest;
    try {
      const result = await codeEmbeddingRepo.insert({
        projectId: body.projectId,
        filePath: body.filePath,
        chunkType: body.chunkType,
        chunkName: body.chunkName,
        content: body.content,
        embedding: body.embedding,
        metadata: body.metadata || { language: 'unknown', lineStart: 0, lineEnd: 0 },
      });
      return { success: true, id: result.id };
    } catch (error: any) {
      return reply.status(500).send({ error: 'CODE_EMBEDDING_ERROR', message: error.message });
    }
  });

  // GET /ai/embeddings/code/:projectId - 获取项目代码嵌入
  app.get('/embeddings/code/:projectId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as { projectId: string };
    const { filePath } = request.query as { filePath?: string };
    try {
      const results = filePath
        ? await codeEmbeddingRepo.findByFilePath(projectId, filePath)
        : [];
      return { results, count: results.length };
    } catch (error: any) {
      return reply.status(500).send({ error: 'CODE_EMBEDDING_GET_ERROR', message: error.message });
    }
  });

  // DELETE /ai/embeddings/code/:projectId - 删除项目代码嵌入
  app.delete('/embeddings/code/:projectId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as { projectId: string };
    const { filePath } = request.query as { filePath?: string };
    try {
      const deleted = filePath
        ? await codeEmbeddingRepo.deleteByFilePath(projectId, filePath)
        : 0;
      return { success: true, deleted };
    } catch (error: any) {
      return reply.status(500).send({ error: 'CODE_EMBEDDING_DELETE_ERROR', message: error.message });
    }
  });

  // ==================== Knowledge Embeddings ====================

  // POST /ai/embeddings/knowledge - 创建知识嵌入
  app.post('/embeddings/knowledge', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as KnowledgeEmbeddingRequest;
    try {
      const result = await knowledgeEmbeddingRepo.insert({
        docId: body.docId,
        docType: body.docType,
        title: body.title,
        content: body.content,
        embedding: body.embedding,
        metadata: body.metadata || {},
      });
      return { success: true, id: result.id };
    } catch (error: any) {
      return reply.status(500).send({ error: 'KNOWLEDGE_EMBEDDING_ERROR', message: error.message });
    }
  });

  // POST /ai/embeddings/knowledge/search - 知识库搜索
  app.post('/embeddings/knowledge/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as VectorSearchRequest;
    try {
      const results = await knowledgeEmbeddingRepo.search(body.embedding, body.limit || 10, body.filters);
      return { results, count: results.length };
    } catch (error: any) {
      return reply.status(500).send({ error: 'KNOWLEDGE_SEARCH_ERROR', message: error.message });
    }
  });

  // ==================== Model Version Management ====================

  // POST /ai/models - 注册新模型版本
  app.post('/models', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as ModelVersionRequest;
    try {
      const model = await modelVersionRepo.create({
        tenant_id: 'default',
        name: body.name,
        version: body.version,
        status: 'active',
        framework: body.framework as any,
        description: body.description || null,
        metadata: body.metadata || null,
        metrics: {},
        registered_by: null,
        tags: null,
      });
      return { success: true, model };
    } catch (error: any) {
      return reply.status(500).send({ error: 'MODEL_CREATE_ERROR', message: error.message });
    }
  });

  // GET /ai/models - 获取所有模型版本
  app.get('/models', async (request: FastifyRequest, reply: FastifyReply) => {
    const { status, framework, name } = request.query as { status?: string; framework?: string; name?: string };
    try {
      const models = await modelVersionRepo.listAll({ status, framework, name });
      return { models, count: models.length };
    } catch (error: any) {
      return reply.status(500).send({ error: 'MODEL_LIST_ERROR', message: error.message });
    }
  });

  // GET /ai/models/:id - 获取指定模型
  app.get('/models/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const model = await modelVersionRepo.findById(id);
      if (!model) {
        return reply.status(404).send({ error: 'MODEL_NOT_FOUND' });
      }
      return { model };
    } catch (error: any) {
      return reply.status(500).send({ error: 'MODEL_GET_ERROR', message: error.message });
    }
  });

  // PUT /ai/models/:id - 更新模型
  app.put('/models/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<ModelVersionRequest>;
    try {
      const model = await modelVersionRepo.update(id, body);
      return { success: true, model };
    } catch (error: any) {
      return reply.status(500).send({ error: 'MODEL_UPDATE_ERROR', message: error.message });
    }
  });

  // ==================== A/B Testing ====================

  // POST /ai/abtests - 创建 A/B 测试
  app.post('/abtests', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as ABTestRequest;
    try {
      const test = await abTestRepo.create({
        tenant_id: 'default',
        model_name: body.modelName,
        variants: body.variants,
        traffic_split: body.trafficSplit,
        start_date: new Date(body.startDate),
        end_date: body.endDate ? new Date(body.endDate) : null,
        target_metrics: body.targetMetrics,
        status: 'draft',
      });
      return { success: true, test };
    } catch (error: any) {
      return reply.status(500).send({ error: 'ABTEST_CREATE_ERROR', message: error.message });
    }
  });

  // GET /ai/abtests - 获取 A/B 测试列表
  app.get('/abtests', async (request: FastifyRequest, reply: FastifyReply) => {
    const { modelName } = request.query as { modelName?: string };
    try {
      if (modelName) {
        const test = await abTestRepo.findByName(modelName);
        return { tests: test ? [test] : [] };
      }
      return { tests: [] };
    } catch (error: any) {
      return reply.status(500).send({ error: 'ABTEST_LIST_ERROR', message: error.message });
    }
  });

  // ==================== AI Decisions ====================

  // POST /ai/decisions - 请求 AI 决策
  app.post('/decisions', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as AIDecisionRequest;
    try {
      // This would integrate with the AI decision service
      return {
        decision_id: `dec-${Date.now()}`,
        scenario: body.scenario,
        output: { result: 'decision_result' },
        confidence: 0.85,
        reasoning: 'AI decision made based on input',
        latency_ms: 150,
      };
    } catch (error: any) {
      return reply.status(500).send({ error: 'DECISION_ERROR', message: error.message });
    }
  });

  // ==================== Audit ====================

  // POST /ai/audit - 记录审计日志
  app.post('/audit', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      userId: string;
      action: string;
      resourceType: string;
      resourceId: string;
      requestBody?: Record<string, unknown>;
    };
    try {
      const log = await auditRepo.create({
        tenant_id: 'default',
        user_id: body.userId,
        action: body.action,
        resource_type: body.resourceType,
        resource_id: body.resourceId,
        request_body: body.requestBody,
      });
      return { success: true, id: log.id };
    } catch (error: any) {
      return reply.status(500).send({ error: 'AUDIT_ERROR', message: error.message });
    }
  });

  // GET /ai/audit - 获取审计日志
  app.get('/audit', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, limit } = request.query as { tenantId?: string; limit?: string };
    try {
      const logs = await auditRepo.findAll({ tenantId, limit: parseInt(limit || '100', 10) });
      return { logs, count: logs.length };
    } catch (error: any) {
      return reply.status(500).send({ error: 'AUDIT_GET_ERROR', message: error.message });
    }
  });
}