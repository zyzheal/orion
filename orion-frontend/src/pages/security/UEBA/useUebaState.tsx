/**
 * UEBA state hook
 * 抽取自 index.tsx (P2-9 Phase 135)
 */
import { useMemo, useState } from 'react';
import { Form } from 'antd';
import type { AnomalyType, DetectionConfig, RiskLevel } from './types';
import { mockEvents, mockRiskRanks } from './helpers';

export const useUebaState = () => {
  const [typeFilter, setTypeFilter] = useState<AnomalyType | 'all'>('all');
  const [levelFilter, setLevelFilter] = useState<RiskLevel>('all');
  const [configForm] = Form.useForm();
  const [config] = useState<DetectionConfig>({
    method: 'Z-Score',
    sensitivity: 5,
    baselineDays: 30,
  });

  const filteredEvents = useMemo(() => {
    let data = mockEvents;
    if (typeFilter !== 'all') {
      data = data.filter((e) => e.type === typeFilter);
    }
    if (levelFilter === 'high') {
      data = data.filter((e) => e.score >= 80);
    } else if (levelFilter === 'medium') {
      data = data.filter((e) => e.score >= 40 && e.score < 80);
    } else if (levelFilter === 'low') {
      data = data.filter((e) => e.score < 40);
    }
    return data;
  }, [typeFilter, levelFilter]);

  const monitoredUsers = 128;
  const anomalyEvents = mockEvents.length;
  const highRiskUsers = mockRiskRanks.filter((u) => u.score >= 80).length;
  const modelAccuracy = 94.7;

  return {
    typeFilter,
    setTypeFilter,
    levelFilter,
    setLevelFilter,
    configForm,
    config,
    filteredEvents,
    mockRiskRanks,
    monitoredUsers,
    anomalyEvents,
    highRiskUsers,
    modelAccuracy,
  };
};

export type UebaState = ReturnType<typeof useUebaState>;
