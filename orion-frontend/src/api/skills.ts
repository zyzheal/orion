/**
 * Skill Management API Service
 * Skill marketplace, installed skills, and skill submissions
 */
import { api } from './client';

// ---- Types ----

export interface SkillPackage {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  status: 'draft' | 'published' | 'archived';
  installCount: number;
  rating: number;
  createdAt: string;
}

export interface SkillVersion {
  id: string;
  skillId: string;
  version: string;
  changelog: string;
  createdAt: string;
}

export interface SkillRating {
  score: number;
  comment?: string;
}

export interface SkillPackageInput {
  name: string;
  version: string;
  description: string;
  category: string;
  tags?: string[];
  content?: string;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  status?: string;
}

export interface SkillListParams {
  category?: string;
  tag?: string;
  search?: string;
  sortBy?: string;
  page?: number;
  perPage?: number;
}

// ---- Skill Marketplace ----

export function getSkills(params?: SkillListParams) {
  return api.get('/v1/skills', { params });
}

export function getSkill(id: string) {
  return api.get(`/v1/skills/${id}`);
}

export function createSkill(data: SkillPackageInput) {
  return api.post('/v1/skills', data);
}

export function updateSkill(id: string, data: UpdateSkillInput) {
  return api.put(`/v1/skills/${id}`, data);
}

export function deleteSkill(id: string) {
  return api.delete(`/v1/skills/${id}`);
}

// ---- Skill Versions ----

export function getSkillVersions(id: string) {
  return api.get(`/v1/skills/${id}/versions`);
}

// ---- Install / Uninstall ----

export function installSkill(id: string) {
  return api.post(`/v1/skills/${id}/install`);
}

export function uninstallSkill(id: string) {
  return api.post(`/v1/skills/${id}/uninstall`);
}

// ---- Rating ----

export function rateSkill(id: string, data: SkillRating) {
  return api.post(`/v1/skills/${id}/rate`, data);
}

// ---- My Skills ----
// Note: Backend skill-routes.ts doesn't have /my endpoints.
// Use query params on /skills to filter by installed status.

export function getMySkills() {
  return api.get('/v1/skills', { params: { installed: 'true' } });
}

export function getInstalledSkill(id: string) {
  return api.get(`/v1/skills/${id}`);
}
