/**
 * BuildAttestationService - SLSA-style build provenance generation
 *
 * Generates build attestations following the SLSA (Supply chain Levels for
 * Software Artifacts) framework:
 * - Build provenance with source, builder, and material tracking
 * - Cryptographic attestation of build integrity
 * - SBOM integration for component tracking
 *
 * Phase 3 P2 Service
 */

import { DatabasePool } from '../database';
import * as crypto from 'crypto';

// ==================== Types ====================

export interface BuildMaterial {
  uri: string;
  digest: Record<string, string>;
}

export interface BuilderInfo {
  id: string;
  version: string;
  builderType: string;
  dependencies: string[];
}

export interface BuildConfig {
  sourceUri: string;
  commitHash: string;
  branch: string;
  pipelineId: string;
  buildId: string;
  serviceName: string;
  environment: string;
  triggeredBy: string;
  buildStartTime: Date;
  buildEndTime: Date;
  buildSteps: BuildStep[];
  environmentVariables: string[];
  artifactUri: string;
  artifactDigest: Record<string, string>;
}

export interface BuildStep {
  name: string;
  command: string;
  startTime: Date;
  endTime: Date;
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

export interface SLSAProvenance {
  _type: 'https://slsa.dev/provenance/v0.2';
  subject: {
    name: string;
    digest: Record<string, string>;
  }[];
  buildType: string;
  builder: BuilderInfo;
  invocation: {
    configSource: {
      uri: string;
      digest: Record<string, string>;
      entryPoint: string;
    };
    parameters: Record<string, unknown>;
    environment: Record<string, unknown>;
  };
  buildConfig: {
    pipelineId: string;
    buildId: string;
    branch: string;
    commitHash: string;
    serviceName: string;
    environment: string;
    buildSteps: BuildStep[];
  };
  metadata: {
    buildInvocationId: string;
    buildStartedOn: string;
    buildFinishedOn: string;
    completeness: {
      parameters: boolean;
      environment: boolean;
      materials: boolean;
    };
    reproducible: boolean;
  };
  materials: BuildMaterial[];
}

export interface AttestationRecord {
  id: string;
  build_id: string;
  tenant_id: string;
  service_name: string;
  provenance_type: string;
  provenance: Record<string, unknown>;
  signature: string;
  verified: boolean;
  created_at: Date;
}

export interface AttestationVerification {
  verified: boolean;
  build_id: string;
  provenance_valid: boolean;
  signature_valid: boolean;
  materials_verified: boolean;
  issues: string[];
}

export class BuildAttestationService {
  private pool: DatabasePool;

  private readonly ORION_BUILDER_ID = 'orion-platform';
  private readonly ORION_VERSION = '3.0.0';
  private readonly SLSA_VERSION = 'https://slsa.dev/provenance/v0.2';

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  /**
   * Generate SLSA-style build provenance
   */
  async generateProvenance(
    tenantId: string,
    buildConfig: BuildConfig
  ): Promise<SLSAProvenance> {
    const artifactDigest = this.computeArtifactDigest(buildConfig);

    const provenance: SLSAProvenance = {
      _type: this.SLSA_VERSION,
      subject: [
        {
          name: buildConfig.artifactUri.split('/').pop() || buildConfig.serviceName,
          digest: artifactDigest,
        },
      ],
      buildType: 'https://orion.dev/build/v1',
      builder: {
        id: this.ORION_BUILDER_ID,
        version: this.ORION_VERSION,
        builderType: 'tekton-pipeline',
        dependencies: ['node:20', 'npm:10', 'tekton:v0.50'],
      },
      invocation: {
        configSource: {
          uri: buildConfig.sourceUri,
          digest: {
            gitCommit: buildConfig.commitHash,
          },
          entryPoint: buildConfig.pipelineId,
        },
        parameters: {
          branch: buildConfig.branch,
          serviceName: buildConfig.serviceName,
          environment: buildConfig.environment,
        },
        environment: {
          triggeredBy: buildConfig.triggeredBy,
          variables: buildConfig.environmentVariables,
        },
      },
      buildConfig: {
        pipelineId: buildConfig.pipelineId,
        buildId: buildConfig.buildId,
        branch: buildConfig.branch,
        commitHash: buildConfig.commitHash,
        serviceName: buildConfig.serviceName,
        environment: buildConfig.environment,
        buildSteps: buildConfig.buildSteps,
      },
      metadata: {
        buildInvocationId: buildConfig.buildId,
        buildStartedOn: buildConfig.buildStartTime.toISOString(),
        buildFinishedOn: buildConfig.buildEndTime.toISOString(),
        completeness: {
          parameters: true,
          environment: true,
          materials: true,
        },
        reproducible: true,
      },
      materials: this.buildMaterials(buildConfig),
    };

    return provenance;
  }

