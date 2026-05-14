/**
 * AgentProfileService - Business logic layer for Agent Profile management
 *
 * Handles CRUD operations for agent profiles with PostgreSQL-backed storage.
 * Manages agent role, tool configuration, capabilities, constraints, and LLM settings.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AgentProfileRepository,
  AgentProfileEntity,
} from '../repositories/AgentProfileRepository';
import {
  AgentProfile,
  AgentRole,
  AgentToolConfig,
  AgentCapabilities,
  AgentConstraints,
  AgentLLMConfig,
  AgentProfileCreateInput,
  AgentProfileUpdateInput,
} from '../models/AgentProfile';

// ==================== Interfaces ====================

export interface ListAgentProfilesOptions {
  roleFilter?: string;
  enabledOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedAgentProfilesResult {
  data: AgentProfile[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class AgentProfileServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AgentProfileServiceError';
  }
}

// ==================== Default Configurations ====================

const DEFAULT_CAPABILITIES: AgentCapabilities = {
  maxSteps: 20,
  timeoutSec: 3600,
  retryCount: 3,
};

const DEFAULT_CONSTRAINTS: AgentConstraints = {
  maxTokens: 8192,
  allowedBranches: ['main', 'develop'],
  forbiddenOperations: ['deploy_to_production', 'drop_database'],
};

const DEFAULT_LLM_CONFIG: AgentLLMConfig = {
  model: 'gpt-4o-mini',
  temperature: 0.2,
  maxTokens: 4096,
};

const VALID_AGENT_ROLES: AgentRole[] = [
  'bug_fixer',
  'code_fixer',
  'test_writer',
  'pr_submitter',
  'security_patcher',
  'doc_writer',
];

// ==================== Type Mapping Helpers ====================

/**
 * Convert domain AgentProfile to repository AgentProfileEntity for DB storage.
 */
