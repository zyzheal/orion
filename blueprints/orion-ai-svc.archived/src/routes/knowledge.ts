// orion-ai-svc/src/routes/knowledge.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { knowledgeService, type KnowledgeItem } from '../services/KnowledgeService';

interface CreateKnowledgeRequest {
  title: string;
  content: string;
  category: string;
  tags: string[];
}

interface ListQuery {
  category?: string;
  limit?: string;
  offset?: string;
}

interface SearchQuery {
  q?: string;
  limit?: string;
}

export async function knowledgeRoutes(fastify: FastifyInstance): Promise<void> {
  // 创建知识条目
  fastify.post<{ Body: CreateKnowledgeRequest }>(
    '/',
    async (request: FastifyRequest<{ Body: CreateKnowledgeRequest }>, reply: FastifyReply) => {
      const { title, content, category, tags } = request.body;

      if (!title || !content || !category) {
        return reply.status(400).send({ error: 'title, content, category are required' });
      }

      const item = await knowledgeService.create({
        title,
        content,
        category,
        tags: tags || [],
        createdBy: (request as any).user?.id || 'anonymous',
      });

      return reply.status(201).send(item);
    }
  );

  // 获取知识条目列表
  fastify.get<{ Querystring: ListQuery }>(
    '/',
    async (request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
      const { category, limit = '50', offset = '0' } = request.query;

      const items = await knowledgeService.list(category, Number(limit), Number(offset));
      const total = await knowledgeService.count(category);
      return reply.send({ items, total });
    }
  );

  // 搜索知识条目
  fastify.get<{ Querystring: SearchQuery }>(
    '/search',
    async (request: FastifyRequest<{ Querystring: SearchQuery }>, reply: FastifyReply) => {
      const { q, limit = '10' } = request.query;

      if (!q) {
        return reply.status(400).send({ error: 'Search query is required' });
      }

      const results = await knowledgeService.search(q, Number(limit));
      return reply.send({ results });
    }
  );

  // 获取知识条目详情
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const item = await knowledgeService.getById(request.params.id);

      if (!item) {
        return reply.status(404).send({ error: 'Knowledge item not found' });
      }

      return reply.send(item);
    }
  );

  // 更新知识条目
  fastify.put<{ Params: { id: string }; Body: Partial<KnowledgeItem> }>(
    '/:id',
    async (request, reply) => {
      const item = await knowledgeService.update(request.params.id, request.body);

      if (!item) {
        return reply.status(404).send({ error: 'Knowledge item not found' });
      }

      return reply.send(item);
    }
  );

  // 删除知识条目
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      await knowledgeService.delete(request.params.id);
      return reply.status(204).send();
    }
  );

  // 获取分类列表
  fastify.get(
    '/categories',
    async (request, reply) => {
      const categories = await knowledgeService.getCategories();
      return reply.send({ categories });
    }
  );
}
