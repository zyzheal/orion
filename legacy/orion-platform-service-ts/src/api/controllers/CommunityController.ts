/**
 * CommunityController - 社区管理 API 控制器
 *
 * 处理社区贡献、贡献者信息、社区插件审核
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { CommunityService, ContributionInput, ContributionFilters } from '../../services/community/CommunityService';
import { CommunityPluginService, PluginInput, PluginFilters } from '../../services/community/CommunityPluginService';
import { OrionError, ErrorCode } from '../../errors';
import { DatabasePool } from '../../services/database';

export class CommunityController extends BaseController {
  private communityService: CommunityService;
  private pluginService: CommunityPluginService;

  constructor(db?: DatabasePool) {
    super();
    this.communityService = new CommunityService(db);
    this.pluginService = new CommunityPluginService(db);
  }

  async createContribution(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const body = request.body as ContributionInput;
      const tenantId = this.getTenantId(request);
      return this.communityService.createContribution(tenantId, body);
    }, (contribution) => this.sendCreated(reply, contribution));
  }

  async listContributions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const query = request.query as { type?: string; status?: string; userId?: string };
      const filters: ContributionFilters = {};
      if (query.type) filters.type = query.type;
      if (query.status) filters.status = query.status;
      if (query.userId) filters.userId = query.userId;
      return this.communityService.listContributions(filters);
    }, (contributions) => this.sendSuccess(reply, contributions));
  }

  async getContribution(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const contribution = await this.communityService.getContribution(params.id);
      if (!contribution) throw new OrionError(`Contribution '${params.id}' not found`, ErrorCode.NOT_FOUND);
      return contribution;
    }, (contribution) => this.sendSuccess(reply, contribution));
  }

  async getContributor(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { userId: string };
      const contributor = await this.communityService.getContributor(params.userId);
      if (!contributor) throw new OrionError(`Contributor '${params.userId}' not found`, ErrorCode.NOT_FOUND);
      return contributor;
    }, (contributor) => this.sendSuccess(reply, contributor));
  }

  async submitPlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const body = request.body as PluginInput;
      const tenantId = this.getTenantId(request);
      return this.pluginService.submitPlugin(tenantId, body);
    }, (plugin) => this.sendCreated(reply, plugin));
  }

  async reviewPlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const body = request.body as { action: 'approve' | 'reject'; comment: string };
      const plugin = await this.pluginService.reviewPlugin(params.id, body.action, body.comment);
      if (!plugin) throw new OrionError(`Plugin '${params.id}' not found`, ErrorCode.NOT_FOUND);
      return plugin;
    }, (plugin) => this.sendSuccess(reply, plugin));
  }

}
