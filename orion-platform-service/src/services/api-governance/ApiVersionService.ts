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

export class ApiVersionService {
  private versions = new Map<string, ApiVersion>();

  async registerApiVersion(
    tenantId: string,
    input: RegisterApiVersionInput,
  ): Promise<ApiVersion> {
    const now = new Date().toISOString();
    const version: ApiVersion = {
      id: randomUUID(),
      tenantId,
      apiId: input.apiId,
      version: input.version,
      definition: input.definition,
      status: 'active',
      createdAt: now,
    };
    this.versions.set(version.id, version);
    return version;
  }

  async listApiVersions(apiId: string): Promise<ApiVersion[]> {
    return Array.from(this.versions.values())
      .filter((v) => v.apiId === apiId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getVersion(versionId: string): Promise<ApiVersion | null> {
    return this.versions.get(versionId) ?? null;
  }

  async deprecateVersion(versionId: string): Promise<ApiVersion | null> {
    const version = this.versions.get(versionId);
    if (!version) return null;

    version.status = 'deprecated';
    version.deprecatedAt = new Date().toISOString();
    return version;
  }

  async checkCompatibility(
    versionId: string,
    newDefinition: Record<string, unknown>,
  ): Promise<CompatibilityReport | null> {
    const version = this.versions.get(versionId);
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
    return this.versions.delete(versionId);
  }

  async getVersionsByTenant(tenantId: string): Promise<ApiVersion[]> {
    return Array.from(this.versions.values()).filter((v) => v.tenantId === tenantId);
  }
}
