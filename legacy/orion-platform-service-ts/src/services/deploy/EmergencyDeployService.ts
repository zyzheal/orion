/**
 * EmergencyDeployService - Business logic for Emergency Deployments
 *
 * Handles emergency deploy requests, approvals, completion with post-mortem,
 * and emergency listing.
 */

import {
  EmergencyDeployRepository,
  DeployEmergency,
  CreateEmergencyDeployInput,
} from './EmergencyDeployRepository';
import { DeployRepository } from './DeployRepository';

export interface ListEmergencyOptions {
  page?: number;
  limit?: number;
  tenantId?: string;
  status?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class EmergencyDeployServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'EmergencyDeployServiceError';
  }
}

export class EmergencyDeployService {
  private repository: EmergencyDeployRepository;
  private deployRepository: DeployRepository | null;

  constructor(
    repository: EmergencyDeployRepository,
    deployRepository?: DeployRepository
  ) {
    this.repository = repository;
    this.deployRepository = deployRepository || null;
  }

  // ==================== Emergency Deploy Lifecycle ====================

  /**
   * Request an emergency deployment
   */
  async requestEmergencyDeploy(
    tenantId: string,
    deploymentId: string,
    reason: string,
    requestedBy: string
  ): Promise<DeployEmergency> {
    if (!reason || reason.trim().length === 0) {
      throw new EmergencyDeployServiceError(
        'Reason is required for emergency deployment',
        'MISSING_REASON'
      );
    }

    if (!requestedBy || requestedBy.trim().length === 0) {
      throw new EmergencyDeployServiceError(
        'RequestedBy is required',
        'MISSING_REQUESTED_BY'
      );
    }

    // Verify deployment exists and belongs to tenant
    if (this.deployRepository) {
      const deployment = await this.deployRepository.findById(deploymentId);
      if (!deployment) {
        throw new EmergencyDeployServiceError(
          `Deployment not found: ${deploymentId}`,
          'DEPLOY_NOT_FOUND'
        );
      }

      if (deployment.tenant_id !== tenantId) {
        throw new EmergencyDeployServiceError(
          'Deployment does not belong to this tenant',
          'TENANT_MISMATCH'
        );
      }
    }

    return this.repository.create({
      tenant_id: tenantId,
      deployment_id: deploymentId,
      reason: reason.trim(),
      requested_by: requestedBy.trim(),
    });
  }

  /**
   * Approve an emergency deployment
   */
  async approveEmergencyDeploy(
    tenantId: string,
    emergencyId: string,
    approvedBy: string
  ): Promise<DeployEmergency> {
    const emergency = await this.repository.findById(emergencyId);
    if (!emergency) {
      throw new EmergencyDeployServiceError(
        `Emergency deployment not found: ${emergencyId}`,
        'EMERGENCY_NOT_FOUND'
      );
    }

    if (emergency.tenant_id !== tenantId) {
      throw new EmergencyDeployServiceError(
        'Emergency deployment does not belong to this tenant',
        'TENANT_MISMATCH'
      );
    }

    if (emergency.status !== 'pending') {
      throw new EmergencyDeployServiceError(
        `Emergency deployment is not pending (current status: ${emergency.status})`,
        'INVALID_STATUS'
      );
    }

    const approved = await this.repository.approve(emergencyId, approvedBy);
    if (!approved) {
      throw new EmergencyDeployServiceError(
        'Failed to approve emergency deployment',
        'APPROVE_ERROR'
      );
    }

    return approved;
  }

  /**
   * Complete an emergency deployment with optional post-mortem
   */
  async completeEmergencyDeploy(
    tenantId: string,
    emergencyId: string,
    postMortem?: string
  ): Promise<DeployEmergency> {
    const emergency = await this.repository.findById(emergencyId);
    if (!emergency) {
      throw new EmergencyDeployServiceError(
        `Emergency deployment not found: ${emergencyId}`,
        'EMERGENCY_NOT_FOUND'
      );
    }

    if (emergency.tenant_id !== tenantId) {
      throw new EmergencyDeployServiceError(
        'Emergency deployment does not belong to this tenant',
        'TENANT_MISMATCH'
      );
    }

    if (emergency.status !== 'approved') {
      throw new EmergencyDeployServiceError(
        `Emergency deployment is not approved (current status: ${emergency.status})`,
        'INVALID_STATUS'
      );
    }

    const completed = await this.repository.complete(emergencyId, postMortem);
    if (!completed) {
      throw new EmergencyDeployServiceError(
        'Failed to complete emergency deployment',
        'COMPLETE_ERROR'
      );
    }

    return completed;
  }

  /**
   * Reject an emergency deployment
   */
  async rejectEmergencyDeploy(
    tenantId: string,
    emergencyId: string
  ): Promise<DeployEmergency> {
    const emergency = await this.repository.findById(emergencyId);
    if (!emergency) {
      throw new EmergencyDeployServiceError(
        `Emergency deployment not found: ${emergencyId}`,
        'EMERGENCY_NOT_FOUND'
      );
    }

    if (emergency.tenant_id !== tenantId) {
      throw new EmergencyDeployServiceError(
        'Emergency deployment does not belong to this tenant',
        'TENANT_MISMATCH'
      );
    }

    if (emergency.status !== 'pending') {
      throw new EmergencyDeployServiceError(
        `Emergency deployment is not pending (current status: ${emergency.status})`,
        'INVALID_STATUS'
      );
    }

    const rejected = await this.repository.reject(emergencyId);
    if (!rejected) {
      throw new EmergencyDeployServiceError(
        'Failed to reject emergency deployment',
        'REJECT_ERROR'
      );
    }

    return rejected;
  }

  // ==================== Listing ====================

  /**
   * Get emergency deployments with optional status filter
   */
  async getEmergencies(options: ListEmergencyOptions = {}): Promise<PaginatedResult<DeployEmergency>> {
    const { page = 1, limit = 20, tenantId, status } = options;
    const offset = (page - 1) * limit;

    const [emergencies, total] = await Promise.all([
      this.repository.findAll({ tenantId, status, limit, offset }),
      this.repository.count({ tenantId, status }),
    ]);

    return {
      data: emergencies,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get emergency deployment by ID
   */
  async getEmergency(tenantId: string, emergencyId: string): Promise<DeployEmergency> {
    const emergency = await this.repository.findById(emergencyId);
    if (!emergency) {
      throw new EmergencyDeployServiceError(
        `Emergency deployment not found: ${emergencyId}`,
        'EMERGENCY_NOT_FOUND'
      );
    }

    if (emergency.tenant_id !== tenantId) {
      throw new EmergencyDeployServiceError(
        'Emergency deployment does not belong to this tenant',
        'TENANT_MISMATCH'
      );
    }

    return emergency;
  }
}
