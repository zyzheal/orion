/**
 * ScriptVersion - Script content version tracking
 *
 * Tracks script content versions with diff comparison.
 * Mirrors NeatLogic's script version management pattern.
 *
 * P3 feature from neatlogic-autoexec comparison analysis.
 */

export interface ScriptVersion {
  id: string;
  tenantId: string;
  scriptId: string;
  version: string;
  content: string;
  contentHash: string;
  parameters: Record<string, unknown>;
  changeDescription?: string;
  createdBy: string;
  createdAt: Date;
}

export interface CreateScriptVersion {
  tenantId: string;
  scriptId: string;
  version: string;
  content: string;
  parameters?: Record<string, unknown>;
  changeDescription?: string;
  createdBy: string;
}

export interface ScriptVersionEntity {
  id: string;
  tenant_id: string;
  script_id: string;
  version: string;
  content: string;
  content_hash: string;
  parameters: Record<string, unknown>;
  change_description?: string;
  created_by: string;
  created_at: Date;
}

export interface ScriptVersionFilter {
  tenantId: string;
  scriptId?: string;
  version?: string;
  createdBy?: string;
}

export interface ScriptVersionDiff {
  added: string[];
  removed: string[];
  modified: string[];
  unchanged: string[];
  summary: string;
}
