/**
 * Problem Management Service
 *
 * ITIL Problem Management: lifecycle management, incident/change linking,
 * Known Error Database (KEDB) operations, and auto-creation from incidents.
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';
import {
  ProblemRepository,
  KnownErrorRepository,
  ProblemEntity,
  KnownErrorEntity,
  ProblemFilters,
  KnownErrorFilters,
  ProblemStats,
} from '../../repositories/ProblemRepository';
import { OrionError, ErrorCode } from '../../errors';

const logger = createLogger('ProblemService');

// Valid status transitions for problem lifecycle
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  known: ['investigating'],
  investigating: ['resolved', 'known'],
  resolved: ['closed', 'investigating'],
  closed: [],
};

export interface CreateProblemInput {
  title: string;
  description?: string;
  severity?: string;
  category?: string;
  assignedTo?: string;
  createdBy?: string;
  metadata?: Record<string, any>;
}

export interface UpdateProblemInput {
  title?: string;
  description?: string;
  severity?: string;
  category?: string;
  rootCause?: string;
  workaround?: string;
  resolution?: string;
  assignedTo?: string;
  metadata?: Record<string, any>;
}

export interface CreateKnownErrorInput {
  problemId?: string;
  title: string;
  symptoms: string;
  rootCause: string;
  workaround: string;
  permanentFix?: string;
  affectedServices?: string[];
  keywords?: string[];
  createdBy?: string;
}

export interface UpdateKnownErrorInput {
  title?: string;
  symptoms?: string;
  rootCause?: string;
  workaround?: string;
  permanentFix?: string;
  status?: string;
  affectedServices?: string[];
  keywords?: string[];
}

export class ProblemService {
  private problemRepo: ProblemRepository | null = null;
  private knownErrorRepo: KnownErrorRepository | null = null;
  private db: any;

  constructor(db?: any) {
    this.db = db;
  }

  init(): void {
    if (this.db) {
      this.problemRepo = new ProblemRepository(this.db);
      this.knownErrorRepo = new KnownErrorRepository(this.db);
      logger.info('[ProblemService] Initialized with database connection');
    } else {
      logger.warn('[ProblemService] No database connection provided, running in degraded mode');
    }
  }

  // ==================== Problem CRUD ====================

  async createProblem(input: CreateProblemInput, tenantId: string): Promise<ProblemEntity> {
    if (!this.problemRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);
    if (!input.title) throw new OrionError('Title is required', ErrorCode.VALIDATION_ERROR);

    const problem = await this.problemRepo.create({
      tenantId,
      title: input.title,
      description: input.description || null,
      status: 'known',
      severity: input.severity || 'medium',
      category: input.category || null,
      assignedTo: input.assignedTo || null,
      createdBy: input.createdBy || null,
      relatedIncidents: [],
      relatedChanges: [],
      metadata: input.metadata || {},
    });

    logger.info({ problemId: problem.id, tenantId }, '[ProblemService] Problem created');
    return problem;
  }

  async getProblem(id: string, tenantId: string): Promise<ProblemEntity> {
    if (!this.problemRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const problem = await this.problemRepo.findByIdAndTenant(id, tenantId);
    if (!problem) throw new OrionError(`Problem not found: ${id}`, ErrorCode.RESOURCE_NOT_FOUND);
    return problem;
  }

  async listProblems(tenantId: string, filters: ProblemFilters = {}): Promise<{ data: ProblemEntity[]; total: number }> {
    if (!this.problemRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const result = await this.problemRepo.findByTenant(tenantId, filters);
    return { data: result.entities, total: result.total };
  }

  async updateProblem(id: string, input: UpdateProblemInput, tenantId: string): Promise<ProblemEntity> {
    if (!this.problemRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const existing = await this.problemRepo.findByIdAndTenant(id, tenantId);
    if (!existing) throw new OrionError(`Problem not found: ${id}`, ErrorCode.RESOURCE_NOT_FOUND);

    const updates: Record<string, any> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.severity !== undefined) updates.severity = input.severity;
    if (input.category !== undefined) updates.category = input.category;
    if (input.rootCause !== undefined) updates.rootCause = input.rootCause;
    if (input.workaround !== undefined) updates.workaround = input.workaround;
    if (input.resolution !== undefined) updates.resolution = input.resolution;
    if (input.assignedTo !== undefined) updates.assignedTo = input.assignedTo;
    if (input.metadata !== undefined) updates.metadata = input.metadata;

    if (Object.keys(updates).length === 0) {
      return existing;
    }

    const updated = await this.problemRepo.update(id, updates);
    if (!updated) throw new OrionError('Failed to update problem', ErrorCode.OPERATION_FAILED);
    logger.info({ problemId: id, tenantId }, '[ProblemService] Problem updated');
    return updated;
  }

  async deleteProblem(id: string, tenantId: string): Promise<boolean> {
    if (!this.problemRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const existing = await this.problemRepo.findByIdAndTenant(id, tenantId);
    if (!existing) throw new OrionError(`Problem not found: ${id}`, ErrorCode.RESOURCE_NOT_FOUND);

    await this.problemRepo.delete(id);
    logger.info({ problemId: id, tenantId }, '[ProblemService] Problem deleted');
    return true;
  }

  // ==================== Status Lifecycle ====================

  async updateStatus(id: string, status: string, tenantId: string): Promise<ProblemEntity> {
    if (!this.problemRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const existing = await this.problemRepo.findByIdAndTenant(id, tenantId);
    if (!existing) throw new OrionError(`Problem not found: ${id}`, ErrorCode.RESOURCE_NOT_FOUND);

    const allowedTransitions = VALID_STATUS_TRANSITIONS[existing.status] || [];
    if (!allowedTransitions.includes(status)) {
      throw new OrionError(
        `Invalid status transition: ${existing.status} -> ${status}. Allowed: ${allowedTransitions.join(', ') || 'none'}`,
        ErrorCode.STATE_CONFLICT,
      );
    }

    const updated = await this.problemRepo.updateStatus(id, status, tenantId);
    if (!updated) throw new OrionError('Failed to update problem status', ErrorCode.OPERATION_FAILED);

    logger.info({ problemId: id, from: existing.status, to: status, tenantId }, '[ProblemService] Problem status updated');
    return updated;
  }

  // ==================== Incident / Change Linking ====================

  async linkIncident(problemId: string, incidentId: string, tenantId: string): Promise<ProblemEntity> {
    if (!this.problemRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const existing = await this.problemRepo.findByIdAndTenant(problemId, tenantId);
    if (!existing) throw new OrionError(`Problem not found: ${problemId}`, ErrorCode.RESOURCE_NOT_FOUND);

    if (existing.relatedIncidents.includes(incidentId)) {
      return existing; // Already linked
    }

    const updated = await this.problemRepo.addIncident(problemId, incidentId, tenantId);
    if (!updated) throw new OrionError('Failed to link incident', ErrorCode.OPERATION_FAILED);

    logger.info({ problemId, incidentId, tenantId }, '[ProblemService] Incident linked to problem');
    return updated;
  }

  async linkChange(problemId: string, changeId: string, tenantId: string): Promise<ProblemEntity> {
    if (!this.problemRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const existing = await this.problemRepo.findByIdAndTenant(problemId, tenantId);
    if (!existing) throw new OrionError(`Problem not found: ${problemId}`, ErrorCode.RESOURCE_NOT_FOUND);

    if (existing.relatedChanges.includes(changeId)) {
      return existing; // Already linked
    }

    const updated = await this.problemRepo.addChange(problemId, changeId, tenantId);
    if (!updated) throw new OrionError('Failed to link change', ErrorCode.OPERATION_FAILED);

    logger.info({ problemId, changeId, tenantId }, '[ProblemService] Change linked to problem');
    return updated;
  }

  // ==================== Statistics ====================

  async getStats(tenantId: string): Promise<ProblemStats> {
    if (!this.problemRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);
    return this.problemRepo.getStats(tenantId);
  }

  // ==================== Known Error CRUD ====================

  async createKnownError(input: CreateKnownErrorInput, tenantId: string): Promise<KnownErrorEntity> {
    if (!this.knownErrorRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);
    if (!input.title || !input.symptoms || !input.rootCause || !input.workaround) {
      throw new OrionError('title, symptoms, rootCause, and workaround are required', ErrorCode.VALIDATION_ERROR);
    }

    const knownError = await this.knownErrorRepo.create({
      tenantId,
      problemId: input.problemId || null,
      title: input.title,
      symptoms: input.symptoms,
      rootCause: input.rootCause,
      workaround: input.workaround,
      permanentFix: input.permanentFix || null,
      status: 'active',
      affectedServices: input.affectedServices || [],
      keywords: input.keywords || [],
      createdBy: input.createdBy || null,
    });

    logger.info({ knownErrorId: knownError.id, tenantId }, '[ProblemService] Known error created');
    return knownError;
  }

  async getKnownError(id: string, tenantId: string): Promise<KnownErrorEntity> {
    if (!this.knownErrorRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const knownError = await this.knownErrorRepo.findByIdAndTenant(id, tenantId);
    if (!knownError) throw new OrionError(`Known error not found: ${id}`, ErrorCode.RESOURCE_NOT_FOUND);
    return knownError;
  }

  async listKnownErrors(tenantId: string, filters: KnownErrorFilters = {}): Promise<{ data: KnownErrorEntity[]; total: number }> {
    if (!this.knownErrorRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const result = await this.knownErrorRepo.findByTenant(tenantId, filters);
    return { data: result.entities, total: result.total };
  }

  async updateKnownError(id: string, input: UpdateKnownErrorInput, tenantId: string): Promise<KnownErrorEntity> {
    if (!this.knownErrorRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const existing = await this.knownErrorRepo.findByIdAndTenant(id, tenantId);
    if (!existing) throw new OrionError(`Known error not found: ${id}`, ErrorCode.RESOURCE_NOT_FOUND);

    const updates: Record<string, any> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.symptoms !== undefined) updates.symptoms = input.symptoms;
    if (input.rootCause !== undefined) updates.rootCause = input.rootCause;
    if (input.workaround !== undefined) updates.workaround = input.workaround;
    if (input.permanentFix !== undefined) updates.permanentFix = input.permanentFix;
    if (input.status !== undefined) updates.status = input.status;
    if (input.affectedServices !== undefined) updates.affectedServices = input.affectedServices;
    if (input.keywords !== undefined) updates.keywords = input.keywords;

    if (Object.keys(updates).length === 0) return existing;

    const updated = await this.knownErrorRepo.update(id, updates);
    if (!updated) throw new OrionError('Failed to update known error', ErrorCode.OPERATION_FAILED);
    logger.info({ knownErrorId: id, tenantId }, '[ProblemService] Known error updated');
    return updated;
  }

  async deleteKnownError(id: string, tenantId: string): Promise<boolean> {
    if (!this.knownErrorRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const existing = await this.knownErrorRepo.findByIdAndTenant(id, tenantId);
    if (!existing) throw new OrionError(`Known error not found: ${id}`, ErrorCode.RESOURCE_NOT_FOUND);

    await this.knownErrorRepo.delete(id);
    logger.info({ knownErrorId: id, tenantId }, '[ProblemService] Known error deleted');
    return true;
  }

  // ==================== Known Error Search ====================

  async searchKnownErrors(query: string, tenantId: string): Promise<KnownErrorEntity[]> {
    if (!this.knownErrorRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);
    if (!query) throw new OrionError('Search query is required', ErrorCode.VALIDATION_ERROR);

    return this.knownErrorRepo.search(tenantId, query);
  }

  async findByKeywords(keywords: string[], tenantId: string): Promise<KnownErrorEntity[]> {
    if (!this.knownErrorRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);
    if (!keywords.length) throw new OrionError('At least one keyword is required', ErrorCode.VALIDATION_ERROR);

    return this.knownErrorRepo.findByKeywords(tenantId, keywords);
  }

  // ==================== Auto-create from Incident ====================

  async createFromIncident(incidentData: { title: string; description?: string; severity?: string; incidentId: string; tenantId: string; createdBy?: string }): Promise<ProblemEntity> {
    if (!this.problemRepo) throw new OrionError('Database not available', ErrorCode.SERVICE_UNAVAILABLE);

    const problem = await this.createProblem({
      title: `[Auto] ${incidentData.title}`,
      description: incidentData.description || `Auto-created from incident ${incidentData.incidentId}`,
      severity: incidentData.severity || 'medium',
      category: 'incident-derived',
      createdBy: incidentData.createdBy,
    }, incidentData.tenantId);

    // Link the originating incident
    await this.linkIncident(problem.id, incidentData.incidentId, incidentData.tenantId);

    logger.info({ problemId: problem.id, incidentId: incidentData.incidentId }, '[ProblemService] Problem auto-created from incident');
    return problem;
  }
}