function profileToEntity(profile: AgentProfile): Omit<AgentProfileEntity, 'lastActiveAt'> {
  return {
    id: profile.id,
    name: profile.name,
    type: profile.role,
    capabilities: profile.capabilities as Record<string, any>,
    config: {
      description: profile.description,
      tools: profile.tools,
      constraints: profile.constraints,
      llmConfig: profile.llmConfig,
      enabled: profile.enabled,
    },
    status: profile.enabled ? 'active' : 'inactive',
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

/**
 * Convert repository AgentProfileEntity back to domain AgentProfile.
 */
function entityToProfile(entity: AgentProfileEntity): AgentProfile {
  const cfg = entity.config || {};
  return {
    id: entity.id,
    name: entity.name,
    role: entity.type as AgentRole,
    description: cfg.description || '',
    tools: (cfg.tools as AgentToolConfig[]) || [],
    capabilities: (entity.capabilities as AgentCapabilities) || DEFAULT_CAPABILITIES,
    constraints: (cfg.constraints as AgentConstraints) || DEFAULT_CONSTRAINTS,
    llmConfig: (cfg.llmConfig as AgentLLMConfig) || DEFAULT_LLM_CONFIG,
    enabled: entity.status === 'active',
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

/**
 * Build a domain AgentProfile from create input (not yet persisted).
 */
function buildProfileFromInput(input: AgentProfileCreateInput): AgentProfile {
  const now = new Date();
  return {
    id: uuidv4(),
    name: input.name,
    role: input.role,
    description: input.description || '',
    tools: input.tools || [
      { toolName: 'read_file', permission: 'read' },
      { toolName: 'run_command', permission: 'execute' },
    ],
    capabilities: { ...DEFAULT_CAPABILITIES, ...input.capabilities },
    constraints: { ...DEFAULT_CONSTRAINTS, ...input.constraints },
    llmConfig: { ...DEFAULT_LLM_CONFIG, ...input.llmConfig },
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

// ==================== Service ====================

export class AgentProfileService {
  private repository: AgentProfileRepository;

  constructor(db?: {
    query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
  }) {
    if (db) {
      this.repository = new AgentProfileRepository(db);
    } else {
      // Fallback: throw error to indicate database is required
      this.repository = null as unknown as AgentProfileRepository;
    }
  }

  /**
   * Create a new agent profile
   */
  async create(input: AgentProfileCreateInput): Promise<AgentProfile> {
    if (!this.repository) {
      throw new AgentProfileServiceError(
        'Database connection not available',
        'DB_NOT_AVAILABLE',
      );
    }

    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      throw new AgentProfileServiceError(
        'Agent profile name is required',
        'INVALID_INPUT',
      );
    }

    // Validate role
    if (!input.role || !VALID_AGENT_ROLES.includes(input.role)) {
      throw new AgentProfileServiceError(
        `Invalid agent role: ${input.role}. Valid roles: ${VALID_AGENT_ROLES.join(', ')}`,
        'INVALID_ROLE',
      );
    }

    // Build domain profile
    const profile = buildProfileFromInput(input);

    // Convert to entity and persist
    const entityInput = profileToEntity(profile);
    const entity = await this.repository.create({
      name: entityInput.name,
      type: entityInput.type,
      capabilities: entityInput.capabilities,
      config: entityInput.config,
      status: entityInput.status,
      lastActiveAt: null,
      id: entityInput.id,
      createdAt: entityInput.createdAt,
      updatedAt: entityInput.updatedAt,
    } as any);

    return entityToProfile(entity);
  }

  /**
   * Get agent profile by ID
   */
  async getById(id: string): Promise<AgentProfile> {
    if (!this.repository) {
      throw new AgentProfileServiceError(
        'Database connection not available',
        'DB_NOT_AVAILABLE',
      );
    }

    const entity = await this.repository.findById(id);
    if (!entity) {
      throw new AgentProfileServiceError(
        `Agent profile not found: ${id}`,
        'PROFILE_NOT_FOUND',
      );
    }

    return entityToProfile(entity);
  }

  /**
   * List agent profiles with optional filtering and pagination
   */
  async list(
    options: ListAgentProfilesOptions = {},
  ): Promise<AgentProfile[]> {
    if (!this.repository) {
      throw new AgentProfileServiceError(
        'Database connection not available',
        'DB_NOT_AVAILABLE',
      );
    }

    const { roleFilter, enabledOnly } = options;

    // Build where clause for filtering
    const where: Record<string, any> = {};
    if (roleFilter) {
      where.type = roleFilter;
    }
    if (enabledOnly) {
      where.status = 'active';
    }

    const result = await this.repository.findAll({
      where,
      orderBy: 'created_at',
      orderDir: 'DESC',
      limit: options.limit ?? 100,
      offset: 0,
    });

    return result.entities.map(entityToProfile);
  }

  /**
   * List agent profiles with full pagination info
   */
  async listPaginated(
    options: ListAgentProfilesOptions = {},
  ): Promise<PaginatedAgentProfilesResult> {
    if (!this.repository) {
      throw new AgentProfileServiceError(
        'Database connection not available',
        'DB_NOT_AVAILABLE',
      );
    }

    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const offset = (page - 1) * limit;

    const where: Record<string, any> = {};
    if (options.roleFilter) {
      where.type = options.roleFilter;
    }
    if (options.enabledOnly) {
      where.status = 'active';
    }

    const result = await this.repository.findAll({
      where,
      orderBy: 'created_at',
      orderDir: 'DESC',
      limit,
      offset,
    });

    return {
      data: result.entities.map(entityToProfile),
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  /**
   * Update an existing agent profile
   */
  async update(
    id: string,
    input: AgentProfileUpdateInput,
  ): Promise<AgentProfile> {
    if (!this.repository) {
      throw new AgentProfileServiceError(
        'Database connection not available',
        'DB_NOT_AVAILABLE',
      );
    }

    // Fetch existing profile
    const existingEntity = await this.repository.findById(id);
    if (!existingEntity) {
      throw new AgentProfileServiceError(
        `Agent profile not found: ${id}`,
        'PROFILE_NOT_FOUND',
      );
    }

    const existingProfile = entityToProfile(existingEntity);

    // Build updated profile
    const updatedProfile: AgentProfile = {
      ...existingProfile,
      description: input.description ?? existingProfile.description,
      tools: input.tools ?? existingProfile.tools,
      capabilities: input.capabilities
        ? { ...existingProfile.capabilities, ...input.capabilities }
        : existingProfile.capabilities,
      constraints: input.constraints
        ? { ...existingProfile.constraints, ...input.constraints }
        : existingProfile.constraints,
      llmConfig: input.llmConfig
        ? { ...existingProfile.llmConfig, ...input.llmConfig }
        : existingProfile.llmConfig,
      enabled: input.enabled ?? existingProfile.enabled,
      updatedAt: new Date(),
    };

    // Convert to entity and persist
    const entityData = profileToEntity(updatedProfile);
    const updatePayload: Record<string, any> = {
      name: entityData.name,
      type: entityData.type,
      capabilities: entityData.capabilities,
      config: entityData.config,
      status: entityData.status,
      last_active_at: null,
      created_at: entityData.createdAt,
      updated_at: entityData.updatedAt,
    };

    const updatedEntity = await this.repository.update(id, updatePayload);
    return entityToProfile(updatedEntity);
  }

  /**
   * Delete an agent profile
   */
  async delete(id: string): Promise<void> {
    if (!this.repository) {
      throw new AgentProfileServiceError(
        'Database connection not available',
        'DB_NOT_AVAILABLE',
      );
    }

    // Verify exists
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AgentProfileServiceError(
        `Agent profile not found: ${id}`,
        'PROFILE_NOT_FOUND',
      );
    }

    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new AgentProfileServiceError(
        `Failed to delete agent profile: ${id}`,
        'DELETE_FAILED',
      );
    }
  }

  /**
   * Toggle agent profile enabled/disabled status
   */
  async toggle(id: string): Promise<AgentProfile> {
    if (!this.repository) {
      throw new AgentProfileServiceError(
        'Database connection not available',
        'DB_NOT_AVAILABLE',
      );
    }

    const existingEntity = await this.repository.findById(id);
    if (!existingEntity) {
      throw new AgentProfileServiceError(
        `Agent profile not found: ${id}`,
        'PROFILE_NOT_FOUND',
      );
    }

    const existingProfile = entityToProfile(existingEntity);
    const newEnabled = !existingProfile.enabled;
    const newStatus = newEnabled ? 'active' : 'inactive';

    await this.repository.updateStatus(id, newStatus);

    // Re-fetch to get updated entity
    const updatedEntity = await this.repository.findById(id);
    if (!updatedEntity) {
      throw new AgentProfileServiceError(
        `Failed to retrieve updated profile: ${id}`,
        'UPDATE_FAILED',
      );
    }

    return entityToProfile(updatedEntity);
  }

  /**
   * Find profiles by agent role type
   */
  async findByType(type: string): Promise<AgentProfile[]> {
    if (!this.repository) {
      throw new AgentProfileServiceError(
        'Database connection not available',
        'DB_NOT_AVAILABLE',
      );
    }

    const entities = await this.repository.findByType(type);
    return entities.map(entityToProfile);
  }

  /**
   * Find all active (enabled) profiles
   */
  async findActive(): Promise<AgentProfile[]> {
    if (!this.repository) {
      throw new AgentProfileServiceError(
        'Database connection not available',
        'DB_NOT_AVAILABLE',
      );
    }

    const entities = await this.repository.findActive();
    return entities.map(entityToProfile);
  }

  /**
   * Update agent capabilities directly
   */
  async updateCapabilities(
    id: string,
    capabilities: Partial<AgentCapabilities>,
  ): Promise<AgentProfile> {
    if (!this.repository) {
      throw new AgentProfileServiceError(
        'Database connection not available',
        'DB_NOT_AVAILABLE',
      );
    }

    const existingEntity = await this.repository.findById(id);
    if (!existingEntity) {
      throw new AgentProfileServiceError(
        `Agent profile not found: ${id}`,
        'PROFILE_NOT_FOUND',
      );
    }

    const existingProfile = entityToProfile(existingEntity);
    const mergedCapabilities = {
      ...existingProfile.capabilities,
      ...capabilities,
    };

    await this.repository.updateCapabilities(id, mergedCapabilities as Record<string, any>);

    const updatedEntity = await this.repository.findById(id);
    if (!updatedEntity) {
      throw new AgentProfileServiceError(
        `Failed to retrieve updated profile: ${id}`,
        'UPDATE_FAILED',
      );
    }

    return entityToProfile(updatedEntity);
  }
}

export default AgentProfileService;
