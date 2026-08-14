/**
 * Low-Code Designer API Service
 * /api/v1/lowcode — Forms / Fields / Templates / Instances / Components / Flows
 *
 * 后端模块：
 * - internal/lowcode-designer: Forms/Fields/Templates/Instances/Components
 * - internal/lowcode: Flows/WorkflowVersions/ImportExport
 */
import { api } from './client';

export interface FormDefinition {
  id: string;
  tenantId: string;
  name: string;
  title: string;
  description: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  category: string;
  moduleName: string;
  tags?: string[];
  layout?: Record<string, unknown>;
  fields?: FormField[];
  meta?: Record<string, unknown>;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FormField {
  id: string;
  formId: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  visible: boolean;
  disabled: boolean;
  placeholder: string;
  defaultVal?: unknown;
  options?: unknown[];
  rules?: unknown[];
  meta?: Record<string, unknown>;
  sortableIndex: number;
  parentKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  isBuiltin: boolean;
  formSchema?: Record<string, unknown>;
  previewUrl: string;
  usageCount: number;
  createdAt: string;
}

export interface FormInstance {
  id: string;
  formId: string;
  data?: Record<string, unknown>;
  status: string;
  submittedBy: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface ComponentRegistry {
  id: string;
  name: string;
  displayName: string;
  category: string;
  version: string;
  propsSchema?: Record<string, unknown>;
  defaultConfig?: Record<string, unknown>;
  icon: string;
  isBuiltin: boolean;
  createdAt: string;
}

// --- LowcodeFlow (internal/lowcode backend) ---

export interface LowcodeFlow {
  id: string;
  name: string;
  description?: string;
  version: string;
  enabled?: boolean;
  nodes?: string;
  edges?: string;
  nodeCount?: number;
  edgesCount?: number;
  tags?: string[];
  category?: string;
  status?: 'draft' | 'published' | 'archived';
  // backend snake_case fields
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  // camelCase aliases for frontend pages
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  // used by FlowDesigner detail modal
  nodeDef?: unknown[];
  edgeDef?: unknown[];
}

export interface LowcodeFlowInstance {
  id: string;
  workflowId: string;
  status: string;
  input?: string;
  output?: string;
  triggeredBy?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface LowcodeWorkflowVersion {
  id: string;
  workflowId: string;
  version: string;
  definition?: string;
  changeLog?: string;
  createdBy?: string;
  createdAt: string;
}

export interface VersionSnapshot {
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
}

export interface LowcodeFlowVersion {
  id: string;
  workflowId: string;
  version: string;
  definition?: string;
  changeLog?: string;
  snapshot?: VersionSnapshot;
  createdBy?: string;
  createdAt: string;
}

export interface LowcodeTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  thumbnail?: string;
  definition?: string;
  tags?: string;
  usageCount?: number;
  createdBy?: string;
  createdAt: string;
}

// --- Forms (lowcode-designer) ---

export const listForms = async (category?: string, status?: string): Promise<FormDefinition[]> => {
  const params: Record<string, string> = {};
  if (category) params.category = category;
  if (status) params.status = status;
  const res = await api.get('/api/v1/lowcode-designer/forms', { params });
  return res.data as FormDefinition[];
};

export const getForm = async (id: string): Promise<FormDefinition> => {
  const res = await api.get(`/api/v1/lowcode-designer/forms/${id}`);
  return res.data as FormDefinition;
};

export const createForm = async (data: Partial<FormDefinition> & { name: string; fields?: FormField[] }): Promise<FormDefinition> => {
  const res = await api.post('/api/v1/lowcode-designer/forms', data);
  return res.data as FormDefinition;
};

export const updateForm = async (id: string, data: Partial<FormDefinition>): Promise<FormDefinition> => {
  const res = await api.put(`/api/v1/lowcode-designer/forms/${id}`, data);
  return res.data as FormDefinition;
};

export const deleteForm = async (id: string) => {
  const res = await api.delete(`/api/v1/lowcode-designer/forms/${id}`);
  return res.data;
};

// --- Fields (lowcode-designer) ---

export const createField = async (formId: string, data: Partial<FormField> & { key: string; label: string; type: string }): Promise<FormField> => {
  const res = await api.post(`/api/v1/lowcode-designer/forms/${formId}/fields`, data);
  return res.data as FormField;
};

export const getFieldsByForm = async (formId: string): Promise<FormField[]> => {
  const res = await api.get(`/api/v1/lowcode-designer/forms/${formId}/fields`);
  return res.data as FormField[];
};

export const updateField = async (id: string, data: Partial<FormField>): Promise<FormField> => {
  const res = await api.put(`/api/v1/lowcode-designer/fields/${id}`, data);
  return res.data as FormField;
};

export const deleteField = async (id: string) => {
  const res = await api.delete(`/api/v1/lowcode-designer/fields/${id}`);
  return res.data;
};

// --- Templates (lowcode-designer) ---

// Flow templates (internal/lowcode) — for TemplateMarket
export const listTemplates = async (category?: string): Promise<LowcodeTemplate[]> => {
  const params: Record<string, string> = {};
  if (category) params.category = category;
  const res = await api.get('/api/v1/lowcode/templates', { params });
  return res.data as LowcodeTemplate[];
};

export const getTemplate = async (id: string): Promise<LowcodeTemplate> => {
  const res = await api.get(`/api/v1/lowcode/templates/${id}`);
  return res.data as LowcodeTemplate;
};

export const createTemplate = async (data: { name: string; description?: string; category?: string; schema?: Record<string, unknown>; tags?: string[] }) => {
  const res = await api.post('/api/v1/lowcode/templates', data);
  return res.data;
};

// --- Form Templates (lowcode-designer) ---

export const listFormTemplates = async (category?: string): Promise<FormTemplate[]> => {
  const params: Record<string, string> = {};
  if (category) params.category = category;
  const res = await api.get('/api/v1/lowcode-designer/templates', { params });
  return res.data as FormTemplate[];
};

export const getFormTemplate = async (id: string): Promise<FormTemplate> => {
  const res = await api.get(`/api/v1/lowcode-designer/templates/${id}`);
  return res.data as FormTemplate;
};

export const createFormTemplate = async (data: { name: string; description?: string; category?: string; schema?: Record<string, unknown>; tags?: string[] }) => {
  const res = await api.post('/api/v1/lowcode-designer/templates', data);
  return res.data;
};

// --- Instances (lowcode-designer) ---

export const submitInstance = async (formId: string, data: { data: Record<string, unknown>; submitBy: string }) => {
  const res = await api.post(`/api/v1/lowcode-designer/forms/${formId}/instances`, data);
  return res.data as FormInstance;
};

export const listInstances = async (formId?: string, status?: string): Promise<FormInstance[]> => {
  const params: Record<string, string> = {};
  if (formId) params.formId = formId;
  if (status) params.status = status;
  const res = await api.get('/api/v1/lowcode-designer/instances', { params });
  return res.data as FormInstance[];
};

export const getInstance = async (id: string): Promise<FormInstance> => {
  const res = await api.get(`/api/v1/lowcode-designer/instances/${id}`);
  return res.data as FormInstance;
};

export const approveInstance = async (id: string, action: 'approve' | 'reject', approver: string) => {
  const res = await api.post(`/api/v1/lowcode-designer/instances/${id}/approve`, { approver, action });
  return res.data;
};

// --- Components (lowcode-designer) ---

export const listComponents = async (category?: string): Promise<ComponentRegistry[]> => {
  const params: Record<string, string> = {};
  if (category) params.category = category;
  const res = await api.get('/api/v1/lowcode-designer/components', { params });
  return res.data as ComponentRegistry[];
};

export const getComponent = async (id: string): Promise<ComponentRegistry> => {
  const res = await api.get(`/api/v1/lowcode-designer/components/${id}`);
  return res.data as ComponentRegistry;
};

export const createComponent = async (data: {
  name: string;
  displayName: string;
  category?: string;
  version?: string;
  propsSchema: Record<string, unknown>;
  defaultConfig?: Record<string, unknown>;
  icon?: string;
}) => {
  const res = await api.post('/api/v1/lowcode-designer/components', data);
  return res.data;
};

export interface FlowGenerateRequest {
  prompt: string;
  workflowName?: string;
  description?: string;
}

export interface FlowGenerateResponse {
  name: string;
  description: string;
  nodes: string;
  edges: string;
  intent: string;
}

// --- Flows (internal/lowcode) ---

// Raw flow list fetch (wrapped by lowcodeApi.listFlows for computed fields)
export const fetchFlowsRaw = async () => {
  const res = await api.get('/api/v1/lowcode/flows');
  return res.data; // { data: LowcodeFlow[], total, page, page_size }
};

export const getFlow = async (id: string) => {
  const res = await api.get(`/api/v1/lowcode/flows/${id}`);
  return res.data as LowcodeFlow;
};

export const createFlow = async (data: {
  name: string;
  description?: string;
  type?: string;
  nodes?: string;
  edges?: string;
}) => {
  const res = await api.post('/api/v1/lowcode/flows', data);
  return res.data;
};

export const updateFlow = async (id: string, data: {
  name?: string;
  description?: string;
  nodes?: string;
  edges?: string;
  enabled?: boolean;
}) => {
  const res = await api.put(`/api/v1/lowcode/flows/${id}`, data);
  return res.data;
};

export const deleteFlow = async (id: string) => {
  const res = await api.delete(`/api/v1/lowcode/flows/${id}`);
  return res.data;
};

export const publishFlow = async (id: string) => {
  const res = await api.post(`/api/v1/lowcode/flows/${id}/publish`);
  return res.data;
};

export const executeFlow = async (id: string, input: Record<string, unknown> = {}) => {
  const res = await api.post(`/api/v1/lowcode/flows/${id}/execute`, {
    input: JSON.stringify(input),
  });
  return res.data;
};

export const generateFlow = async (req: FlowGenerateRequest) => {
  const res = await api.post('/api/v1/lowcode/generate', req);
  return res.data as FlowGenerateResponse;
};

export const createWorkflowVersion = async (flowId: string) => {
  const res = await api.post(`/api/v1/lowcode/workflows/${flowId}/versions`);
  return res.data;
};

export const listWorkflowVersions = async (flowId: string) => {
  const res = await api.get(`/api/v1/lowcode/workflows/${flowId}/versions`);
  return res.data;
};

export const exportWorkflow = async (flowId: string) => {
  const res = await api.post(`/api/v1/lowcode/workflows/${flowId}/export`);
  return res.data;
};

export const importWorkflow = async (data: {
  name: string;
  description?: string;
  currentDefinition: { nodes: string; edges: string };
}) => {
  const res = await api.post('/api/v1/lowcode/workflows/import', data);
  return res.data;
};

export const applyTemplate = async (templateId: string, data: {
  workflowName: string;
  description?: string;
}) => {
  const res = await api.post(`/api/v1/lowcode/templates/${templateId}/apply`, data);
  return res.data;
};

// --- Flow helper utilities ---

export const parseFlowNodes = (nodesStr: string | undefined): unknown[] => {
  if (!nodesStr) return [];
  try { return JSON.parse(nodesStr); } catch { return []; }
};

export const parseFlowEdges = (edgesStr: string | undefined): unknown[] => {
  if (!edgesStr) return [];
  try { return JSON.parse(edgesStr); } catch { return []; }
};

export const countFlowNodes = (flow: LowcodeFlow): number => {
  const nodes = parseFlowNodes(flow.nodes);
  return Array.isArray(nodes) ? nodes.length : 0;
};

export const countFlowEdges = (flow: LowcodeFlow): number => {
  const edges = parseFlowEdges(flow.edges);
  return Array.isArray(edges) ? edges.length : 0;
};

// --- LowcodeApi namespace (legacy compat for pages) ---

export const lowcodeApi = {
  listTemplates,
  getTemplate,
  createTemplate,
  listForms,
  getForm,
  createForm,
  updateForm,
  deleteForm,
  listFlows: async () => {
    const res = (await fetchFlowsRaw()) as { data?: { data?: unknown[]; total?: number } };
    const data = res?.data || {};
    const items = (data.data || []) as unknown as LowcodeFlow[];
    return {
      flows: items.map((f: LowcodeFlow) => ({
        ...f,
        nodeCount: countFlowNodes(f),
        edgesCount: countFlowEdges(f),
      })),
      total: data.total || items.length,
    } as { flows: LowcodeFlow[]; total: number };
  },
  createFlow,
  getFlow,
  updateFlow,
  deleteFlow,
  publishFlow,
  executeFlow,
  exportWorkflow,
  importWorkflow,
  listWorkflowVersions,
  createWorkflowVersion,
  applyTemplate: async (templateId: string, data: Record<string, unknown>) => {
    // Apply a lowcode template to create a new workflow (internal/lowcode backend)
    const res = await api.post(`/api/v1/lowcode/templates/${templateId}/apply`, {
      workflowName: data.workflowName,
      description: data.description,
    });
    return res.data;
  },
};

export default lowcodeApi;