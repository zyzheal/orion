/**
 * Low-Code Designer API Service
 * /api/v1/lowcode — Forms / Fields / Templates / Instances / Components
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

// Legacy types used by TemplateMarket and Flow pages
export type LowcodeTemplate = FormTemplate;
export interface LowcodeFlow {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  createdAt: string;
  updatedAt: string;
}

// --- Forms ---

export const listForms = async (category?: string, status?: string) => {
  const params: Record<string, string> = {};
  if (category) params.category = category;
  if (status) params.status = status;
  const res = await api.get('/api/v1/lowcode/forms', { params });
  return res.data;
};

export const getForm = async (id: string) => {
  const res = await api.get(`/api/v1/lowcode/forms/${id}`);
  return res.data;
};

export const createForm = async (data: Partial<FormDefinition> & { name: string; fields?: FormField[] }) => {
  const res = await api.post('/api/v1/lowcode/forms', data);
  return res.data;
};

export const updateForm = async (id: string, data: Partial<FormDefinition>) => {
  const res = await api.put(`/api/v1/lowcode/forms/${id}`, data);
  return res.data;
};

export const deleteForm = async (id: string) => {
  const res = await api.delete(`/api/v1/lowcode/forms/${id}`);
  return res.data;
};

// --- Fields ---

export const createField = async (formId: string, data: Partial<FormField> & { key: string; label: string; type: string }) => {
  const res = await api.post(`/api/v1/lowcode/forms/${formId}/fields`, data);
  return res.data;
};

export const getFieldsByForm = async (formId: string) => {
  const res = await api.get(`/api/v1/lowcode/forms/${formId}/fields`);
  return res.data;
};

export const updateField = async (id: string, data: Partial<FormField>) => {
  const res = await api.put(`/api/v1/lowcode/fields/${id}`, data);
  return res.data;
};

export const deleteField = async (id: string) => {
  const res = await api.delete(`/api/v1/lowcode/fields/${id}`);
  return res.data;
};

// --- Templates ---

export const listTemplates = async (category?: string) => {
  const params: Record<string, string> = {};
  if (category) params.category = category;
  const res = await api.get('/api/v1/lowcode/templates', { params });
  return res.data;
};

export const getTemplate = async (id: string) => {
  const res = await api.get(`/api/v1/lowcode/templates/${id}`);
  return res.data;
};

export const createTemplate = async (data: { name: string; description?: string; category?: string; schema?: Record<string, unknown>; tags?: string[] }) => {
  const res = await api.post('/api/v1/lowcode/templates', data);
  return res.data;
};

// --- Instances ---

export const submitInstance = async (formId: string, data: { data: Record<string, unknown>; submitBy: string }) => {
  const res = await api.post(`/api/v1/lowcode/forms/${formId}/instances`, data);
  return res.data;
};

export const listInstances = async (formId?: string, status?: string) => {
  const params: Record<string, string> = {};
  if (formId) params.formId = formId;
  if (status) params.status = status;
  const res = await api.get('/api/v1/lowcode/instances', { params });
  return res.data;
};

export const getInstance = async (id: string) => {
  const res = await api.get(`/api/v1/lowcode/instances/${id}`);
  return res.data;
};

export const approveInstance = async (id: string, action: 'approve' | 'reject', approver: string) => {
  const res = await api.post(`/api/v1/lowcode/instances/${id}/approve`, { approver, action });
  return res.data;
};

// --- Components ---

export const listComponents = async (category?: string) => {
  const params: Record<string, string> = {};
  if (category) params.category = category;
  const res = await api.get('/api/v1/lowcode/components', { params });
  return res.data;
};

export const getComponent = async (id: string) => {
  const res = await api.get(`/api/v1/lowcode/components/${id}`);
  return res.data;
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
  const res = await api.post('/api/v1/lowcode/components', data);
  return res.data;
};

// --- LowcodeApi namespace (legacy compat for TemplateMarket) ---

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
    // No dedicated flow backend yet — returns forms as flows
    const res = await listForms();
    return (Array.isArray(res) ? res : (res?.data ?? [])) as LowcodeFlow[];
  },
  applyTemplate: async (templateId: string, data: Record<string, unknown>) => {
    // Apply a template by creating a form from it
    const tpl = await getTemplate(templateId);
    return createForm({ ...tpl, ...data, name: data.workflowName || tpl.name });
  },
};

export default lowcodeApi;