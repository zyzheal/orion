/**
 * SbomGenerator - SBOM generation, export, and persistence
 *
 * Handles:
 * - CycloneDX v1.4 SBOM generation
 * - SBOM export and retrieval
 * - Artifact signature persistence and verification
 * - Supply chain security report queries
 */

import { DatabasePool } from '../database';
import { OrionError, ErrorCode } from '../../errors';
import { createLogger } from '../../utils/logger';

import type {
  SBOMInput,
  CycloneDXComponent,
  CycloneDXSBOM,
} from './SbomService';
import {
  buildCycloneDXComponent,
  buildDependencyRelationships,
  buildCycloneDXSBOM,
  buildPURL,
  generateUUID,
} from './SbomCycloneDXUtils';

const logger = createLogger('sbom-generator');

// ==================== SbomGenerator ====================

export class SbomGenerator {
  constructor(private pool?: DatabasePool) {}

  // ==================== SBOM Generation ====================

  async generateSBOM(tenantId: string, input: SBOMInput, vulnerabilities: any[]): Promise<any> {
    if (!this.pool) {
      throw new OrionError('Database pool not initialized', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    logger.info({ tenantId, artifactId: input.artifactId, format: input.format }, '[SbomGenerator] Generating SBOM');

    const cyclonedxComponents = (input.components || []).map((comp: any) =>
      buildCycloneDXComponent(comp),
    );

    const dependencyRelationships = buildDependencyRelationships(
      input.components || [],
      input.dependencies || [],
    );

    const sbomDocument = buildCycloneDXSBOM(
      cyclonedxComponents,
      dependencyRelationships,
      vulnerabilities,
    );

    try {
      const result = await this.pool.query(
        `INSERT INTO supply_chain_sboms (tenant_id, artifact_id, pipeline_id, sbom_format, sbom_version, components, dependencies, vulnerabilities, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          tenantId,
          input.artifactId,
          input.pipelineId || null,
          input.format || 'cyclonedx',
          input.version || '1.4',
          JSON.stringify(cyclonedxComponents),
          JSON.stringify(dependencyRelationships),
          JSON.stringify(vulnerabilities),
          JSON.stringify({
            generatedAt: new Date().toISOString(),
            cyclonedxDocument: sbomDocument,
          }),
        ],
      );

      logger.info({ tenantId, sbomId: result.rows[0]?.id }, '[SbomGenerator] SBOM generated and persisted');
      return result.rows[0];
    } catch (error) {
      logger.error(
        { tenantId, artifactId: input.artifactId, err: error instanceof Error ? error.message : String(error) },
        '[SbomGenerator] Failed to persist SBOM',
      );
      throw new OrionError(
        'Failed to persist SBOM',
        ErrorCode.DATABASE_ERROR,
        true,
        { tenantId, artifactId: input.artifactId, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  // ==================== SBOM Export/Retrieval ====================

  async exportSBOM(sbomId: string, tenantId?: string): Promise<object | null> {
    if (!this.pool) {
      throw new OrionError('Database pool not initialized', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    try {
      const record = tenantId
        ? await this.pool.query(
            `SELECT * FROM supply_chain_sboms WHERE id = $1 AND tenant_id = $2`,
            [sbomId, tenantId],
          )
        : await this.pool.query(
            `SELECT * FROM supply_chain_sboms WHERE id = $1`,
            [sbomId],
          );

      if (record.rows.length === 0) {
        return null;
      }

      const row = record.rows[0];

      const components: CycloneDXComponent[] = typeof row.components === 'string'
        ? JSON.parse(row.components)
        : (row.components || []);

      const dependencies: { ref: string; dependsOn: string[] }[] = typeof row.dependencies === 'string'
        ? JSON.parse(row.dependencies)
        : (row.dependencies || []);

      const vulnerabilities: any[] = typeof row.vulnerabilities === 'string'
        ? JSON.parse(row.vulnerabilities)
        : (row.vulnerabilities || []);

      const topLevelComponent: CycloneDXComponent = {
        type: 'application',
        name: row.artifact_id || 'unknown',
        version: row.sbom_version || '1.4',
        purl: `pkg:generic/${encodeURIComponent(row.artifact_id || 'unknown')}@${row.sbom_version || '1.4'}`,
        'bom-ref': `pkg:artifact/${encodeURIComponent(row.artifact_id || 'unknown')}`,
      };

      const sbom: CycloneDXSBOM = {
        $schema: 'http://cyclonedx.org/schema/bom-1.4.schema.json',
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        serialNumber: `urn:uuid:${generateUUID()}`,
        version: 1,
        metadata: {
          timestamp: row.metadata?.generatedAt || new Date().toISOString(),
          tools: [
            {
              name: '@orion/platform-service',
              vendor: 'Orion',
              version: '1.0.0',
            },
          ],
          component: topLevelComponent,
        },
        components,
        dependencies,
      };

      if (vulnerabilities.length > 0) {
        sbom.vulnerabilities = vulnerabilities;
      }

      return sbom;
    } catch (error) {
      logger.error(
        { sbomId, tenantId, err: error instanceof Error ? error.message : String(error) },
        '[SbomGenerator] Failed to export SBOM',
      );
      throw new OrionError(
        'Failed to export SBOM',
        ErrorCode.DATABASE_ERROR,
        true,
        { sbomId, tenantId, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  async getSBOM(sbomId: string, tenantId?: string): Promise<any | null> {
    if (!this.pool) {
      throw new OrionError('Database pool not initialized', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    try {
      const result = tenantId
        ? await this.pool.query(
            `SELECT * FROM supply_chain_sboms WHERE id = $1 AND tenant_id = $2`,
            [sbomId, tenantId],
          )
        : await this.pool.query(
            `SELECT * FROM supply_chain_sboms WHERE id = $1`,
            [sbomId],
          );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(
        { sbomId, tenantId, err: error instanceof Error ? error.message : String(error) },
        '[SbomGenerator] Failed to get SBOM',
      );
      throw new OrionError(
        'Failed to retrieve SBOM',
        ErrorCode.DATABASE_ERROR,
        true,
        { sbomId, tenantId, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  // ==================== Artifact Signature ====================

  async persistArtifactSignature(
    tenantId: string,
    artifactId: string,
    signature: string,
    signedBy: string,
    signatureType = 'sha256',
  ): Promise<any> {
    if (!this.pool) {
      throw new OrionError('Database pool not initialized', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    try {
      const result = await this.pool.query(
        `INSERT INTO artifact_signatures (tenant_id, artifact_id, signature, signature_type, signed_by, verified)
         VALUES ($1, $2, $3, $4, $5, false) RETURNING *`,
        [tenantId, artifactId, signature, signatureType, signedBy],
      );
      return result.rows[0];
    } catch (error) {
      logger.error(
        { tenantId, artifactId, err: error instanceof Error ? error.message : String(error) },
        '[SbomGenerator] Failed to persist artifact signature',
      );
      throw new OrionError(
        'Failed to persist artifact signature',
        ErrorCode.DATABASE_ERROR,
        true,
        { tenantId, artifactId, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  async verifySignature(artifactId: string, signature: string): Promise<any> {
    if (!this.pool) {
      throw new OrionError('Database pool not initialized', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    try {
      const result = await this.pool.query(
        `SELECT * FROM artifact_signatures WHERE artifact_id = $1 AND signature = $2`,
        [artifactId, signature],
      );

      if (result.rows.length === 0) {
        logger.warn({ artifactId, signature }, '[SbomGenerator] Signature verification failed: not found');
        return { verified: false, reason: 'Signature not found' };
      }

      const existing = result.rows[0];
      await this.pool.query(
        `UPDATE artifact_signatures SET verified = true, verified_at = NOW() WHERE id = $1`,
        [existing.id],
      );

      logger.info({ artifactId, signedBy: existing.signed_by }, '[SbomGenerator] Signature verified');
      return { verified: true, signedBy: existing.signed_by, signedAt: existing.signed_at };
    } catch (error) {
      logger.error(
        { artifactId, err: error instanceof Error ? error.message : String(error) },
        '[SbomGenerator] Failed to verify signature',
      );
      throw new OrionError(
        'Failed to verify signature',
        ErrorCode.DATABASE_ERROR,
        true,
        { artifactId, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  // ==================== Supply Chain Report ====================

  async getSupplyChainReport(tenantId: string, pipelineId?: string): Promise<{
    totalSboms: number;
    totalSignatures: number;
    verifiedSignatures: number;
    totalVulnerabilities: number;
  }> {
    if (!this.pool) {
      throw new OrionError('Database pool not initialized', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    try {
      const sbomQuery = pipelineId
        ? `SELECT COUNT(*) as total_sboms FROM supply_chain_sboms WHERE tenant_id = $1 AND pipeline_id = $2`
        : `SELECT COUNT(*) as total_sboms FROM supply_chain_sboms WHERE tenant_id = $1`;
      const sbomParams = pipelineId ? [tenantId, pipelineId] : [tenantId];
      const sbomRows = await this.pool.query(sbomQuery, sbomParams);
      const totalSboms = parseInt(sbomRows.rows[0]?.total_sboms) || 0;

      const artifactId = pipelineId || '';
      const sigRows = await this.pool.query(
        `SELECT COUNT(*) as total_signatures, COUNT(*) FILTER (WHERE verified = true) as verified_count FROM artifact_signatures WHERE tenant_id = $1 AND artifact_id = $2`,
        [tenantId, artifactId],
      );
      const totalSignatures = parseInt(sigRows.rows[0]?.total_signatures) || 0;
      const verifiedSignatures = parseInt(sigRows.rows[0]?.verified_count) || 0;

      const vulnQuery = pipelineId
        ? `SELECT COUNT(*) as total_vulnerabilities FROM supply_chain_sboms WHERE tenant_id = $1 AND pipeline_id = $2 AND vulnerabilities IS NOT NULL`
        : `SELECT COUNT(*) as total_vulnerabilities FROM supply_chain_sboms WHERE tenant_id = $1 AND vulnerabilities IS NOT NULL`;
      const vulnParams = pipelineId ? [tenantId, pipelineId] : [tenantId];
      const vulnRows = await this.pool.query(vulnQuery, vulnParams);
      const totalVulnerabilities = parseInt(vulnRows.rows[0]?.total_vulnerabilities) || 0;

      return {
        totalSboms,
        totalSignatures,
        verifiedSignatures,
        totalVulnerabilities,
      };
    } catch (error) {
      logger.error(
        { tenantId, pipelineId, err: error instanceof Error ? error.message : String(error) },
        '[SbomGenerator] Failed to get supply chain report',
      );
      throw new OrionError(
        'Failed to retrieve supply chain report',
        ErrorCode.DATABASE_ERROR,
        true,
        { tenantId, pipelineId, originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }
}
