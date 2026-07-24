import { randomUUID } from 'crypto';

export interface ApiContract {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  endpoint: string;
  method: string;
  schema: Record<string, unknown>;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractViolation {
  id: string;
  contractId: string;
  violationType: 'schema_mismatch' | 'missing_field' | 'type_error' | 'deprecated_field';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: string;
  sampleData?: Record<string, unknown>;
}

export interface ContractEvaluationResult {
  compliant: boolean;
  violations: ContractViolation[];
  score: number;
  evaluatedAt: string;
}

export interface RegisterContractInput {
  name: string;
  description?: string;
  endpoint: string;
  method: string;
  schema: Record<string, unknown>;
  version?: string;
}

import {
  ApiContractRepository,
  ApiContractViolationRepository,
} from '../../repositories/ApiContractRepository';

export class ApiContractService {
  private contractRepository: ApiContractRepository | null = null;
  private violationRepository: ApiContractViolationRepository | null = null;

  constructor(
    private db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }
  ) {
    if (db) {
      this.contractRepository = new ApiContractRepository(db as any);
      this.violationRepository = new ApiContractViolationRepository(db as any);
    }
  }

  async registerContract(
    tenantId: string,
    input: RegisterContractInput,
  ): Promise<ApiContract> {
    const now = new Date().toISOString();
    const id = randomUUID();

    if (this.contractRepository) {
      const entity = await this.contractRepository.createContract({
        id,
        tenantId,
        name: input.name,
        description: input.description,
        endpoint: input.endpoint,
        method: input.method,
        schema: input.schema,
        version: input.version,
      });

      return {
        id: entity.id,
        tenantId: entity.tenantId,
        name: entity.name,
        description: entity.description || undefined,
        endpoint: entity.endpoint,
        method: entity.method,
        schema: entity.schema,
        version: entity.version,
        createdAt: entity.createdAt.toISOString(),
        updatedAt: entity.updatedAt.toISOString(),
      };
    }

    // Fallback to in-memory if no DB
    const contract: ApiContract = {
      id,
      tenantId,
      name: input.name,
      description: input.description,
      endpoint: input.endpoint,
      method: input.method,
      schema: input.schema,
      version: input.version ?? '1.0.0',
      createdAt: now,
      updatedAt: now,
    };
    return contract;
  }

  async evaluateContract(
    contractId: string,
    apiDefinition: Record<string, unknown>,
  ): Promise<ContractEvaluationResult> {
    let contract: ApiContract | null = null;

    if (this.contractRepository) {
      const entity = await this.contractRepository.findById(contractId);
      if (entity) {
        contract = {
          id: entity.id,
          tenantId: entity.tenantId,
          name: entity.name,
          description: entity.description || undefined,
          endpoint: entity.endpoint,
          method: entity.method,
          schema: entity.schema,
          version: entity.version,
          createdAt: entity.createdAt.toISOString(),
          updatedAt: entity.updatedAt.toISOString(),
        };
      }
    }

    if (!contract) {
      return {
        compliant: false,
        violations: [{
          id: randomUUID(),
          contractId,
          violationType: 'schema_mismatch',
          description: 'Contract not found',
          severity: 'critical',
          detectedAt: new Date().toISOString(),
        }],
        score: 0,
        evaluatedAt: new Date().toISOString(),
      };
    }

    const violations: ContractViolation[] = [];
    const contractSchema = contract.schema;

    for (const [key, expectedType] of Object.entries(contractSchema)) {
      const actualValue = (apiDefinition as Record<string, unknown>)[key];
      if (actualValue === undefined) {
        violations.push({
          id: randomUUID(),
          contractId,
          violationType: 'missing_field',
          description: `Missing required field: ${key}`,
          severity: 'high',
          detectedAt: new Date().toISOString(),
        });
      } else if (typeof actualValue !== typeof expectedType) {
        violations.push({
          id: randomUUID(),
          contractId,
          violationType: 'type_error',
          description: `Type mismatch for field: ${key}`,
          severity: 'medium',
          detectedAt: new Date().toISOString(),
          sampleData: { actual: typeof actualValue, expected: typeof expectedType },
        });
      }
    }

    const totalChecks = Object.keys(contractSchema).length;
    const score = totalChecks > 0
      ? Math.round(((totalChecks - violations.length) / totalChecks) * 100)
      : 100;

    // Persist violations to DB if available
    if (this.violationRepository) {
      // Clear old violations and add new ones
      await this.violationRepository.deleteByContract(contractId);
      for (const violation of violations) {
        await this.violationRepository.createViolation({
          id: violation.id,
          contractId: violation.contractId,
          violationType: violation.violationType,
          description: violation.description,
          severity: violation.severity,
          sampleData: violation.sampleData || null,
        });
      }
    }

    return {
      compliant: violations.length === 0,
      violations,
      score: Math.max(0, score),
      evaluatedAt: new Date().toISOString(),
    };
  }

  async getContractViolations(contractId: string): Promise<ContractViolation[]> {
    if (!this.violationRepository) return [];

    const entities = await this.violationRepository.findByContract(contractId);
    return entities.map(entity => ({
      id: entity.id,
      contractId: entity.contractId,
      violationType: entity.violationType as ContractViolation['violationType'],
      description: entity.description,
      severity: entity.severity as ContractViolation['severity'],
      detectedAt: entity.detectedAt.toISOString(),
      sampleData: entity.sampleData || undefined,
    }));
  }

  async getContract(contractId: string): Promise<ApiContract | null> {
    if (!this.contractRepository) return null;

    const entity = await this.contractRepository.findById(contractId);
    if (!entity) return null;

    return {
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      description: entity.description || undefined,
      endpoint: entity.endpoint,
      method: entity.method,
      schema: entity.schema,
      version: entity.version,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  async listContracts(tenantId: string): Promise<ApiContract[]> {
    if (!this.contractRepository) return [];

    const entities = await this.contractRepository.findByTenant(tenantId);
    return entities.map(entity => ({
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      description: entity.description || undefined,
      endpoint: entity.endpoint,
      method: entity.method,
      schema: entity.schema,
      version: entity.version,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    }));
  }

  async updateContract(
    contractId: string,
    input: Partial<RegisterContractInput>,
  ): Promise<ApiContract | null> {
    if (!this.contractRepository) return null;

    const entity = await this.contractRepository.updateContract(contractId, {
      name: input.name,
      description: input.description,
      endpoint: input.endpoint,
      method: input.method,
      schema: input.schema,
      version: input.version,
    });

    if (!entity) return null;

    return {
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      description: entity.description || undefined,
      endpoint: entity.endpoint,
      method: entity.method,
      schema: entity.schema,
      version: entity.version,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  async deleteContract(contractId: string): Promise<boolean> {
    if (!this.contractRepository) return false;

    if (this.violationRepository) {
      await this.violationRepository.deleteByContract(contractId);
    }

    return this.contractRepository.deleteContract(contractId);
  }
}