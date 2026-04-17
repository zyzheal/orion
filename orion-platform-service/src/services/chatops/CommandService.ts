/**
 * ChatOps Command Service - Command registry, parsing, help
 */

import { EventBusService } from '../event-bus-service';
import {
  ChatOpsCommand,
  ChatOpsCommandCreateInput,
  createChatOpsCommand,
} from '../../models/ChatOps';

export interface ChatOpsCommandListFilter {
  permissionLevel?: string;
  name?: string;
  page?: number;
  perPage?: number;
}

export class CommandService {
  private commands: Map<string, ChatOpsCommand> = new Map();
  private eventBus?: EventBusService;

  constructor(options?: { eventBus?: EventBusService }) {
    this.eventBus = options?.eventBus;

    // Register default commands
    this.registerDefaults();
  }

  private registerDefaults(): void {
    const defaults: ChatOpsCommandCreateInput[] = [
      {
        name: 'deploy',
        subcommand: 'service',
        schema: {
          service: { type: 'string', required: true },
          environment: { type: 'string', enum: ['dev', 'staging', 'prod'], required: true },
          version: { type: 'string', required: false },
        },
        aliases: ['deploy-service', 'rollout'],
        permissionLevel: 'deployer',
        examples: ['/deploy service=api environment=staging version=1.2.3'],
      },
      {
        name: 'restart',
        subcommand: 'pod',
        schema: {
          namespace: { type: 'string', required: true },
          pod: { type: 'string', required: true },
        },
        aliases: ['restart-pod'],
        permissionLevel: 'operator',
        examples: ['/restart namespace=production pod=api-server-abc123'],
      },
      {
        name: 'status',
        subcommand: 'pipeline',
        schema: {
          pipelineId: { type: 'string', required: true },
        },
        aliases: ['pipeline-status', 'ps'],
        permissionLevel: 'user',
        examples: ['/status pipelineId=pipeline-123'],
      },
      {
        name: 'rollback',
        subcommand: 'deployment',
        schema: {
          deployment: { type: 'string', required: true },
          targetVersion: { type: 'string', required: false },
        },
        aliases: ['rollback-deploy'],
        permissionLevel: 'admin',
        examples: ['/rollback deployment=api targetVersion=1.1.0'],
      },
      {
        name: 'alert',
        subcommand: 'list',
        schema: {
          severity: { type: 'string', enum: ['critical', 'warning', 'info'], required: false },
          hours: { type: 'number', required: false },
        },
        aliases: ['alerts'],
        permissionLevel: 'user',
        examples: ['/alert severity=critical hours=24'],
      },
    ];

    for (const def of defaults) {
      const cmd = createChatOpsCommand(def);
      this.commands.set(cmd.name, cmd);
    }
  }

  // ==================== Command Registry ====================

  async create(input: ChatOpsCommandCreateInput): Promise<ChatOpsCommand> {
    const command = createChatOpsCommand(input);
    this.commands.set(command.name, command);

    await this.eventBus?.publish('chatops.command.created', {
      commandName: command.name,
      permissionLevel: command.permissionLevel,
    });
    return command;
  }

  async getByName(name: string): Promise<ChatOpsCommand | undefined> {
    // Try direct name match
    const cmd = this.commands.get(name);
    if (cmd) return cmd;

    // Try alias match
    for (const command of this.commands.values()) {
      if (command.aliases.includes(name)) {
        return command;
      }
    }
    return undefined;
  }

  async list(filter: ChatOpsCommandListFilter = {}): Promise<{ commands: ChatOpsCommand[]; total: number }> {
    let items = Array.from(this.commands.values());

    if (filter.name) {
      items = items.filter(c =>
        c.name.toLowerCase().includes(filter.name!.toLowerCase()) ||
        c.aliases.some(a => a.toLowerCase().includes(filter.name!.toLowerCase()))
      );
    }
    if (filter.permissionLevel) {
      items = items.filter(c => c.permissionLevel === filter.permissionLevel);
    }

    const total = items.length;
    const page = filter.page ?? 1;
    const perPage = filter.perPage ?? 20;
    const start = (page - 1) * perPage;
    items = items.slice(start, start + perPage);

    return { commands: items, total };
  }

  async delete(name: string): Promise<boolean> {
    const deleted = this.commands.delete(name);
    return deleted;
  }

  // ==================== Parsing & Help ====================

  async getHelp(name: string): Promise<Record<string, unknown> | undefined> {
    const cmd = await this.getByName(name);
    if (!cmd) return undefined;

    return {
      name: cmd.name,
      subcommand: cmd.subcommand,
      aliases: cmd.aliases,
      permissionLevel: cmd.permissionLevel,
      schema: cmd.schema,
      examples: cmd.examples,
    };
  }

  async parseCommand(input: string): Promise<{ command: ChatOpsCommand | undefined; params: Record<string, string> }> {
    // Parse format: /command param1=value1 param2=value2
    const trimmed = input.trim();
    const parts = trimmed.split(/\s+/);

    let commandName = parts[0];
    // Remove leading slash
    if (commandName.startsWith('/')) {
      commandName = commandName.substring(1);
    }

    const command = await this.getByName(commandName);
    const params: Record<string, string> = {};

    // Parse key=value pairs
    for (let i = 1; i < parts.length; i++) {
      const match = parts[i].match(/^(\w+)=(.+)$/);
      if (match) {
        params[match[1]] = match[2];
      }
    }

    return { command, params };
  }

  async getAllCommands(): Promise<ChatOpsCommand[]> {
    return Array.from(this.commands.values());
  }
}
