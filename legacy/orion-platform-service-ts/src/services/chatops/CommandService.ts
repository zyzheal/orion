/**
 * ChatOps Command Service - Command registry, parsing, help
 * 
 * Migrated to decoupled architecture:
 * - DBContext for database access
 * - ServiceRegistry for event communication
 * - EventBusService for external events
 */

import { DatabasePool } from '../database';
import { EventBusService } from '../event-bus-service';
import {
  ChatOpsCommand,
  ChatOpsCommandCreateInput,
  createChatOpsCommand,
} from '../../models/ChatOps';
import { ChatOpsCommandRepository } from '../../repositories/ChatOpsRepository';
import { OrionError, ErrorCode } from '../../errors';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CommandService');

export interface ChatOpsCommandListFilter {
  permissionLevel?: string;
  name?: string;
  page?: number;
  perPage?: number;
}

/** Default command definitions seeded into the database on first run. */
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

/**
 * ChatOps Command Service - 解耦版本
 * 
 * 使用新的解耦架构：
 * - DBContext 替代直接数据库访问
 * - ServiceRegistry 用于内部事件
 * - EventBusService 用于外部事件
 */
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

  /**
   * 获取单例
   */
  static getInstance(): CommandService {
    if (!CommandService._instance) {
      CommandService._instance = new CommandService();
    }
    return CommandService._instance;
  }

  /**
   * 创建新实例（兼容旧代码）
   */
  static create(pool: DatabasePool, options?: { eventBus?: EventBusService; repository?: ChatOpsCommandRepository }): CommandService {
    return new CommandService({ pool, ...options });
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.initialized = true;

    logger.info('[CommandService] Initialized');
  }

  /** Seed default commands if the database is empty. Called once on startup. */
  async seedDefaults(): Promise<void> {
    if (!this.commandRepository) return;

    const existing = await this.commandRepository.findAll({ limit: 1 });
    if (existing.total > 0) return; // Already seeded

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
        // Skip if already exists (race condition or manual insert)
      }
    }
  }

  // ==================== Command CRUD ====================

  async insert(input: ChatOpsCommandCreateInput): Promise<ChatOpsCommand> {
    if (!this.commandRepository) {
      throw new OrionError('CommandService: no database repository configured', ErrorCode.OPERATION_FAILED);
    }

    const entity = await this.commandRepository.insert({
      name: input.name,
      subcommand: input.subcommand ?? '',
      schema: input.schema ?? {},
      aliases: input.aliases ?? [],
      permissionLevel: input.permissionLevel ?? 'user',
      examples: input.examples ?? [],
    });

    // 发布内部事件（解耦）
    // TODO: publish event when event bus is integrated
    // await registry.publish('chatops.command.created', {
    //   commandName: entity.name,
    //   permissionLevel: entity.permissionLevel,
    // });

    // 同时通过 EventBus 发布外部事件
    await this.eventBus?.publish('chatops.command.created', {
      commandName: entity.name,
      permissionLevel: entity.permissionLevel,
    });

    return this.entityToModel(entity);
  }

  async getByName(name: string): Promise<ChatOpsCommand | undefined> {
    if (!this.commandRepository) {
      throw new OrionError('CommandService: no database repository configured', ErrorCode.OPERATION_FAILED);
    }

    // Try direct name match
    let entity = await this.commandRepository.findByName(name);
    if (entity) return this.entityToModel(entity);

    // Try alias match
    entity = await this.commandRepository.findByAlias(name);
    if (entity) return this.entityToModel(entity);

    return undefined;
  }

  async list(filter: ChatOpsCommandListFilter = {}): Promise<{ commands: ChatOpsCommand[]; total: number }> {
    if (!this.commandRepository) {
      throw new OrionError('CommandService: no database repository configured', ErrorCode.OPERATION_FAILED);
    }

    let entities;
    if (filter.permissionLevel) {
      entities = await this.commandRepository.findByPermission(filter.permissionLevel);
    } else {
      const result = await this.commandRepository.findAll({ limit: 100, orderBy: 'name' });
      entities = result.entities;
    }

    let commands = entities.map(e => this.entityToModel(e));

    // Apply name filter (search name and aliases)
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
      throw new OrionError('CommandService: no database repository configured', ErrorCode.OPERATION_FAILED);
    }

    const entity = await this.commandRepository.findByName(name);
    if (!entity) return false;

    const result = await this.commandRepository.delete(entity.id);

    // TODO: publish event when event bus is integrated
    // if (result) {
    //   await registry.publish('chatops.command.deleted', { commandName: name });
    // }

    return result;
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
    if (!this.commandRepository) {
      throw new OrionError('CommandService: no database repository configured', ErrorCode.OPERATION_FAILED);
    }

    const result = await this.commandRepository.findAll({ limit: 1000 });
    return result.entities.map(e => this.entityToModel(e));
  }

  /**
   * 获取健康状态
   */
  async getHealth(): Promise<{ status: 'healthy' | 'degraded'; latency: number }> {
    const start = Date.now();
    try {
      await this.pool.query('SELECT 1');
      return { status: 'healthy', latency: Date.now() - start };
    } catch {
      return { status: 'degraded', latency: Date.now() - start };
    }
  }

  // ==================== Internal ====================

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

// ==================== 使用示例 ====================

/**
 * 旧写法（紧耦合）
 * 
 *  * const pool = new ();
 * await db.query('SELECT * FROM chatops_commands');
 * 
 * // 直接调用其他服务
 * const pipelineService = new PipelineService();
 * await pipelineService.runPipeline(id);
 */

// 新写法（解耦）
// 
// // 1. 初始化服务
// const commandService = CommandService.getInstance();
// await commandService.initialize();
// 
// // 2. 使用服务
// const cmd = await commandService.insert({ name: 'test', ... });
// const list = await commandService.list({ permissionLevel: 'admin' });
// 
// // 3. 订阅事件（解耦通信）
// registry.subscribe('MyApp', 'chatops.command.created', async (data) => {
//   logger.info('Command created:', data.commandName);
// });

export default CommandService;