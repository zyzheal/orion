/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/internal-library/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

/**
 * Internal Library Routes - 二方库管理 API 路由
 *
 * 基于 M30 二方库管理设计
 * D5/D7 Fix: Accept database pool via options, remove hardcoded /api/ prefix
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { InternalLibraryService } from '../services/internal-library/InternalLibraryService';
import {
  CreateLibraryInput,
  PublishVersionInput,
  DeprecateLibraryInput,
  LibraryQueryOptions,
} from '../models/InternalLibrary';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { ValidationError, NotFoundError, handleError } from '../errors';

interface InternalLibraryRoutesOptions {
  database?: DatabasePool;
}

export async function internalLibraryRoutes(app: FastifyInstance, options: InternalLibraryRoutesOptions = {}) {
  // D7 Fix: Initialize with PostgreSQL Repository if database is available
  const libraryService = new InternalLibraryService(options.database);

  // ==================== CRUD ====================

  /**
   * 创建二方库
   * POST /internal-libraries
   */
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'library', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = request.body as CreateLibraryInput;
      const library = await libraryService.create(input);
      reply.status(201).send(library);
    } catch (error: any) {
handleError(reply, new ValidationError(error.message));
    }
  });

  /**
   * 列出二方库
   * GET /internal-libraries
   */
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'library', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const opts = request.query as LibraryQueryOptions;
    const libraries = await libraryService.list(opts);
    reply.send(libraries);
  });

  /**
   * 获取二方库详情
   * GET /internal-libraries/:id
   */
  app.get('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'library', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const library = await libraryService.getById(id);
    if (!library) {
handleError(reply, new NotFoundError('Library not found'));
      return;
    }
    reply.send(library);
  });

  /**
   * 按名称获取二方库
   * GET /internal-libraries/name/:name
   */
  app.get('/name/:name', {
    onRequest: [authenticateUser, requirePermission({ resource: 'library', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { name } = request.params as { name: string };
    const library = await libraryService.getByName(name);
    if (!library) {
handleError(reply, new NotFoundError('Library not found'));
      return;
    }
    reply.send(library);
  });

  /**
   * 按语言列出二方库
   * GET /internal-libraries/language/:language
   */
  app.get('/language/:language', {
    onRequest: [authenticateUser, requirePermission({ resource: 'library', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { language } = request.params as { language: string };
    const libraries = await libraryService.listByLanguage(language as any);
    reply.send(libraries);
  });

  /**
   * 按团队列出二方库
   * GET /internal-libraries/owner/:owner
   */
  app.get('/owner/:owner', {
    onRequest: [authenticateUser, requirePermission({ resource: 'library', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { owner } = request.params as { owner: string };
    const libraries = await libraryService.listByOwner(owner);
    reply.send(libraries);
  });

  /**
   * 删除二方库
   * DELETE /internal-libraries/:id
   */
  app.delete('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'library', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deleted = await libraryService.delete(id);
    if (!deleted) {
handleError(reply, new NotFoundError('Library not found'));
      return;
    }
    reply.status(204).send();
  });

  // ==================== 版本管理 ====================

  /**
   * 发布新版本
   * POST /internal-libraries/:id/versions
   */
  app.post('/:id/versions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'library', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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
handleError(reply, new ValidationError(error.message));
    }
  });

  /**
   * 获取版本列表
   * GET /internal-libraries/:id/versions
   */
  app.get('/:id/versions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'library', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const versions = await libraryService.getVersions(id);
    reply.send(versions);
  });

  /**
   * 获取特定版本
   * GET /internal-libraries/:id/versions/:version
   */
  app.get('/:id/versions/:version', {
    onRequest: [authenticateUser, requirePermission({ resource: 'library', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, version } = request.params as { id: string; version: string };
    const versionInfo = await libraryService.getVersion(id, version);
    if (!versionInfo) {
handleError(reply, new NotFoundError('Version not found'));
      return;
    }
    reply.send(versionInfo);
  });

  /**
   * 废弃版本
   * POST /internal-libraries/:id/versions/:version/deprecate
   */
  app.post('/:id/versions/:version/deprecate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'library', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, version } = request.params as { id: string; version: string };
    const body = request.body as any;
    const result = await libraryService.deprecateVersion(id, version, body.reason, new Date(body.eolDate), body.migrationGuide);
    if (!result) {
handleError(reply, new NotFoundError('Version not found'));
      return;
    }
    reply.send(result);
  });

  // ==================== 废弃管理 ====================

  /**
   * 废弃二方库
   * POST /internal-libraries/:id/deprecate
   */
  app.post('/:id/deprecate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'library', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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
handleError(reply, new NotFoundError('Library not found'));
        return;
      }
      reply.send(library);
    } catch (error: any) {
handleError(reply, new ValidationError(error.message));
    }
  });

  /**
   * 激活二方库
   * POST /internal-libraries/:id/activate
   */
  app.post('/:id/activate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'library', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const library = await libraryService.activate(id);
    if (!library) {
handleError(reply, new NotFoundError('Library not found'));
      return;
    }
    reply.send(library);
  });

  // ==================== 复制管理 ====================

  /**
   * 复制二方库
   * POST /internal-libraries/:id/copy
   */
  app.post('/:id/copy', {
    onRequest: [authenticateUser, requirePermission({ resource: 'internal_library', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    try {
      const newLibrary = await libraryService.copyLibrary(id, body);
      reply.status(201).send(newLibrary);
    } catch (error: any) {
      handleError(reply, new ValidationError(error.message));
    }
  });

  // ==================== 依赖追踪 ====================

  /**
   * 获取依赖者列表
   * GET /internal-libraries/:id/dependents
   */
  app.get('/:id/dependents', {
    onRequest: [authenticateUser, requirePermission({ resource: 'library', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const dependents = await libraryService.getDependents(id);
    reply.send(dependents);
  });

  /**
   * 添加依赖关系
   * POST /internal-libraries/:id/dependents
   */
  app.post('/:id/dependents', {
    onRequest: [authenticateUser, requirePermission({ resource: 'library', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    try {
      const dependent = await libraryService.addDependent(id, body.repoName, body.teamName, body.version);
      reply.status(201).send(dependent);
    } catch (error: any) {
handleError(reply, new ValidationError(error.message));
    }
  });

  /**
   * 更新依赖版本
   * PUT /internal-libraries/:id/dependents/:repoName
   */
  app.put('/:id/dependents/:repoName', {
    onRequest: [authenticateUser, requirePermission({ resource: 'library', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, repoName } = request.params as { id: string; repoName: string };
    const body = request.body as any;
    const success = await libraryService.updateDependentVersion(id, repoName, body.version);
    if (!success) {
handleError(reply, new NotFoundError('Dependent not found'));
      return;
    }
    reply.send({ success: true });
  });

  /**
   * 检查项目依赖
   * GET /internal-libraries/dependencies/:repoName
   */
  app.get('/dependencies/:repoName', {
    onRequest: [authenticateUser, requirePermission({ resource: 'library', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { repoName } = request.params as { repoName: string };
    const dependencies = await libraryService.checkDependencies(repoName);
    reply.send(dependencies);
  });

  /**
   * 更新依赖统计
   * POST /internal-libraries/:id/update-stats
   */
  app.post('/:id/update-stats', {
    onRequest: [authenticateUser, requirePermission({ resource: 'library', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await libraryService.updateDependentsStats(id);
    reply.send({ success: true });
  });
}