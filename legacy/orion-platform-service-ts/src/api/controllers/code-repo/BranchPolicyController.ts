/**
 * Branch Policy Controller - 分支保护规则控制器
 *
 * 管理分支保护策略、审批规则、合并策略等
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  BranchPolicyService,
  MergeStrategy,
} from '../../../services/code-repo';
import type { DatabasePool } from '../../../services/database';

export class BranchPolicyController {
  private service: BranchPolicyService;

  /**
   * 创建控制器实例
   * @param db - 数据库连接池，传入 null 时使用内存模式
   */
  constructor(db: DatabasePool | null) {
    this.service = new BranchPolicyService(db);
  }

  /**
   * 获取服务实例 (用于测试注入)
   */
  getService(): BranchPolicyService {
    return this.service;
  }

  /**
   * 创建分支保护策略
   *
   * POST /api/v1/code-repo/branch-policies
   */
  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as {
        repoId: string;
        branchPattern: string;
        preventForcePush?: boolean;
        preventDeletion?: boolean;
        mergeStrategy?: MergeStrategy;
        approvalRules?: Array<{
          name: string;
          requiredApprovals: number;
          approvers: string[];
          allowAuthorApproval?: boolean;
          requiredRoles?: string[];
        }>;
        requiredChecks?: string[];
        requireCodeOwners?: boolean;
        linearHistory?: boolean;
        allowAdminOverride?: boolean;
      };

      if (!body.repoId || !body.branchPattern) {
        return reply.status(400).send({
          success: false,
          error: 'repoId and branchPattern are required',
        });
      }

      const policy = await this.service.create({
        repoId: body.repoId,
        branchPattern: body.branchPattern,
        preventForcePush: body.preventForcePush,
        preventDeletion: body.preventDeletion,
        mergeStrategy: body.mergeStrategy,
        approvalRules: body.approvalRules,
        requiredChecks: body.requiredChecks,
        requireCodeOwners: body.requireCodeOwners,
        linearHistory: body.linearHistory,
        allowAdminOverride: body.allowAdminOverride,
      });

      return reply.status(201).send({ success: true, data: policy });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 获取分支策略详情
   *
   * GET /api/v1/code-repo/branch-policies/:id
   */
  async getById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const policy = await this.service.getById(id);

      if (!policy) {
        return reply.status(404).send({
          success: false,
          error: 'Branch policy not found',
        });
      }

      return reply.send({ success: true, data: policy });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 获取仓库的所有分支策略
   *
   * GET /api/v1/code-repo/branch-policies/repo/:repoId
   */
  async listByRepo(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { repoId } = request.params as { repoId: string };
      const policies = await this.service.listByRepo(repoId);

      return reply.send({
        success: true,
        data: policies,
        count: policies.length,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 获取所有分支策略（跨所有仓库）
   *
   * GET /api/v1/code-repo/branch-policies
   */
  async listAll(request: FastifyRequest, reply: FastifyReply) {
    try {
      const policies = await this.service.listAll();

      return reply.send({
        success: true,
        data: policies,
        count: policies.length,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 更新分支策略
   *
   * PUT /api/v1/code-repo/branch-policies/:id
   */
  async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as {
        preventForcePush?: boolean;
        preventDeletion?: boolean;
        mergeStrategy?: MergeStrategy;
        approvalRules?: Array<{
          name: string;
          requiredApprovals: number;
          approvers: string[];
          allowAuthorApproval?: boolean;
          requiredRoles?: string[];
        }>;
        requiredChecks?: string[];
        requireCodeOwners?: boolean;
        linearHistory?: boolean;
        allowAdminOverride?: boolean;
      };

      const policy = await this.service.update(id, body);

      if (!policy) {
        return reply.status(404).send({
          success: false,
          error: 'Branch policy not found',
        });
      }

      return reply.send({ success: true, data: policy });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 删除分支策略
   *
   * DELETE /api/v1/code-repo/branch-policies/:id
   */
  async delete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const deleted = await this.service.delete(id);

      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: 'Branch policy not found',
        });
      }

      return reply.send({
        success: true,
        message: 'Branch policy deleted',
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 匹配分支策略
   *
   * GET /api/v1/code-repo/branch-policies/match?repoId=:repoId&branchName=:branchName
   */
  async matchPolicy(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { repoId, branchName } = request.query as {
        repoId: string;
        branchName: string;
      };

      if (!repoId || !branchName) {
        return reply.status(400).send({
          success: false,
          error: 'repoId and branchName query parameters are required',
        });
      }

      const policy = await this.service.matchPolicy(repoId, branchName);

      return reply.send({
        success: true,
        data: policy,
        matched: policy !== null,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 检查 PR 合并可行性
   *
   * POST /api/v1/code-repo/branch-policies/check-merge
   */
  async checkMerge(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as {
        repoId: string;
        pullRequest: {
          id: string;
          title: string;
          sourceBranch: string;
          targetBranch: string;
          author: string;
          status: string;
        };
        approvals?: Record<string, number>;
        checkResults?: Record<string, 'success' | 'failure' | 'pending'>;
        codeOwnersApproved?: boolean;
        isAdmin?: boolean;
      };

      if (!body.repoId || !body.pullRequest) {
        return reply.status(400).send({
          success: false,
          error: 'repoId and pullRequest are required',
        });
      }

      const result = await this.service.checkMergeability(
        body.repoId,
        body.pullRequest as any,
        {
          approvals: body.approvals,
          checkResults: body.checkResults,
          codeOwnersApproved: body.codeOwnersApproved,
          isAdmin: body.isAdmin,
        }
      );

      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 创建默认分支保护策略
   *
   * POST /api/v1/code-repo/branch-policies/defaults/:repoId
   */
  async createDefaults(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { repoId } = request.params as { repoId: string };
      const policies = await this.service.createDefaultPolicies(repoId);

      return reply.status(201).send({
        success: true,
        data: policies,
        count: policies.length,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }
}
