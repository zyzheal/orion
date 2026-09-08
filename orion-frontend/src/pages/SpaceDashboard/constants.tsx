import React from 'react';
import {
  SmileOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  RocketOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { api } from '@/api/client';
import type { SpaceMetric, SpaceData } from './types';

export const SPACE_CONFIG: Record<SpaceMetric, { label: string; icon: React.ReactNode; color: string }> = {
  satisfaction: { label: '满意度 (S)', icon: <SmileOutlined />, color: 'blue' },
  performance: { label: '效能 (P)', icon: <ThunderboltOutlined />, color: 'green' },
  activity: { label: '活跃度 (A)', icon: <TeamOutlined />, color: 'orange' },
  communication: { label: '协作 (C)', icon: <MessageOutlined />, color: 'purple' },
  efficiency: { label: '效率 (E)', icon: <RocketOutlined />, color: 'magenta' },
};

export async function fetchSpaceData(period: string): Promise<SpaceData> {
  try {
    const resp = await api.get<SpaceData>('/space-metrics', { params: { period } });
    if (resp.data && typeof resp.data === 'object') return resp.data;
  } catch {
    return getFallbackData();
  }
  return getFallbackData();
}

export function getFallbackData(): SpaceData {
  return {
    satisfaction: { score: 82, surveyCount: 48, trend: '↑ +3' },
    performance: { buildSuccessRate: 94, avgBuildTime: 12.5, testPassRate: 97 },
    activity: { commits: 324, prs: 56, deployments: 18, linesChanged: 12840 },
    communication: { reviewTurnaround: 4.2, meetingRatio: 0.35 },
    efficiency: { leadTime: 1.8, mttr: 23, deploymentFrequency: 3 },
  };
}
