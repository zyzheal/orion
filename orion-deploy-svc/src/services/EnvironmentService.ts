import type { EnvironmentType } from "../types/deploy";

/**
 * Represents an environment record
 */
export interface EnvironmentRecord {
  id: string;
  name: string;
  type: EnvironmentType;
  tenantId: string;
  clusterUrl: string;
  namespace: string;
  isActive: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Service responsible for managing deployment environments.
 *
 * Dependencies:
 * - orion-platform-core: Validate tenant existence
 */
export class EnvironmentService {
  // TODO: Inject database connection / ORM

  /**
   * List environments, optionally filtered by tenant
   */
  async listEnvironments(
    tenantId?: string,
  ): Promise<{ data: EnvironmentRecord[]; total: number }> {
    // TODO: Query database for environments
    // TODO: Filter by tenantId if provided
    // TODO: Order by creation date descending

    return { data: [], total: 0 };
  }

  /**
   * Get a single environment by ID
   */
  async getEnvironment(id: string): Promise<EnvironmentRecord | null> {
    // TODO: Query database by id
    // TODO: Return null if not found

    return null;
  }

  /**
   * Get environment by tenant + name (for lookup during deployment creation)
   */
  async getEnvironmentByName(
    tenantId: string,
    name: string,
  ): Promise<EnvironmentRecord | null> {
    // TODO: Query database by tenantId + name

    return null;
  }

  /**
   * Create a new environment
   */
  async createEnvironment(
    data: Omit<EnvironmentRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<EnvironmentRecord> {
    // TODO: Validate tenant exists via orion-platform-core
    // TODO: Validate cluster connectivity
    // TODO: Check for duplicate environment name in tenant
    // TODO: Insert record into database

    throw new Error("TODO: Implement createEnvironment");
  }

  /**
   * Update environment configuration
   */
  async updateConfig(
    id: string,
    updates: {
      config?: Record<string, unknown>;
      clusterUrl?: string;
      namespace?: string;
    },
  ): Promise<EnvironmentRecord> {
    // TODO: Verify environment exists
    // TODO: If clusterUrl changes, validate new connectivity
    // TODO: Merge config with existing config
    // TODO: Persist changes to database

    throw new Error("TODO: Implement updateConfig");
  }

  /**
   * Deactivate an environment (soft delete)
   */
  async deactivateEnvironment(id: string): Promise<void> {
    // TODO: Check no active deployments in this environment
    // TODO: Set isActive = false

    return;
  }
}
