/**
 * Workflow Dependencies Page
 * 工作流依赖分析 - 循环依赖检测与可视化
 * P2-9 Phase 85: 主页面拆分 (660→~90 行)
 * 3 个 Tab 组件已抽取到独立文件
 */
import React from 'react';
import { Typography, Tabs, Badge } from 'antd';
import { NodeIndexOutlined, SafetyOutlined, SearchOutlined } from '@ant-design/icons';
import PageSkeleton from '@/components/PageSkeleton';
import { spacing } from '@/tokens';
import { colors } from '@/tokens/colors';
import { useWorkflowDependenciesState } from './useWorkflowDependenciesState';
import { OverviewTab } from './OverviewTab';
import { VisualizationTab } from './VisualizationTab';
import { CheckTab } from './CheckTab';

const { Title, Text } = Typography;

const WorkflowDependenciesPage: React.FC = () => {
  const {
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
  } = useWorkflowDependenciesState();

  const tabItems = [
    {
      key: 'overview',
      label: (
        <span>
          <SafetyOutlined /> 检测概览
        </span>
      ),
      children: (
        <OverviewTab graphData={graphData} graphLoading={graphLoading} loadGraphData={loadGraphData} />
      ),
    },
    {
      key: 'visualization',
      label: (
        <span>
          <NodeIndexOutlined /> 依赖可视化
        </span>
      ),
      children: (
        <VisualizationTab vizData={vizData} vizLoading={vizLoading} loadVizData={loadVizData} />
      ),
    },
    {
      key: 'check',
      label: (
        <span>
          <SearchOutlined /> 单工作流检测
        </span>
      ),
      children: (
        <CheckTab
          checkLoading={checkLoading}
          checkResult={checkResult}
          selectedDefinitionId={selectedDefinitionId}
          setSelectedDefinitionId={setSelectedDefinitionId}
          handleCheckDefinition={handleCheckDefinition}
        />
      ),
    },
  ];

  const isInitialLoading = loading && !graphData && !vizData;

  return (
    <div style={{ padding: 0 }}>
      {isInitialLoading ? (
        <PageSkeleton cards={3} rows={8} />
      ) : (
        <>
          <div style={{ marginBottom: spacing.lg }}>
            <Title level={2} style={{ marginBottom: spacing.sm }}>
              <NodeIndexOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
              工作流依赖分析
            </Title>
            <Text type="secondary">检测工作流定义之间的循环依赖，支持依赖关系可视化</Text>
            {graphData && (
              <div style={{ marginTop: spacing.sm }}>
                <Badge
                  status={graphData.isSafe ? 'success' : 'error'}
                  text={graphData.isSafe ? '无循环依赖' : `存在 ${graphData.cycles.length} 个循环`}
                />
                <Text type="secondary" style={{ marginLeft: spacing.md, fontSize: 12 }}>
                  定义: {graphData.totalDefinitions} | 边: {graphData.totalEdges}
                </Text>
              </div>
            )}
          </div>

          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />
        </>
      )}
    </div>
  );
};

export default WorkflowDependenciesPage;
