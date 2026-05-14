import type { FastifyBaseLogger } from 'fastify';
import { Pool } from 'pg';
import type {
  ApiContract,
  ApiVersion,
  Deprecation,
  CompatibilityResult,
  ContractValidationResult,
  CreateContractInput,
  UpdateContractInput,
  CreateVersionInput,
  CreateDeprecationInput,
  CompatibilityCheckInput,
  PaginationParams,
  PaginatedResult,
  ContractStatus,
  VersionStatus,
  DeprecationStatus,
} from '../types/governance.js';
import { ContractService } from './ContractService.js';
import { VersioningService } from './VersioningService.js';
import { DeprecationService } from './DeprecationService.js';
import { CompatibilityService } from './CompatibilityService.js';

export class ApiGovernanceService {
  private contractSvc: ContractService;
  private versioningSvc: VersioningService;
  private deprecationSvc: DeprecationService;
  private compatibilitySvc: CompatibilityService;
  private logger: FastifyBaseLogger;

  constructor(pool: Pool, logger: FastifyBaseLogger) {
    this.contractSvc = new ContractService(pool);
    this.versioningSvc = new VersioningService(pool);
    this.deprecationSvc = new DeprecationService(pool);
    this.compatibilitySvc = new CompatibilityService(pool);
    this.logger = logger;
  }

  // Contract operations
  async createContract(input: CreateContractInput): Promise<ApiContract> {
    this.logger.info({ apiName: input.apiName, version: input.version }, 'Creating new API contract');
    return this.contractSvc.create(input);
  }

  async getContract(id: string): Promise<ApiContract> {
    const contract = await this.contractSvc.findById(id);
    if (!contract) throw new Error(`Contract ${id} not found`);
    return contract;
  }

  async listContracts(params: PaginationParams, filters?: { status?: ContractStatus; ownerId?: string }): Promise<PaginatedResult<ApiContract>> {
    return this.contractSvc.findAll(params, filters);
  }

  async updateContract(id: string, input: UpdateContractInput): Promise<ApiContract> {
    const contract = await this.contractSvc.update(id, input);
    if (!contract) throw new Error(`Contract ${id} not found`);
    return contract;
  }

  async deleteContract(id: string): Promise<void> {
    const deleted = await this.contractSvc.delete(id);
    if (!deleted) throw new Error(`Contract ${id} not found`);
  }

  async validateContract(id: string): Promise<ContractValidationResult> {
    return this.contractSvc.validate(id);
  }

  // Version operations
  async createVersion(input: CreateVersionInput): Promise<ApiVersion> {
    return this.versioningSvc.create(input);
  }

  async getVersion(id: string): Promise<ApiVersion> {
    const version = await this.versioningSvc.findById(id);
    if (!version) throw new Error(`Version ${id} not found`);
    return version;
  }

  async listVersions(params: PaginationParams, filters?: { contractId?: string; status?: VersionStatus }): Promise<PaginatedResult<ApiVersion>> {
    return this.versioningSvc.findAll(params, filters);
  }

  async updateVersion(id: string, updates: { status?: VersionStatus; changelog?: string; migrationGuide?: string }): Promise<ApiVersion> {
    const version = await this.versioningSvc.update(id, updates);
    if (!version) throw new Error(`Version ${id} not found`);
    return version;
  }

  async deleteVersion(id: string): Promise<void> {
    const deleted = await this.versioningSvc.delete(id);
    if (!deleted) throw new Error(`Version ${id} not found`);
  }

  // Deprecation operations
  async createDeprecation(input: CreateDeprecationInput): Promise<Deprecation> {
    return this.deprecationSvc.create(input);
  }

  async getDeprecation(id: string): Promise<Deprecation> {
    const deprecation = await this.deprecationSvc.findById(id);
    if (!deprecation) throw new Error(`Deprecation ${id} not found`);
    return deprecation;
  }

  async listDeprecations(params: PaginationParams, filters?: { contractId?: string; status?: DeprecationStatus }): Promise<PaginatedResult<Deprecation>> {
    return this.deprecationSvc.findAll(params, filters);
  }

  async updateDeprecationStatus(id: string, status: DeprecationStatus): Promise<Deprecation> {
    const deprecation = await this.deprecationSvc.updateStatus(id, status);
    if (!deprecation) throw new Error(`Deprecation ${id} not found`);
    return deprecation;
  }

  async deleteDeprecation(id: string): Promise<void> {
    const deleted = await this.deprecationSvc.delete(id);
    if (!deleted) throw new Error(`Deprecation ${id} not found`);
  }

  // Compatibility operations
  async checkCompatibility(input: CompatibilityCheckInput): Promise<CompatibilityResult> {
    return this.compatibilitySvc.check(input.sourceContractId, input.targetContractId);
  }
}
