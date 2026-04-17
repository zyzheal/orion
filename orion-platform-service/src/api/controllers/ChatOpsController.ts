/**
 * ChatOps Controller - Fastify HTTP request/response handlers
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { CommandService } from '../../services/chatops/CommandService';
import { ExecutionService } from '../../services/chatops/ExecutionService';

export class ChatOpsController {
  private commandService: CommandService;
  private executionService: ExecutionService;

  constructor(options: {
    commandService: CommandService;
    executionService: ExecutionService;
  }) {
    this.commandService = options.commandService;
    this.executionService = options.executionService;
  }

  // ==================== Commands ====================

  async listCommands(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string>;
      const { commands, total } = await this.commandService.list({
        permissionLevel: query.permissionLevel,
        name: query.name,
        page: query.page ? parseInt(query.page) : undefined,
        perPage: query.perPage ? parseInt(query.perPage) : undefined,
      });

      await reply.send({ success: true, data: commands, total });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async getCommandHelp(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { name: string };
      const help = await this.commandService.getHelp(params.name);
      if (!help) {
        await reply.status(404).send({ success: false, error: 'Command not found' });
        return;
      }
      await reply.send({ success: true, data: help });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Execution ====================

  async executeCommand(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown>;
      if (!body.command || !body.userId || !body.platform || !body.channel) {
        await reply.status(400).send({
          success: false,
          error: 'command, userId, platform, and channel are required',
        });
        return;
      }

      // Verify command exists
      const command = await this.commandService.getByName(body.command as string);
      if (!command) {
        await reply.status(404).send({ success: false, error: 'Command not found' });
        return;
      }

      const execution = await this.executionService.execute({
        commandId: body.command as string,
        userId: body.userId as string,
        platform: body.platform as string,
        channel: body.channel as string,
        params: body.params as Record<string, unknown> | undefined,
      });

      await reply.status(201).send({ success: true, data: execution });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to execute command',
      });
    }
  }

  async checkExecutionStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { commandId: string };
      const execution = await this.executionService.getById(params.commandId);
      if (!execution) {
        await reply.status(404).send({ success: false, error: 'Execution not found' });
        return;
      }
      await reply.send({ success: true, data: execution });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Webhook ====================

  async receiveMessage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown>;

      // Parse incoming IM message
      const text = (body.text || body.message || '') as string;
      const { command, params } = await this.commandService.parseCommand(text);

      if (!command) {
        await reply.status(400).send({
          success: false,
          error: 'Unknown command. Use /help for available commands.',
        });
        return;
      }

      // Auto-execute if all required params are present or none required
      const userId = (body.user_id || body.userId || 'anonymous') as string;
      const platform = (body.platform || 'webhook') as string;
      const channel = (body.channel || 'default') as string;

      const execution = await this.executionService.execute({
        commandId: command.name,
        userId,
        platform,
        channel,
        params: params as Record<string, unknown>,
      });

      await reply.status(201).send({ success: true, data: execution, command });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to process message',
      });
    }
  }

  // ==================== Audit ====================

  async getAuditLogs(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string>;
      const { logs, total } = await this.executionService.getAuditLogs({
        traceId: query.traceId,
        actor: query.actor,
        result: query.result,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        page: query.page ? parseInt(query.page) : undefined,
        perPage: query.perPage ? parseInt(query.perPage) : undefined,
      });

      await reply.send({ success: true, data: logs, total });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async getAuditStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const stats = await this.executionService.getAuditStats();
      await reply.send({ success: true, data: stats });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async exportAuditLogs(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown> | undefined;
      const logs = await this.executionService.exportAuditLogs({
        traceId: body?.traceId as string | undefined,
        actor: body?.actor as string | undefined,
        result: body?.result as string | undefined,
        startDate: body?.startDate ? new Date(body.startDate as string) : undefined,
        endDate: body?.endDate ? new Date(body.endDate as string) : undefined,
      });

      await reply.send({ success: true, data: logs, total: logs.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }
}
