/**
 * SbomService-types - Additional type exports for SbomService
 *
 * CycloneDX types and SBOM input types that were previously
 * defined inline in SbomService.ts.
 */

// ==================== CycloneDX Types ====================

export interface CycloneDXComponent {
  type: 'library' | 'application' | 'framework' | 'container' | 'operating-system' | 'device' | 'file' | 'data';
  name: string;
  version: string;
  purl: string;
  'bom-ref': string;
  licenses?: { license: { id: string } }[];
  description?: string;
}

export interface CycloneDXSBOM {
  $schema: string;
  bomFormat: string;
  specVersion: string;
  serialNumber: string;
  version: number;
  metadata: {
    timestamp: string;
    tools: { name: string; vendor: string; version: string }[];
    component?: CycloneDXComponent;
  };
  components: CycloneDXComponent[];
  dependencies: { ref: string; dependsOn: string[] }[];
  vulnerabilities?: any[];
}

export interface SBOMInput {
  artifactId: string;
  pipelineId?: string;
  format?: string;
  version?: string;
  components: any[];
  dependencies?: any[];
}

export interface DependencyAnalysisInput {
  packageName: string;
  packageVersion: string;
  depth?: number;
}

// ==================== Dependency Poisoning Types ====================

export interface MaliciousPackageInfo {
  name: string;
  version?: string;
  reason: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cve?: string;
  firstReported: string;
}

export interface TyposquattingAlert {
  suspicious: string;
  legitimate: string;
  similarity: number;
  type: 'typosquatting' | 'homograph' | 'combo' | 'namespace-squat';
}

export interface DependencyPoisoningReport {
  maliciousPackages: { package: string; version: string; info: MaliciousPackageInfo }[];
  typosquattingAlerts: TyposquattingAlert[];
  riskScore: number;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  totalPackagesScanned: number;
  scanTimestamp: string;
}
