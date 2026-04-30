/**
 * ProjectService - Business logic layer for Project
 */
import { ProjectRepository, Project } from './ProjectRepository';

export class ProjectServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'ProjectServiceError'; }
}

export class ProjectService {
  private repository: ProjectRepository;
  constructor(repository: ProjectRepository) { this.repository = repository; }

  async createProject(tenantId: string, name: string, description?: string): Promise<Project> {
    if (!tenantId || !name) throw new ProjectServiceError('Tenant ID and name required', 'INVALID_INPUT');
    return this.repository.create(tenantId, name, description);
  }

  async listProjects(tenantId: string): Promise<Project[]> {
    return this.repository.findAll(tenantId);
  }

  async getProject(id: string): Promise<Project> {
    const project = await this.repository.findById(id);
    if (!project) throw new ProjectServiceError(`Project not found: ${id}`, 'NOT_FOUND');
    return project;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  async updateProject(id: string, input: { name?: string; description?: string }): Promise<Project> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new ProjectServiceError(`Project not found: ${id}`, 'NOT_FOUND');
    const updated = await this.repository.update(id, input);
    if (!updated) throw new ProjectServiceError(`Failed to update project: ${id}`, 'UPDATE_FAILED');
    return updated;
  }
}