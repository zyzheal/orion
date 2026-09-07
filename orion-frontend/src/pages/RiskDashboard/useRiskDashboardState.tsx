/**
 * useRiskDashboardState - RiskDashboard 状态 hook
 * 抽取自 index.tsx (P2-9 Phase 123)
 */
import { useState, useEffect, useMemo } from 'react';
import { Form, message } from 'antd';
import {
  assessDeploymentRisk,
  runHealthCheck,
  getRiskAssessments,
  getRiskEvents,
  acknowledgeRiskEvent,
  getRiskStatus,
  type RiskAssessment,
  type RiskAssessmentInput,
  type RiskEvent,
} from '@/api/risk';
import { dayLabels, riskLevelToSeverity } from './constants';
import { HeatmapCell } from '@/components/charts';

export interface RiskStatus {
  status: string;
  totalAssessments: number;
  pendingAssessments: number;
  highRiskCount: number;
}

export const useRiskDashboardState = () => {
  const [loading, setLoading] = useState(false);
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [status, setStatus] = useState<RiskStatus | null>(null);
  const [selectedAssessment, setSelectedAssessment] = useState<RiskAssessment | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [assessModalOpen, setAssessModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [assessmentsRes, eventsRes, statusRes] = await Promise.all([
        getRiskAssessments({ pageSize: 20 }),
        getRiskEvents('unacknowledged'),
        getRiskStatus(),
      ]);
      setAssessments(assessmentsRes?.data?.assessments || []);
      setEvents(eventsRes?.data?.events || []);
      setStatus(statusRes?.data ?? null);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载风险数据失败：${error.message}`);
      } else {
        message.error('加载风险数据失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssess = async (_values: RiskAssessmentInput) => {
    try {
      await assessDeploymentRisk(_values.targetId, {});
      message.success('风险评估已启动');
      setAssessModalOpen(false);
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`风险评估失败：${error.message}`);
      } else {
        message.error('风险评估失败，请稍后重试');
      }
    }
  };

  const handleHealthCheck = async (checkType: 'basic' | 'comprehensive') => {
    try {
      await runHealthCheck(checkType);
      message.success('健康检查已完成');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`健康检查失败：${error.message}`);
      } else {
        message.error('健康检查失败，请稍后重试');
      }
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeRiskEvent(id);
      message.success('风险事件已确认');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`确认失败：${error.message}`);
      } else {
        message.error('确认失败，请稍后重试');
      }
    }
  };

  const eventTableData = events.map((e) => ({ key: e.id, ...e }));

  const heatmapData: HeatmapCell[] = useMemo(
    () =>
      assessments.map((a): HeatmapCell => {
        const dayIndex = new Date(a.assessedAt).getDay();
        return {
          x: dayLabels[dayIndex],
          y: riskLevelToSeverity[a.riskLevel] ?? 'Low',
          value: 1,
        };
      }),
    [assessments]
  );

  const riskTypeData = useMemo(
    () =>
      Object.entries(
        assessments.reduce<Record<string, number>>((acc, a) => {
          acc[a.targetType] = (acc[a.targetType] ?? 0) + 1;
          return acc;
        }, {})
      ).map(([label, value]) => ({ label, value })),
    [assessments]
  );

  const openDetail = (record: RiskAssessment) => {
    setSelectedAssessment(record);
    setDrawerOpen(true);
  };

  return {
    loading,
    assessments,
    events,
    status,
    selectedAssessment,
    drawerOpen,
    assessModalOpen,
    form,
    loadData,
    handleAssess,
    handleHealthCheck,
    handleAcknowledge,
    eventTableData,
    heatmapData,
    riskTypeData,
    openDetail,
    setDrawerOpen,
    setAssessModalOpen,
  };
};

export type RiskDashboardState = ReturnType<typeof useRiskDashboardState>;