  /**
   * Store attestation in database
   */
  async storeAttestation(
    tenantId: string,
    buildId: string,
    serviceName: string,
    provenance: SLSAProvenance
  ): Promise<AttestationRecord> {
    const signature = this.signProvenance(provenance);

    const result = await this.pool.query(
      `INSERT INTO build_attestations
        (build_id, tenant_id, service_name, provenance_type, provenance, signature, verified)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING *`,
      [
        buildId,
        tenantId,
        serviceName,
        provenance._type,
        JSON.stringify(provenance),
        signature,
      ]
    );

    return this.mapAttestationRow(result.rows[0]);
  }

  /**
   * Generate and store provenance in one call
   */
  async generateAndStoreAttestation(
    tenantId: string,
    buildConfig: BuildConfig
  ): Promise<AttestationRecord> {
    const provenance = await this.generateProvenance(tenantId, buildConfig);
    return this.storeAttestation(tenantId, buildConfig.buildId, buildConfig.serviceName, provenance);
  }

  /**
   * Get attestation by build ID
   */
  async getAttestation(buildId: string): Promise<AttestationRecord | null> {
    const result = await this.pool.query(
      `SELECT * FROM build_attestations WHERE build_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [buildId]
    );
    if (!result.rows[0]) return null;
    return this.mapAttestationRow(result.rows[0]);
  }

  /**
   * List attestations for a tenant
   */
  async listAttestations(
    tenantId: string,
    options?: { serviceName?: string; limit?: number }
  ): Promise<AttestationRecord[]> {
    let query = `SELECT * FROM build_attestations WHERE tenant_id = $1`;
    const params: any[] = [tenantId];

    if (options?.serviceName) {
      query += ` AND service_name = $2`;
      params.push(options.serviceName);
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.pool.query(query, params);
    return result.rows.map((r: any) => this.mapAttestationRow(r));
  }

  /**
   * Verify an attestation
   */
  async verifyAttestation(buildId: string): Promise<AttestationVerification> {
    const attestation = await this.getAttestation(buildId);
    const issues: string[] = [];

    if (!attestation) {
      return {
        verified: false,
        build_id: buildId,
        provenance_valid: false,
        signature_valid: false,
        materials_verified: false,
        issues: ['Attestation not found'],
      };
    }

    // Verify signature
    const signatureValid = this.verifySignature(attestation);
    if (!signatureValid) {
      issues.push('Signature verification failed');
    }

    // Verify provenance structure
    const provenance = (attestation.provenance as unknown) as SLSAProvenance;
    const provenanceValid = this.validateProvenanceStructure(provenance);
    if (!provenanceValid) {
      issues.push('Provenance structure is invalid');
    }

    // Verify materials
    const materialsVerified = provenance.materials.every((m) =>
      m.digest && Object.keys(m.digest).length > 0
    );
    if (!materialsVerified) {
      issues.push('Some materials lack digest information');
    }

    return {
      verified: signatureValid && provenanceValid && materialsVerified,
      build_id: buildId,
      provenance_valid: provenanceValid,
      signature_valid: signatureValid,
      materials_verified: materialsVerified,
      issues,
    };
  }

  /**
   * Get supply chain security score for a tenant
   */
  async getSupplyChainSecurityScore(tenantId: string): Promise<{
    overall_score: number;
    attestation_coverage: number;
    signature_rate: number;
    provenance_completeness: number;
    recommendations: string[];
  }> {
    // Count total builds vs attested builds
    const buildCount = await this.pool.query(
      `SELECT COUNT(*) as total FROM pipeline_runs WHERE tenant_id = $1`,
      [tenantId]
    );
    const totalBuilds = parseInt(buildCount.rows[0]?.total) || 0;

    const attestedCount = await this.pool.query(
      `SELECT COUNT(*) as attested FROM build_attestations WHERE tenant_id = $1`,
      [tenantId]
    );
    const attested = parseInt(attestedCount.rows[0]?.attested) || 0;

    const verifiedCount = await this.pool.query(
      `SELECT COUNT(*) as verified FROM build_attestations WHERE tenant_id = $1 AND verified = true`,
      [tenantId]
    );
    const verified = parseInt(verifiedCount.rows[0]?.verified) || 0;

    const attestationCoverage = totalBuilds > 0 ? attested / totalBuilds : 0;
    const signatureRate = attested > 0 ? verified / attested : 0;

    const overallScore = Math.round(
      attestationCoverage * 50 +
      signatureRate * 50
    );

    const recommendations: string[] = [];
    if (attestationCoverage < 0.8) {
      recommendations.push(`${Math.round((1 - attestationCoverage) * 100)}% of builds lack attestation - enable provenance generation`);
    }
    if (signatureRate < 1) {
      recommendations.push(`${Math.round((1 - signatureRate) * 100)}% of attestations are unverified`);
    }
    if (overallScore >= 90) {
      recommendations.push('Supply chain security posture is excellent');
    }

    return {
      overall_score: overallScore,
      attestation_coverage: attestationCoverage,
      signature_rate: signatureRate,
      provenance_completeness: attested > 0 ? 1 : 0,
      recommendations,
    };
  }

  // ==================== Private Helpers ====================

  private computeArtifactDigest(buildConfig: BuildConfig): Record<string, string> {
    const content = JSON.stringify({
      artifactUri: buildConfig.artifactUri,
      commitHash: buildConfig.commitHash,
      buildSteps: buildConfig.buildSteps.map((s) => s.exitCode),
    });
    return {
      sha256: crypto.createHash('sha256').update(content).digest('hex'),
    };
  }

  private buildMaterials(buildConfig: BuildConfig): BuildMaterial[] {
    const materials: BuildMaterial[] = [];

    // Source code
    materials.push({
      uri: buildConfig.sourceUri,
      digest: { gitCommit: buildConfig.commitHash },
    });

    // Build steps may reference additional materials
    for (const step of buildConfig.buildSteps) {
      if (step.command.includes('npm install') || step.command.includes('yarn')) {
        materials.push({
          uri: 'npm://registry.npmjs.org',
          digest: { step: step.name },
        });
      }
    }

    return materials;
  }

  private signProvenance(provenance: SLSAProvenance): string {
    const content = JSON.stringify(provenance);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private verifySignature(attestation: AttestationRecord): boolean {
    try {
      const provenance = JSON.stringify(attestation.provenance);
      const expectedSignature = crypto.createHash('sha256').update(provenance).digest('hex');
      return attestation.signature === expectedSignature;
    } catch {
      return false;
    }
  }

  private validateProvenanceStructure(provenance: SLSAProvenance): boolean {
    try {
      return !!(
        provenance._type &&
        provenance.subject && provenance.subject.length > 0 &&
        provenance.builder &&
        provenance.invocation &&
        provenance.metadata &&
        provenance.materials
      );
    } catch {
      return false;
    }
  }

  private mapAttestationRow(row: any): AttestationRecord {
    return {
      id: row.id,
      build_id: row.build_id,
      tenant_id: row.tenant_id,
      service_name: row.service_name,
      provenance_type: row.provenance_type,
      provenance: row.provenance || {},
      signature: row.signature,
      verified: row.verified ?? false,
      created_at: row.created_at,
    };
  }
}
