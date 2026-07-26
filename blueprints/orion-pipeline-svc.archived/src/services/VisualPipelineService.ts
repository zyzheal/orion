/**
 * VisualPipelineService - Business logic for visual pipeline editor
 */

import { DatabasePool } from '../utils/database';
import { VisualPipelineRepository } from '../repositories/VisualPipelineRepository';
import type { VisualPipeline, VisualPipelineCreateInput, VisualPipelineUpdateInput, VisualPipelineFilter } from '../models/VisualPipeline';
import pino from 'pino';

const logger = pino({ name: 'VisualPipelineService' });

export class VisualPipelineService {
  private repository: VisualPipelineRepository;

  constructor(private pool: DatabasePool) {
    this.repository = new VisualPipelineRepository(pool);
  }

  /**
   * Create a new visual pipeline layout
   */
  async create(input: VisualPipelineCreateInput): Promise<VisualPipeline> {
    logger.info({ tenantId: input.tenantId, pipelineId: input.pipelineId, name: input.name }, 'Creating visual pipeline');
    return this.repository.create(input);
  }

  /**
   * Get visual pipeline by ID
   */
  async getById(tenantId: string, id: string): Promise<VisualPipeline | null> {
    return this.repository.findById(tenantId, id);
  }

  /**
   * Get all layouts for a pipeline
   */
  async getByPipelineId(tenantId: string, pipelineId: string): Promise<VisualPipeline[]> {
    return this.repository.findByPipelineId(tenantId, pipelineId);
  }

  /**
   * List visual pipelines with filters
   */
  async list(filter: VisualPipelineFilter): Promise<{ data: VisualPipeline[]; total: number }> {
    return this.repository.findAll(filter);
  }

  /**
   * Update visual pipeline
   */
  async update(tenantId: string, id: string, input: VisualPipelineUpdateInput): Promise<VisualPipeline | null> {
    logger.info({ tenantId, id, input }, 'Updating visual pipeline');
    return this.repository.update(tenantId, id, input);
  }

  /**
   * Delete visual pipeline
   */
  async delete(tenantId: string, id: string): Promise<boolean> {
    logger.info({ tenantId, id }, 'Deleting visual pipeline');
    return this.repository.delete(tenantId, id);
  }

  /**
   * Save layout for a pipeline (upsert - create or update)
   */
  async saveLayout(
    tenantId: string,
    pipelineId: string,
    name: string,
    layout: VisualPipelineCreateInput['layout'],
    yamlDefinition: string,
    createdBy?: string
  ): Promise<VisualPipeline> {
    // Check if exists
    const existing = await this.repository.findByPipelineId(tenantId, pipelineId);
    if (existing.length > 0) {
      // Update first one
      return this.repository.update(tenantId, existing[0].id, { layout, yamlDefinition, name }) as Promise<VisualPipeline>;
    }
    // Create new
    return this.repository.create({
      tenantId,
      pipelineId,
      name,
      layout,
      yamlDefinition,
      createdBy,
    });
  }
}