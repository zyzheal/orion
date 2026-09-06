/**
 * useWorkflowDependenciesState.ts - 工作流依赖状态 Hook
 * 抽取自 WorkflowDependencies/index.tsx (P2-9 Phase 85)
 */
import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import {
  getDependencyGraph,
  checkDefinition,
  getVisualizationData,
  type DependencyGraphResult,
  type DefinitionCheckResult,
  type VisualizationData,
} from '@/api/workflow-dependency';

export const useWorkflowDependenciesState = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Overview state
  const [graphData, setGraphData] = useState<DependencyGraphResult | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);

  // Visualization state
  const [vizData, setVizData] = useState<VisualizationData | null>(null);
  const [vizLoading, setVizLoading] = useState(false);

  // Single definition check state
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<DefinitionCheckResult | null>(null);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string>('');

  const loadGraphData = useCallback(async () => {
    setGraphLoading(true);
    try {
      const data = await getDependencyGraph();
      setGraphData(data);
    } catch (error: unknown) {
      setGraphData(null);
      message.error(`加载依赖图失败: ${(error as Error).message}`);
    } finally {
      setGraphLoading(false);
    }
  }, []);

  const loadVizData = useCallback(async () => {
    setVizLoading(true);
    try {
      const data = await getVisualizationData();
      setVizData(data);
    } catch (error: unknown) {
      setVizData(null);
      message.error(`加载可视化数据失败: ${(error as Error).message}`);
    } finally {
      setVizLoading(false);
    }
  }, []);

  const handleCheckDefinition = useCallback(async () => {
    if (!selectedDefinitionId) {
      message.warning('请输入工作流定义 ID');
      return;
    }
    setCheckLoading(true);
    try {
      const data = await checkDefinition(selectedDefinitionId);
      setCheckResult(data);
      if (data.isSafe) {
        message.success('检测结果：安全，无循环依赖');
      } else {
        message.warning(`检测到 ${data.cycles.length} 个循环依赖`);
      }
    } catch (error: unknown) {
      setCheckResult(null);
      message.error(`检查失败: ${(error as Error).message}`);
    } finally {
      setCheckLoading(false);
    }
  }, [selectedDefinitionId]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([loadGraphData(), loadVizData()]).finally(() => setLoading(false));
  }, [loadGraphData, loadVizData]);

  return {
    loading,
    activeTab,
    setActiveTab,
    graphData,
    graphLoading,
    vizData,
    vizLoading,
    checkLoading,
    checkResult,
    selectedDefinitionId,
    setSelectedDefinitionId,
    loadGraphData,
    loadVizData,
    handleCheckDefinition,
  };
};
