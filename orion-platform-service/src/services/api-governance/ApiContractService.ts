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

export class ApiContractService {
  private contracts = new Map<string, ApiContract>();
  private violations = new Map<string, ContractViolation[]>();

  async registerContract(
    tenantId: string,
    input: RegisterContractInput,
  ): Promise<ApiContract> {
    const now = new Date().toISOString();
    const contract: ApiContract = {
      id: randomUUID(),
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
    this.contracts.set(contract.id, contract);
    this.violations.set(contract.id, []);
    return contract;
  }

  async evaluateContract(
    contractId: string,
    apiDefinition: Record<string, unknown>,
  ): Promise<ContractEvaluationResult> {
    const contract = this.contracts.get(contractId);
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

    this.violations.set(contractId, violations);

    return {
      compliant: violations.length === 0,
      violations,
      score: Math.max(0, score),
      evaluatedAt: new Date().toISOString(),
    };
  }

  async getContractViolations(contractId: string): Promise<ContractViolation[]> {
    return this.violations.get(contractId) ?? [];
  }

  async getContract(contractId: string): Promise<ApiContract | null> {
    return this.contracts.get(contractId) ?? null;
  }

  async listContracts(tenantId: string): Promise<ApiContract[]> {
    return Array.from(this.contracts.values()).filter((c) => c.tenantId === tenantId);
  }

  async updateContract(
    contractId: string,
    input: Partial<RegisterContractInput>,
  ): Promise<ApiContract | null> {
    const contract = this.contracts.get(contractId);
    if (!contract) return null;

    if (input.name) contract.name = input.name;
    if (input.description !== undefined) contract.description = input.description;
    if (input.endpoint) contract.endpoint = input.endpoint;
    if (input.method) contract.method = input.method;
    if (input.schema) contract.schema = input.schema;
    if (input.version) contract.version = input.version;
    contract.updatedAt = new Date().toISOString();

    return contract;
  }

  async deleteContract(contractId: string): Promise<boolean> {
    this.violations.delete(contractId);
    return this.contracts.delete(contractId);
  }
}
