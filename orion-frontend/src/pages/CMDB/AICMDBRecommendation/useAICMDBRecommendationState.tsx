/**
 * AICMDBRecommendation state hook
 * 抽取自 index.tsx (P2-9 Phase 139)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import {
  getRecommendations,
  actionRecommendation,
  type RecommendationType,
  type RecommendationStatus,
  type RecommendationItem,
  type AnomalyDetected,
} from '@/api/cmdb';
import { DEFAULT_MODEL_STATUS } from './constants';
import type { ModelStatus } from './types';

export const useAICMDBRecommendationState = () => {
  const [recommendType, setRecommendType] = useState<RecommendationType | 'all'>('all');
  const [recommendStatus, setRecommendStatus] = useState<RecommendationStatus | 'all'>('all');
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyDetected[]>([]);
  const [modelStatus, setModelStatus] = useState<ModelStatus>(DEFAULT_MODEL_STATUS);
  const [retraining, setRetraining] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchRecommendations = useCallback(async (type?: RecommendationType) => {
    setLoading(true);
    try {
      const params: { type?: RecommendationType; limit?: number } = { limit: 50 };
      if (type) params.type = type;
      const res = await getRecommendations(params);
      const data = res?.data;
      if (data) {
        setRecommendations(data.recommendations || []);
        setAnomalies(data.anomalies || []);
        if (data.recommendations && data.recommendations.length > 0) {
          const avgConf =
            data.recommendations.reduce((s, r) => s + r.confidence, 0) /
            data.recommendations.length;
          setModelStatus((prev) => ({
            ...prev,
            trainingDataCount: data.total,
            accuracy: Math.round(avgConf * 10) / 10,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
      message.error('获取智能推荐失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations(recommendType === 'all' ? undefined : recommendType);
  }, [recommendType, fetchRecommendations]);

  const filteredRecommendations = useMemo(() => {
    return recommendations.filter((item) => {
      const typeMatch = recommendType === 'all' || item.type === recommendType;
      const statusMatch = recommendStatus === 'all' || item.status === recommendStatus;
      return typeMatch && statusMatch;
    });
  }, [recommendations, recommendType, recommendStatus]);

  const handleAccept = useCallback(async (id: string) => {
    try {
      await actionRecommendation(id, 'accept');
      setRecommendations((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'accepted' } : item))
      );
      message.success('已采纳该推荐');
    } catch {
      message.error('采纳推荐失败');
    }
  }, []);

  const handleReject = useCallback(async (id: string) => {
    try {
      await actionRecommendation(id, 'reject');
      setRecommendations((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'rejected' } : item))
      );
      message.info('已拒绝该推荐');
    } catch {
      message.error('拒绝推荐失败');
    }
  }, []);

  const handleRetrain = useCallback(() => {
    setRetraining(true);
    message.loading({ content: '模型重新训练中...', key: 'retrain', duration: 0 });
    setTimeout(() => {
      setRetraining(false);
      message.success({ content: '模型重新训练完成', key: 'retrain' });
      fetchRecommendations();
    }, 3000);
  }, [fetchRecommendations]);

  const totalRecs = recommendations.length;
  const pendingCount = recommendations.filter((r) => r.status === 'pending').length;
  const anomalyCount = anomalies.length;
  const avgAccuracy =
    recommendations.length > 0
      ? Math.round(
          (recommendations.reduce((s, r) => s + r.confidence, 0) / recommendations.length) * 10
        ) / 10
      : 0;

  return {
    recommendType,
    setRecommendType,
    recommendStatus,
    setRecommendStatus,
    recommendations,
    anomalies,
    modelStatus,
    retraining,
    loading,
    fetchRecommendations,
    filteredRecommendations,
    handleAccept,
    handleReject,
    handleRetrain,
    totalRecs,
    pendingCount,
    anomalyCount,
    avgAccuracy,
  };
};

export type AICMDBRecommendationState = ReturnType<typeof useAICMDBRecommendationState>;
