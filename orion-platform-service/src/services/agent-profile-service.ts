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

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class AgentProfileService {
  private profiles: Map<string, AgentProfile> = new Map();

  /**
   * 创建 Agent Profile
   */
  async create(input: AgentProfileCreateInput): Promise<AgentProfile> {
    logger.info({ name: input.name, role: input.role }, 'Creating agent profile');

    // Check for duplicate name
    const existing = Array.from(this.profiles.values()).find(
      (p) => p.name === input.name
    );
    if (existing) {
      throw new Error(`Agent profile with name "${input.name}" already exists`);
    }

    const profile = createAgentProfile(input);
    this.profiles.set(profile.id, profile);

    logger.info({ id: profile.id }, 'Agent profile created');
    return profile;
  }

  /**
   * 获取 Agent Profile 列表
   */
  async list(options?: {
    roleFilter?: string;
    enabledOnly?: boolean;
  }): Promise<AgentProfile[]> {
    let profiles = Array.from(this.profiles.values());

    if (options?.roleFilter) {
      profiles = profiles.filter((p) => p.role === options.roleFilter);
    }

    if (options?.enabledOnly) {
      profiles = profiles.filter((p) => p.enabled);
    }

    return profiles;
  }

  /**
   * 获取 Agent Profile 详情
   */
  async getById(id: string): Promise<AgentProfile> {
    const profile = this.profiles.get(id);
    if (!profile) {
      throw new Error(`Agent profile "${id}" not found`);
    }
    return profile;
  }

  /**
   * 更新 Agent Profile
   */
  async update(id: string, input: AgentProfileUpdateInput): Promise<AgentProfile> {
    logger.info({ id }, 'Updating agent profile');

    const existing = this.profiles.get(id);
    if (!existing) {
      throw new Error(`Agent profile "${id}" not found`);
    }

    const updated = updateAgentProfile(existing, input);
    this.profiles.set(id, updated);

    logger.info({ id }, 'Agent profile updated');
    return updated;
  }

  /**
   * 删除 Agent Profile
   */
  async delete(id: string): Promise<void> {
    logger.info({ id }, 'Deleting agent profile');

    const existing = this.profiles.get(id);
    if (!existing) {
      throw new Error(`Agent profile "${id}" not found`);
    }

    this.profiles.delete(id);
    logger.info({ id }, 'Agent profile deleted');
  }

  /**
   * 启用/禁用 Agent
   */
  async toggle(id: string): Promise<AgentProfile> {
    const existing = this.profiles.get(id);
    if (!existing) {
      throw new Error(`Agent profile "${id}" not found`);
    }

    const updated = updateAgentProfile(existing, { enabled: !existing.enabled });
    this.profiles.set(id, updated);

    logger.info({ id, enabled: updated.enabled }, 'Agent profile toggled');
    return updated;
  }

  /**
   * 按名称获取（用于工作流引用）
   */
  async getByName(name: string): Promise<AgentProfile> {
    const profile = Array.from(this.profiles.values()).find(
      (p) => p.name === name
    );
    if (!profile) {
      throw new Error(`Agent profile "${name}" not found`);
    }
    return profile;
  }
}
