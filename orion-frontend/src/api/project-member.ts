/**
 * Project Member API
 * 对接后端 /api/v1/project-members 端点
 */

import { api } from './client';

export interface ProjectMember {
  user_id: string;
  role: string;
}

/**
 * 获取项目成员列表
 */
export async function getProjectMembers(projectId: string) {
  const res = await api.get(`/v1/project-members/${projectId}`);
  return res.data as { data: ProjectMember[]; total: number };
}

/**
 * 添加项目成员
 */
export async function addProjectMember(projectId: string, userId: string, role: string) {
  const res = await api.post(`/v1/project-members/${projectId}`, { userId, role });
  return res.data as { message: string; userId: string; role: string };
}

/**
 * 移除项目成员
 */
export async function removeProjectMember(projectId: string, userId: string) {
  const res = await api.delete(`/v1/project-members/${projectId}/${userId}`);
  return res.data as { message: string };
}

/**
 * 检查用户是否为项目成员
 */
export async function checkProjectMember(projectId: string, userId: string) {
  const res = await api.get(`/v1/project-members/${projectId}/check/${userId}`);
  return res.data as { isMember: boolean };
}