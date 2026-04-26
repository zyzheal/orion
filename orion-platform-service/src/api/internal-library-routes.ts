/**
 * Internal Library Routes - 二方库管理 API 路由
 *
 * 基于 M30 二方库管理设计
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { InternalLibraryService } from '../services/internal-library/InternalLibraryService';
import {
  CreateLibraryInput,
  PublishVersionInput,
  DeprecateLibraryInput,
  LibraryQueryOptions,
} from '../models/InternalLibrary';

const libraryService = new InternalLibraryService();

export async function internalLibraryRoutes(app: FastifyInstance) {
  // ==================== CRUD ====================

  /**
   * 创建二方库
   * POST /api/internal-libraries
   */
  app.post('/api/internal-libraries', async (request: FastifyRequest<{ Body: CreateLibraryInput }>, reply: FastifyReply) => {
    try {
      const input = request.body;
      const library = await libraryService.create(input);
      reply.status(201).send(library);
    } catch (error: any) {
      reply.status(400).send({ error: error.message });
    }
  });

  /**
   * 列出二方库
   * GET /api/internal-libraries
   * Query params: language, status, owner, name
   */
  app.get('/api/internal-libraries', async (request: FastifyRequest<{ Querystring: LibraryQueryOptions }>, reply: FastifyReply) => {
    const options = request.query;
    const libraries = await libraryService.list(options);
    reply.send(libraries);
  });

  /**
   * 获取二方库详情
   * GET /api/internal-libraries/:id
   */
  app.get('/api/internal-libraries/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const library = await libraryService.getById(id);
    if (!library) {
      reply.status(404).send({ error: 'Library not found' });
      return;
    }
    reply.send(library);
  });

  /**
   * 按名称获取二方库
   * GET /api/internal-libraries/name/:name
   */
  app.get('/api/internal-libraries/name/:name', async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
    const { name } = request.params;
    const library = await libraryService.getByName(name);
    if (!library) {
      reply.status(404).send({ error: 'Library not found' });
      return;
    }
    reply.send(library);
  });

  /**
   * 按语言列出二方库
   * GET /api/internal-libraries/language/:language
   */
  app.get('/api/internal-libraries/language/:language', async (request: FastifyRequest<{ Params: { language: string } }>, reply: FastifyReply) => {
    const { language } = request.params;
    const libraries = await libraryService.listByLanguage(language as any);
    reply.send(libraries);
  });

  /**
   * 按团队列出二方库
   * GET /api/internal-libraries/owner/:owner
   */
  app.get('/api/internal-libraries/owner/:owner', async (request: FastifyRequest<{ Params: { owner: string } }>, reply: FastifyReply) => {
    const { owner } = request.params;
    const libraries = await libraryService.listByOwner(owner);
    reply.send(libraries);
  });

  /**
   * 删除二方库
   * DELETE /api/internal-libraries/:id
   */
  app.delete('/api/internal-libraries/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const deleted = await libraryService.delete(id);
    if (!deleted) {
      reply.status(404).send({ error: 'Library not found' });
      return;
    }
    reply.status(204).send();
  });

  // ==================== 版本管理 ====================

  /**
   * 发布新版本
   * POST /api/internal-libraries/:id/versions
   */
  app.post('/api/internal-libraries/:id/versions', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    try {
      const input: PublishVersionInput = {
        libraryId: id,
        version: body.version,
        status: body.status,
        changelog: body.changelog,
        artifactId: body.artifactId,
        securityScore: body.securityScore,
        testCoverage: body.testCoverage,
        publishedTo: body.publishedTo,
      };
      const version = await libraryService.publishVersion(input);
      reply.status(201).send(version);
    } catch (error: any) {
      reply.status(400).send({ error: error.message });
    }
  });

  /**
   * 获取版本列表
   * GET /api/internal-libraries/:id/versions
   */
  app.get('/api/internal-libraries/:id/versions', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const versions = await libraryService.getVersions(id);
    reply.send(versions);
  });

  /**
   * 获取特定版本
   * GET /api/internal-libraries/:id/versions/:version
   */
  app.get('/api/internal-libraries/:id/versions/:version', async (request: FastifyRequest<{ Params: { id: string; version: string } }>, reply: FastifyReply) => {
    const { id, version } = request.params;
    const versionInfo = await libraryService.getVersion(id, version);
    if (!versionInfo) {
      reply.status(404).send({ error: 'Version not found' });
      return;
    }
    reply.send(versionInfo);
  });

  /**
   * 废弃版本
   * POST /api/internal-libraries/:id/versions/:version/deprecate
   */
  app.post('/api/internal-libraries/:id/versions/:version/deprecate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, version } = request.params as { id: string; version: string };
    const body = request.body as any;
    const result = await libraryService.deprecateVersion(id, version, body.reason, new Date(body.eolDate), body.migrationGuide);
    if (!result) {
      reply.status(404).send({ error: 'Version not found' });
      return;
    }
    reply.send(result);
  });

  // ==================== 废弃管理 ====================

  /**
   * 废弃二方库
   * POST /api/internal-libraries/:id/deprecate
   */
  app.post('/api/internal-libraries/:id/deprecate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    try {
      const input: DeprecateLibraryInput = {
        libraryId: id,
        reason: body.reason,
        eolDate: new Date(body.eolDate),
        migrationGuide: body.migrationGuide,
        replacementLibrary: body.replacementLibrary,
      };
      const library = await libraryService.deprecate(input);
      if (!library) {
        reply.status(404).send({ error: 'Library not found' });
        return;
      }
      reply.send(library);
    } catch (error: any) {
      reply.status(400).send({ error: error.message });
    }
  });

  /**
   * 激活二方库
   * POST /api/internal-libraries/:id/activate
   */
  app.post('/api/internal-libraries/:id/activate', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const library = await libraryService.activate(id);
    if (!library) {
      reply.status(404).send({ error: 'Library not found' });
      return;
    }
    reply.send(library);
  });

  // ==================== 依赖追踪 ====================

  /**
   * 获取依赖者列表
   * GET /api/internal-libraries/:id/dependents
   */
  app.get('/api/internal-libraries/:id/dependents', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const dependents = await libraryService.getDependents(id);
    reply.send(dependents);
  });

  /**
   * 添加依赖关系
   * POST /api/internal-libraries/:id/dependents
   */
  app.post('/api/internal-libraries/:id/dependents', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    try {
      const dependent = await libraryService.addDependent(id, body.repoName, body.teamName, body.version);
      reply.status(201).send(dependent);
    } catch (error: any) {
      reply.status(400).send({ error: error.message });
    }
  });

  /**
   * 更新依赖版本
   * PUT /api/internal-libraries/:id/dependents/:repoName
   */
  app.put('/api/internal-libraries/:id/dependents/:repoName', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, repoName } = request.params as { id: string; repoName: string };
    const body = request.body as any;
    const success = await libraryService.updateDependentVersion(id, repoName, body.version);
    if (!success) {
      reply.status(404).send({ error: 'Dependent not found' });
      return;
    }
    reply.send({ success: true });
  });

  /**
   * 检查项目依赖
   * GET /api/repositories/:repoName/dependencies
   */
  app.get('/api/repositories/:repoName/dependencies', async (request: FastifyRequest<{ Params: { repoName: string } }>, reply: FastifyReply) => {
    const { repoName } = request.params;
    const dependencies = await libraryService.checkDependencies(repoName);
    reply.send(dependencies);
  });

  /**
   * 更新依赖统计
   * POST /api/internal-libraries/:id/update-stats
   */
  app.post('/api/internal-libraries/:id/update-stats', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    await libraryService.updateDependentsStats(id);
    reply.send({ success: true });
  });
}