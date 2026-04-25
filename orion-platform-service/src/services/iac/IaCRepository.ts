/**
 * IaC Repository - Simple in-memory fallback repository
 * (Primary persistence is now via PostgreSQL repositories in src/repositories/)
 */

import { IaCWorkspace } from '../../models/IacWorkspace';

export class IaCRepository {
  private workspaces: Map<string, IaCWorkspace> = new Map();

  async create(tenantId: string, name: string, provider: string): Promise<IaCWorkspace> {
    const workspace: IaCWorkspace = {
      id: `${tenantId}-${name}-${Date.now()}`,
      name,
      projectId: tenantId,
      environment: 'dev',
      statePath: '',
      variables: {},
      lockedBy: null,
      status: 'active',
      provider: provider as any,
      createdAt: new Date(),
    };
    this.workspaces.set(workspace.id, workspace);
    return workspace;
  }

  async findAll(tenantId: string): Promise<IaCWorkspace[]> {
    return Array.from(this.workspaces.values()).filter(w => w.projectId === tenantId);
  }
}
