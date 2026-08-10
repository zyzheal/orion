/**
 * Form Renderer API
 * CRUD for dynamic JSON Schema forms backed by PostgreSQL
 */
import apiClient from './client';

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'radio' | 'checkbox' | 'cascader' | 'textarea' | 'switch';
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: unknown;
  rules?: Array<{ required?: boolean; message?: string; pattern?: string; max?: number; min?: number }>;
}

export interface FormSchema {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
  category?: string;
  status?: 'draft' | 'active' | 'archived';
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export function listForms() {
  return apiClient.get<{ data: FormSchema[] }>('/forms').then((r) => r.data.data || []);
}

export function getForm(id: string) {
  return apiClient.get<{ data: FormSchema }>(`/forms/${id}`).then((r) => r.data.data);
}

export function createForm(schema: Omit<FormSchema, 'id' | 'createdAt' | 'updatedAt'>) {
  return apiClient.post<{ data: FormSchema }>('/forms', schema).then((r) => r.data.data);
}

export function updateForm(id: string, schema: Partial<FormSchema>) {
  return apiClient.put<{ data: FormSchema }>(`/forms/${id}`, schema).then((r) => r.data.data);
}

export function deleteForm(id: string) {
  return apiClient.delete<{ data: { success: boolean } }>(`/forms/${id}`).then((r) => r.data.data);
}

export function submitForm(id: string, payload: Record<string, unknown>) {
  return apiClient.post<{ data: { submissionId: string } }>(`/forms/${id}/submit`, payload).then((r) => r.data.data);
}