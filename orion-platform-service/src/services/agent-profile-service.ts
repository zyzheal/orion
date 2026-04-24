/**
 * Agent Profile Service
 *
 * 负责 Agent Profile 的生命周期管理：
 * - 创建、查询、更新、删除 Agent Profile
 * - 启用/禁用 Agent
 * - 查询可用 Agent 列表
 */

import pino from 'pino';
import {
  AgentProfile,
  AgentProfileCreateInput,
  AgentProfileUpdateInput,
  createAgentProfile,
  updateAgentProfile,
} from '../models/AgentProfile';
import { AgentProfileRepository, AgentProfileEntity } from '../repositories/AgentProfileRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class AgentProfileService {
  private profileRepository?: AgentProfileRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.profileRepository = new AgentProfileRepository(db);
    }
  }

  /**
   * 创建 Agent Profile
   */
  async create(input: AgentProfileCreateInput): Promise<AgentProfile> {
    logger.info({ name: input.name, role: input.role }, 'Creating agent profile');

    if (this.profileRepository) {
      const entity = await this.profileRepository.create({
        name: input.name,
        type: input.role ?? 'general',
        capabilities: input.capabilities ?? {},
        config: input.config ?? {},
        status: 'active',
        lastActiveAt: null,
      });
      logger.info({ id: entity.id }, 'Agent profile created');
      return this.mapEntityToProfile(entity);
    }

    const profile = createAgentProfile(input);
    logger.info({ id: profile.id }, 'Agent profile created (memory)');
    return profile;
  }

  /**
   * 获取 Agent Profile 列表
   */
  async list(options?: {
    roleFilter?: string;
    enabledOnly?: boolean;
  }): Promise<AgentProfile[]> {
    if (this.profileRepository) {
      let entities = await this.profileRepository.findAll();

      if (options?.roleFilter) {
        entities = entities.filter((e) => e.type === options.roleFilter);
      }

      if (options?.enabledOnly) {
        entities = entities.filter((e) => e.status === 'active');
      }

      return entities.map(e => this.mapEntityToProfile(e));
    }
    return [];
  }

  /**
   * 获取 Agent Profile 详情
   */
  async getById(id: string): Promise<AgentProfile> {
    if (this.profileRepository) {
      const entity = await this.profileRepository.findById(id);
      if (!entity) {
        throw new Error(`Agent profile "${id}" not found`);
      }
      return this.mapEntityToProfile(entity);
    }
    throw new Error(`Agent profile "${id}" not found`);
  }

  /**
   * 更新 Agent Profile
   */
  async update(id: string, input: AgentProfileUpdateInput): Promise<AgentProfile> {
    logger.info({ id }, 'Updating agent profile');

    if (this.profileRepository) {
      const updates: Partial<AgentProfileEntity> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.role !== undefined) updates.type = input.role;
      if (input.capabilities !== undefined) updates.capabilities = input.capabilities;
      if (input.config !== undefined) updates.config = input.config;

      const updated = await this.profileRepository.update(id, updates);
      if (!updated) {
        throw new Error(`Agent profile "${id}" not found`);
      }
      logger.info({ id }, 'Agent profile updated');
      return this.mapEntityToProfile(updated);
    }
    throw new Error(`Agent profile "${id}" not found`);
  }

  /**
   * 删除 Agent Profile
   */
  async delete(id: string): Promise<void> {
    logger.info({ id }, 'Deleting agent profile');

    if (this.profileRepository) {
      const deleted = await this.profileRepository.delete(id);
      if (!deleted) {
        throw new Error(`Agent profile "${id}" not found`);
      }
      logger.info({ id }, 'Agent profile deleted');
      return;
    }
    throw new Error(`Agent profile "${id}" not found`);
  }

  /**
   * 启用/禁用 Agent
   */
  async toggle(id: string): Promise<AgentProfile> {
    if (this.profileRepository) {
      const entity = await this.profileRepository.findById(id);
      if (!entity) {
        throw new Error(`Agent profile "${id}" not found`);
      }
      const newStatus = entity.status === 'active' ? 'inactive' : 'active';
      const updated = await this.profileRepository.update(id, { status: newStatus });
      if (!updated) {
        throw new Error(`Agent profile "${id}" not found`);
      }
      logger.info({ id, status: updated.status }, 'Agent profile toggled');
      return this.mapEntityToProfile(updated);
    }
    throw new Error(`Agent profile "${id}" not found`);
  }

  /**
   * 按名称获取（用于工作流引用）
   */
  async getByName(name: string): Promise<AgentProfile> {
    if (this.profileRepository) {
      const entities = await this.profileRepository.findAll();
      const entity = entities.find(e => e.name === name);
      if (!entity) {
        throw new Error(`Agent profile "${name}" not found`);
      }
      return this.mapEntityToProfile(entity);
    }
    throw new Error(`Agent profile "${name}" not found`);
  }

  private mapEntityToProfile(entity: AgentProfileEntity): AgentProfile {
    return {
      id: entity.id,
      name: entity.name,
      role: entity.type,
      capabilities: entity.capabilities,
      config: entity.config,
      enabled: entity.status === 'active',
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
