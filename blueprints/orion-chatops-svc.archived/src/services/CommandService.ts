/**
 * ChatOps Command Service - Command registry, parsing, help
 *
 * Migrated to decoupled architecture:
 * - DBContext for database access
 * - ServiceRegistry for event communication
 * - EventBusService for external events
 */

import { DatabasePool, EventBusService } from '../types/database';
import {
  ChatOpsCommand,
  ChatOpsCommandCreateInput,
} from '../types/models';
import { ChatOpsCommandRepository } from './ChatOpsRepository';

export interface ChatOpsCommandListFilter {
  permissionLevel?: string;
  name?: string;
  page?: number;
  perPage?: number;
}

const DEFAULT_COMMANDS: ChatOpsCommandCreateInput[] = [
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

export class CommandService {
  private static _instance: CommandService;
  private pool: DatabasePool;
  private eventBus?: EventBusService;
  private commandRepository?: ChatOpsCommandRepository;
  private initialized: boolean = false;

  constructor(options?: { pool: DatabasePool; eventBus?: EventBusService; repository?: ChatOpsCommandRepository }) {
    this.pool = options?.pool!;
    this.eventBus = options?.eventBus;
    if (!options?.repository) {
      this.commandRepository = new ChatOpsCommandRepository(this.pool);
    } else {
      this.commandRepository = options.repository;
    }
  }

  static getInstance(): CommandService {
    if (!CommandService._instance) {
      CommandService._instance = new CommandService();
    }
    return CommandService._instance;
  }

  static create(pool: DatabasePool, options?: { eventBus?: EventBusService; repository?: ChatOpsCommandRepository }): CommandService {
    return new CommandService({ pool, ...options });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    console.log('[CommandService] Initialized');
  }

  async seedDefaults(): Promise<void> {
    if (!this.commandRepository) return;
    const existing = await this.commandRepository.findAll({ limit: 1 });
    if (existing.total > 0) return;
    for (const def of DEFAULT_COMMANDS) {
      try {
        await this.commandRepository.insert({
          name: def.name,
          subcommand: def.subcommand ?? '',
          schema: def.schema ?? {},
          aliases: def.aliases ?? [],
          permissionLevel: def.permissionLevel ?? 'user',
          examples: def.examples ?? [],
        });
      } catch {
        // Skip if already exists
      }
    }
  }

  async insert(input: ChatOpsCommandCreateInput): Promise<ChatOpsCommand> {
    if (!this.commandRepository) {
      throw new Error('CommandService: no database repository configured');
    }
    const entity = await this.commandRepository.insert({
      name: input.name,
      subcommand: input.subcommand ?? '',
      schema: input.schema ?? {},
      aliases: input.aliases ?? [],
      permissionLevel: input.permissionLevel ?? 'user',
      examples: input.examples ?? [],
    });
    await this.eventBus?.publish('chatops.command.created', {
      commandName: entity.name,
      permissionLevel: entity.permissionLevel,
    });
    return this.entityToModel(entity);
  }

  async getByName(name: string): Promise<ChatOpsCommand | undefined> {
    if (!this.commandRepository) {
      throw new Error('CommandService: no database repository configured');
    }
    let entity = await this.commandRepository.findByName(name);
    if (entity) return this.entityToModel(entity);
    entity = await this.commandRepository.findByAlias(name);
    if (entity) return this.entityToModel(entity);
    return undefined;
  }

  async list(filter: ChatOpsCommandListFilter = {}): Promise<{ commands: ChatOpsCommand[]; total: number }> {
    if (!this.commandRepository) {
      throw new Error('CommandService: no database repository configured');
    }
    let entities;
    if (filter.permissionLevel) {
      entities = await this.commandRepository.findByPermission(filter.permissionLevel);
    } else {
      const result = await this.commandRepository.findAll({ limit: 100, orderBy: 'name' });
      entities = result.entities;
    }
    let commands = entities.map(e => this.entityToModel(e));
    if (filter.name) {
      const lower = filter.name.toLowerCase();
      commands = commands.filter(c =>
        c.name.toLowerCase().includes(lower) ||
        c.aliases.some(a => a.toLowerCase().includes(lower))
      );
    }
    const total = commands.length;
    const page = filter.page ?? 1;
    const perPage = filter.perPage ?? 20;
    const start = (page - 1) * perPage;
    const paginated = commands.slice(start, start + perPage);
    return { commands: paginated, total };
  }

  async delete(name: string): Promise<boolean> {
    if (!this.commandRepository) {
      throw new Error('CommandService: no database repository configured');
    }
    const entity = await this.commandRepository.findByName(name);
    if (!entity) return false;
    return this.commandRepository.delete(entity.id);
  }

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
    const trimmed = input.trim();
    const parts = trimmed.split(/\s+/);
    let commandName = parts[0];
    if (commandName.startsWith('/')) {
      commandName = commandName.substring(1);
    }
    const command = await this.getByName(commandName);
    const params: Record<string, string> = {};
    for (let i = 1; i < parts.length; i++) {
      const match = parts[i].match(/^(\w+)=(.+)$/);
      if (match) {
        params[match[1]] = match[2];
      }
    }
    return { command, params };
  }

  async getAllCommands(): Promise<ChatOpsCommand[]> {
    if (!this.commandRepository) {
      throw new Error('CommandService: no database repository configured');
    }
    const result = await this.commandRepository.findAll({ limit: 1000 });
    return result.entities.map(e => this.entityToModel(e));
  }

  async getHealth(): Promise<{ status: 'healthy' | 'degraded'; latency: number }> {
    const start = Date.now();
    try {
      await this.pool.query('SELECT 1');
      return { status: 'healthy', latency: Date.now() - start };
    } catch {
      return { status: 'degraded', latency: Date.now() - start };
    }
  }

  private entityToModel(entity: {
    id: string;
    name: string;
    subcommand: string;
    schema: Record<string, any>;
    aliases: string[];
    permissionLevel: string;
    examples: string[];
  }): ChatOpsCommand {
    return {
      id: entity.id,
      name: entity.name,
      subcommand: entity.subcommand,
      schema: entity.schema,
      aliases: entity.aliases,
      permissionLevel: entity.permissionLevel,
      examples: entity.examples,
    };
  }
}

export default CommandService;
