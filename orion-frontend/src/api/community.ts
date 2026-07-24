/**
 * Community API
 * Phase 4 - Contributions, plugins, badges, mentorship
 */

import apiClient from './client';

export interface Contribution {
  id: string;
  tenant_id: string;
  user_id: string;
  username: string;
  type: 'plugin' | 'skill' | 'template' | 'documentation' | 'code';
  title: string;
  description: string | null;
  repository_url: string | null;
  stars: number;
  downloads: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface Contributor {
  user_id: string;
  username: string;
  avatar_url: string | null;
  contributions_count: number;
  badges: Badge[];
  reputation_score: number;
  member_since: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'contribution' | 'mentorship' | 'quality' | 'milestone';
  level: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface PluginReview {
  id: string;
  plugin_id: string;
  reviewer_id: string;
  score: number;
  feedback: string;
  status: 'approved' | 'rejected' | 'revision_requested';
  created_at: string;
}

export interface Mentorship {
  id: string;
  mentor_id: string;
  mentee_id: string;
  skill_area: string;
  status: 'pending' | 'active' | 'completed';
  created_at: string;
}

export const communityApi = {
  // Contributions
  listContributions: async (params?: { type?: string; status?: string; userId?: string }) => {
    const response = await apiClient.get('/api/v1/community/contributions', { params });
    return response.data as Contribution[];
  },

  getContribution: async (contributionId: string) => {
    const response = await apiClient.get(`/api/v1/community/contributions/${contributionId}`);
    return response.data as Contribution;
  },

  createContribution: async (data: {
    type: string;
    title: string;
    description?: string;
    repository_url?: string;
  }) => {
    const response = await apiClient.post('/api/v1/community/contributions', data);
    return response.data as Contribution;
  },

  // Contributors
  getContributor: async (userId: string) => {
    const response = await apiClient.get(`/api/v1/community/contributors/${userId}`);
    return response.data as Contributor;
  },

  // Plugins
  submitPlugin: async (data: {
    name: string;
    description: string;
    repository_url: string;
    version: string;
  }) => {
    const response = await apiClient.post('/api/v1/community/plugins', data);
    return response.data;
  },

  reviewPlugin: async (pluginId: string, data: { score: number; feedback: string }) => {
    const response = await apiClient.post(`/api/v1/community/plugins/${pluginId}/review`, data);
    return response.data as PluginReview;
  },

  // Badges
  listBadges: async () => {
    const response = await apiClient.get('/api/v1/community/badges');
    return response.data as Badge[];
  },

  // Mentorship
  listMentorship: async (params?: { status?: string }) => {
    const response = await apiClient.get('/api/v1/community/mentorship', { params });
    return response.data as Mentorship[];
  },

  createMentorship: async (data: { mentor_id: string; mentee_id: string; skill_area: string }) => {
    const response = await apiClient.post('/api/v1/community/mentorship', data);
    return response.data as Mentorship;
  },
};

export default communityApi;
