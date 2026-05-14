import { randomUUID } from 'crypto';

export interface ApiVersion {
  id: string;
  tenantId: string;
  apiId: string;
  version: string;
  definition: Record<string, unknown>;
  status: 'active' | 'deprecated' | 'archived';
  createdAt: string;
  deprecatedAt?: string;
}

export interface CompatibilityReport {
  compatible: boolean;
  breakingChanges: string[];
  warnings: string[];
  checkedAt: string;
}

export interface RegisterApiVersionInput {
  apiId: string;
  version: string;
  definition: Record<string, unknown>;
}

import { ApiVersionRepository } from '../../repositories/ApiVersionRepository';

export class ApiVersionService {
  private repository: ApiVersionRepository | null = null;

  constructor(
    private db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }
  ) {
    if (db) {
      this.repository = new ApiVersionRepository(db as any);
    }
  }

  async registerApiVersion(
    tenantId: string,
    input: RegisterApiVersionInput,
  ): Promise<ApiVersion> {
    const now = new Date().toISOString();
    const id = randomUUID();

    if (this.repository) {
      const entity = await this.repository.createVersion({
        id,
        tenantId,
        apiId: input.apiId,
        version: input.version,
        definition: input.definition,
      });

      return {
        id: entity.id,
        tenantId: entity.tenantId,
        apiId: entity.apiId,
        version: entity.version,
        definition: entity.definition,
        status: entity.status,
        createdAt: entity.createdAt.toISOString(),
        deprecatedAt: entity.deprecatedAt?.toISOString(),
      };
    }

    // Fallback to in-memory if no DB
    const version: ApiVersion = {
      id,
      tenantId,
      apiId: input.apiId,
      version: input.version,
      definition: input.definition,
      status: 'active',
      createdAt: now,
    };
    return version;
  }

  async listApiVersions(apiId: string): Promise<ApiVersion[]> {
    if (!this.repository) return [];

    const entities = await this.repository.findByApiId(apiId);
    return entities.map(entity => ({
      id: entity.id,
      tenantId: entity.tenantId,
      apiId: entity.apiId,
      version: entity.version,
      definition: entity.definition,
      status: entity.status,
      createdAt: entity.createdAt.toISOString(),
      deprecatedAt: entity.deprecatedAt?.toISOString(),
    }));
  }

  async getVersion(versionId: string): Promise<ApiVersion | null> {
    if (!this.repository) return null;

    const entity = await this.repository.findById(versionId);
    if (!entity) return null;

    return {
      id: entity.id,
      tenantId: entity.tenantId,
      apiId: entity.apiId,
      version: entity.version,
      definition: entity.definition,
      status: entity.status,
      createdAt: entity.createdAt.toISOString(),
      deprecatedAt: entity.deprecatedAt?.toISOString(),
    };
  }

  async deprecateVersion(versionId: string): Promise<ApiVersion | null> {
    if (!this.repository) return null;

    const entity = await this.repository.updateStatus(versionId, 'deprecated');
    if (!entity) return null;

    return {
      id: entity.id,
      tenantId: entity.tenantId,
      apiId: entity.apiId,
      version: entity.version,
      definition: entity.definition,
      status: entity.status,
      createdAt: entity.createdAt.toISOString(),
      deprecatedAt: entity.deprecatedAt?.toISOString(),
    };
  }

  async checkCompatibility(
    versionId: string,
    newDefinition: Record<string, unknown>,
  ): Promise<CompatibilityReport | null> {
    const version = await this.getVersion(versionId);
    if (!version) return null;

    const breakingChanges: string[] = [];
    const warnings: string[] = [];

    const oldEndpoints = version.definition.endpoints as Record<string, unknown> | undefined;
    const newEndpoints = newDefinition.endpoints as Record<string, unknown> | undefined;

    if (oldEndpoints && newEndpoints) {
      for (const [path, oldMethodDef] of Object.entries(oldEndpoints)) {
        if (!(path in newEndpoints)) {
          breakingChanges.push(`Endpoint removed: ${path}`);
          continue;
        }

        const oldMethods = oldMethodDef as Record<string, unknown>;
        const newMethods = (newEndpoints as Record<string, unknown>)[path] as Record<string, unknown>;

        for (const [method, oldReqSchema] of Object.entries(oldMethods)) {
          const newReqSchema = newMethods[method];
          if (!newReqSchema) {
            breakingChanges.push(`Method removed: ${method.toUpperCase()} ${path}`);
            continue;
          }

          const oldParams = (oldReqSchema as any)?.parameters || {};
          const newParams = (newReqSchema as any)?.parameters || {};

          for (const [paramName, paramDef] of Object.entries(oldParams)) {
            if (!(paramName in newParams)) {
              breakingChanges.push(`Required parameter removed: ${paramName} from ${method.toUpperCase()} ${path}`);
            }
          }
        }
      }

      for (const path of Object.keys(newEndpoints)) {
        if (!(path in oldEndpoints)) {
          warnings.push(`New endpoint added: ${path}`);
        }
      }
    }

    return {
      compatible: breakingChanges.length === 0,
      breakingChanges,
      warnings,
      checkedAt: new Date().toISOString(),
    };
  }

  async deleteVersion(versionId: string): Promise<boolean> {
    if (!this.repository) return false;
    return this.repository.deleteVersion(versionId);
  }

  async getVersionsByTenant(tenantId: string): Promise<ApiVersion[]> {
    if (!this.repository) return [];

    const entities = await this.repository.findByTenant(tenantId);
    return entities.map(entity => ({
      id: entity.id,
      tenantId: entity.tenantId,
      apiId: entity.apiId,
      version: entity.version,
      definition: entity.definition,
      status: entity.status,
      createdAt: entity.createdAt.toISOString(),
      deprecatedAt: entity.deprecatedAt?.toISOString(),
    }));
  }
}