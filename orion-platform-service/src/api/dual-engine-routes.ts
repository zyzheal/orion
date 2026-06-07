import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DualEngineService } from '../services/ai-training/dual-engine-service';
import { DualEngineRepository } from '../services/ai-training/dual-engine-repository';

interface DualEngineRequest {
  name: string;
  description: string;
  astConfig: {
    supportedLanguages: string[];
    parseTimeout: number;
    incrementalParsing: boolean;
    maxDepth: number;
  };
  llmConfig: {
    model: string;
    temperature: number;
    maxTokens: number;
    contextLearning: boolean;
    contextWindowSize: number;
  };
}

interface AnalysisRequest {
  filePaths: string[];
}

export async function dualEngineRoutes(fastify: FastifyInstance) {
  // 创建双引擎配置
  fastify.post<{ Body: DualEngineRequest }>('/api/dual-engines', async (request, reply) => {
    const { name, description, astConfig, llmConfig } = request.body;
    const tenantId = (request as any).tenantId;

    const repository = new DualEngineRepository((fastify as any).db);
    const service = new DualEngineService(repository);

    try {
      const engine = await service.createDualEngine(
        tenantId,
        name,
        description,
        astConfig,
        llmConfig
      );
      return reply.status(201).send(engine);
    } catch (error: any) {
      if (error.code === 'INVALID_INPUT' || error.code === 'INVALID_AST_CONFIG' || error.code === 'INVALID_LLM_CONFIG') {
        return reply.status(400).send({ error: error.message, code: error.code });
      }
      throw error;
    }
  });

  // 获取双引擎配置
  fastify.get<{ Params: { id: string } }>('/api/dual-engines/:id', async (request, reply) => {
    const { id } = request.params;

    const repository = new DualEngineRepository((fastify as any).db);
    const service = new DualEngineService(repository);

    try {
      const engine = await service.getDualEngine(id);
      return reply.send(engine);
    } catch (error: any) {
      if (error.code === 'NOT_FOUND') {
        return reply.status(404).send({ error: error.message, code: error.code });
      }
      throw error;
    }
  });

  // 获取租户下所有双引擎配置
  fastify.get('/api/dual-engines', async (request, reply) => {
    const tenantId = (request as any).tenantId;

    const repository = new DualEngineRepository((fastify as any).db);
    const service = new DualEngineService(repository);

    const engines = await service.listDualEngines(tenantId);
    return reply.send(engines);
  });

  // 更新双引擎配置
  fastify.put<{ Params: { id: string }; Body: Partial<DualEngineRequest> }>(
    '/api/dual-engines/:id',
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      const repository = new DualEngineRepository((fastify as any).db);
      const service = new DualEngineService(repository);

      try {
        const engine = await service.updateDualEngine(id, updates);
        return reply.send(engine);
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          return reply.status(404).send({ error: error.message, code: error.code });
        }
        if (error.code === 'INVALID_AST_CONFIG' || error.code === 'INVALID_LLM_CONFIG') {
          return reply.status(400).send({ error: error.message, code: error.code });
        }
        throw error;
      }
    }
  );

  // 删除双引擎配置
  fastify.delete<{ Params: { id: string } }>('/api/dual-engines/:id', async (request, reply) => {
    const { id } = request.params;

    const repository = new DualEngineRepository((fastify as any).db);
    const service = new DualEngineService(repository);

    try {
      const deleted = await service.deleteDualEngine(id);
      if (deleted) {
        return reply.status(204).send();
      }
      return reply.status(404).send({ error: 'Dual engine not found', code: 'NOT_FOUND' });
    } catch (error: any) {
      throw error;
    }
  });

  // 获取双引擎运行状态
  fastify.get<{ Params: { id: string } }>('/api/dual-engines/:id/status', async (request, reply) => {
    const { id } = request.params;

    const repository = new DualEngineRepository((fastify as any).db);
    const service = new DualEngineService(repository);

    try {
      const status = await service.getDualEngineStatus(id);
      return reply.send(status);
    } catch (error: any) {
      if (error.code === 'NOT_FOUND') {
        return reply.status(404).send({ error: error.message, code: error.code });
      }
      throw error;
    }
  });

  // 启动代码分析
  fastify.post<{ Params: { id: string }; Body: AnalysisRequest }>(
    '/api/dual-engines/:id/analyze',
    async (request, reply) => {
      const { id } = request.params;
      const { filePaths } = request.body;

      const repository = new DualEngineRepository((fastify as any).db);
      const service = new DualEngineService(repository);

      try {
        const results = await service.startAnalysis(id, filePaths);
        return reply.send(results);
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          return reply.status(404).send({ error: error.message, code: error.code });
        }
        if (error.code === 'ENGINE_INACTIVE') {
          return reply.status(400).send({ error: error.message, code: error.code });
        }
        if (error.code === 'INVALID_INPUT') {
          return reply.status(400).send({ error: error.message, code: error.code });
        }
        throw error;
      }
    }
  );
}
