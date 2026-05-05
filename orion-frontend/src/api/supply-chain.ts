/**
 * Supply Chain Security API
 * Phase 3 - SBOM generation, dependency analysis, artifact signing
 */
import apiClient from './client';

export interface SBOM {
  id: string;
  pipelineId: string;
  format: 'spdx' | 'cyclonedx';
  components: SBOMComponent[];
  generatedAt: string;
}

export interface SBOMComponent {
  name: string;
  version: string;
  type: 'library' | 'framework' | 'os';
  license?: string;
  vulnerabilities?: { id: string; severity: string }[];
}

export interface DependencyGraph {
  packageName: string;
  version: string;
  dependencies: DependencyNode[];
}

export interface DependencyNode {
  name: string;
  version: string;
  direct: boolean;
}

export interface SupplyChainReport {
  pipelineId: string;
  sbomId?: string;
  signatureStatus: 'signed' | 'unsigned' | 'verified' | 'failed';
  dependencyRisk: 'low' | 'medium' | 'high' | 'critical';
  vulnerabilities: number;
  generatedAt: string;
}

export const supplyChainApi = {
  generateSBOM: async (data: { pipelineId: string; format?: 'spdx' | 'cyclonedx' }) => {
    const response = await apiClient.post('/api/v1/supply-chain/sbom', data);
    return response.data as SBOM;
  },

  getSBOM: async (sbomId: string) => {
    const response = await apiClient.get(`/api/v1/supply-chain/sbom/${sbomId}`);
    return response.data as SBOM;
  },

  analyzeDependencies: async (packageName: string, version: string) => {
    const response = await apiClient.get(`/api/v1/supply-chain/dependencies/${packageName}/${version}/analyze`);
    return response.data;
  },

  getDependencyGraph: async (data: { packageName: string; version: string }) => {
    const response = await apiClient.post('/api/v1/supply-chain/dependencies/graph', data);
    return response.data as DependencyGraph;
  },

  signArtifact: async (artifactId: string) => {
    const response = await apiClient.post(`/api/v1/supply-chain/artifacts/${artifactId}/sign`);
    return response.data;
  },

  verifySignature: async (artifactId: string) => {
    const response = await apiClient.post(`/api/v1/supply-chain/artifacts/${artifactId}/verify`);
    return response.data;
  },

  getSupplyChainReport: async (pipelineId: string) => {
    const response = await apiClient.get(`/api/v1/supply-chain/reports/${pipelineId}`);
    return response.data as SupplyChainReport;
  },
};

export default supplyChainApi;
