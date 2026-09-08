export type SpaceMetric = 'satisfaction' | 'performance' | 'activity' | 'communication' | 'efficiency';

export interface SpaceData {
  satisfaction: { score: number; surveyCount: number; trend: string };
  performance: { buildSuccessRate: number; avgBuildTime: number; testPassRate: number };
  activity: { commits: number; prs: number; deployments: number; linesChanged: number };
  communication: { reviewTurnaround: number; meetingRatio: number };
  efficiency: { leadTime: number; mttr: number; deploymentFrequency: number };
}

export interface SpaceDetailRow {
  key: string;
  metric: string;
  current: number;
  target: number;
  trend: string;
  status: string;
}
