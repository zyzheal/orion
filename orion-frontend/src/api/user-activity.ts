/**
 * User Activity API Service
 *
 * Aligned with backend /api/v1/users/:id/activities routes (user-activity-routes.ts)
 * Covers: paginated user activity logs
 */
import { api } from './client';

// ==================== Interfaces ====================

export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface ActivityListResult {
  activities: UserActivity[];
  total: number;
  page: number;
  pageSize: number;
}

// ==================== Activity Operations ====================

export const getUserActivities = async (userId: string, params?: {
  page?: number;
  pageSize?: number;
}): Promise<ActivityListResult> => {
  const response = await api.get<{ data: UserActivity[]; total: number; page: number; pageSize: number }>(
    `/v1/users/${userId}/activities`,
    { params }
  );
  return {
    activities: response.data.data,
    total: response.data.total,
    page: response.data.page,
    pageSize: response.data.pageSize,
  };
};
