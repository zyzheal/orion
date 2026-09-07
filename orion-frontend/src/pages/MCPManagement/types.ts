/**
 * MCP Management types
 * 抽取自 index.tsx (P2-9 Phase 147)
 */

export interface MCPService {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MCPTool {
  id: string;
  server_id: string;
  name: string;
  params?: string;
  created_at?: string;
}

export interface MCPServiceFormValues {
  name: string;
  url: string;
  enabled: boolean;
}

export interface ListServersResponse {
  servers: MCPService[];
  total: number;
}

export interface ListToolsResponse {
  tools: MCPTool[];
  total: number;
}
