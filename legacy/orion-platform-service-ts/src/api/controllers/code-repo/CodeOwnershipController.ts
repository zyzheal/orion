/**
 * Code Ownership Controller - 代码所有权管理控制器
 *
 * 管理 CODEOWNERS 文件解析、所有权规则查询、审批人推荐
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { CodeOwnershipService } from '../../../services/code-repo';
import { CodeOwnershipRepository } from '../../../repositories/CodeOwnershipRepository';

export class CodeOwnershipController {
  private codeOwnershipService: CodeOwnershipService;

  constructor(codeOwnershipRepository: CodeOwnershipRepository) {
    this.codeOwnershipService = new CodeOwnershipService(codeOwnershipRepository);
  }

  /**
   * 注册/更新 CODEOWNERS 文件
   *
   * POST /api/v1/code-repo/code-owners
   */
  async register(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as {
        repoId: string;
        content: string;
        filePath?: string;
      };

      if (!body.repoId || !body.content) {
        return reply.status(400).send({
          success: false,
          error: 'repoId and content are required',
        });
      }

      const file = await this.codeOwnershipService.registerCodeOwnersFile(
        body.repoId,
        body.content,
        body.filePath
      );

      return reply.status(201).send({ success: true, data: file });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 获取仓库的 CODEOWNERS 文件
   *
   * GET /api/v1/code-repo/code-owners/:repoId
   */
  async get(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { repoId } = request.params as { repoId: string };
      const file = await this.codeOwnershipService.getCodeOwnersFile(repoId);

      if (!file) {
        return reply.status(404).send({
          success: false,
          error: 'CODEOWNERS file not found for this repository',
        });
      }

      return reply.send({ success: true, data: file });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 删除仓库的 CODEOWNERS 文件
   *
   * DELETE /api/v1/code-repo/code-owners/:repoId
   */
  async remove(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { repoId } = request.params as { repoId: string };
      const removed = await this.codeOwnershipService.removeCodeOwnersFile(repoId);

      if (!removed) {
        return reply.status(404).send({
          success: false,
          error: 'CODEOWNERS file not found for this repository',
        });
      }

      return reply.send({
        success: true,
        message: 'CODEOWNERS file removed',
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 验证 CODEOWNERS 文件格式
   *
   * POST /api/v1/code-repo/code-owners/validate
   */
  async validate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as { content: string };

      if (!body.content) {
        return reply.status(400).send({
          success: false,
          error: 'content is required',
        });
      }

      const result = this.codeOwnershipService.validateCodeOwnersContent(body.content);

      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 获取文件审批人推荐
   *
   * POST /api/v1/code-repo/code-owners/recommend
   */
  async recommend(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as {
        repoId: string;
        filePaths: string[];
      };

      if (!body.repoId || !body.filePaths || body.filePaths.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'repoId and filePaths are required',
        });
      }

      const recommendations = await this.codeOwnershipService.recommendOwners(
        body.repoId,
        body.filePaths
      );

      return reply.send({
        success: true,
        data: recommendations,
        count: recommendations.length,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 获取 PR 所需的审批人
   *
   * POST /api/v1/code-repo/code-owners/approvers
   */
  async getApprovers(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as {
        repoId: string;
        changedFiles: Array<{
          path: string;
          status: 'added' | 'modified' | 'deleted' | 'renamed';
        }>;
      };

      if (!body.repoId || !body.changedFiles || body.changedFiles.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'repoId and changedFiles are required',
        });
      }

      const result = await this.codeOwnershipService.getRequiredApproversForPR(
        body.repoId,
        body.changedFiles
      );

      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }
}
