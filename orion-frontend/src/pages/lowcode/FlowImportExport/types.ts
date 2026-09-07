/**
 * FlowImportExport shared types
 * 抽取自 index.tsx (P2-9 Phase 138)
 */

export interface ExportFormat {
  schemaVersion: string;
  exportedAt: string;
  type: string;
  definition: {
    name: string;
    description?: string;
    version: string;
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
    config?: Record<string, unknown>;
  };
  versionHistory: Array<{
    version: string;
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
    commitMessage?: string;
    createdBy: string;
    createdAt: string;
  }>;
}

export interface ImportPreview {
  name: string;
  description?: string;
  version?: string;
  nodeCount: number;
  edgeCount: number;
  exportedAt?: string;
  versionHistoryLength?: number;
}

export interface ValidateResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ImportResult {
  success: boolean;
  message?: string;
}

export interface ValidateInput {
  name: string;
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  version?: string;
}
