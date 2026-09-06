/**
 * MLOps Page (Phase 4 P0)
 * Experiment tracking, model registry, training job management
 *
 * Implements full CRUD with:
 * - Experiments: Create, Read, Update, Delete, Status Management, Runs
 * - Models: Register, Read, Deploy, Status Management
 * - Training Jobs: Create, Read, Status Management
 * - Metrics dashboard
 *
 * Module layout:
 * - ./config.ts         - status color maps, select options, layout presets, form rules
 * - ./columns.tsx       - table column factories (build*Columns)
 * - ./MLOpsModals.tsx   - modals and drawers
 * - ./MetricsTab.tsx    - overview metrics dashboard
 * - ./ExperimentsTab.tsx / ./ModelRegistryTab.tsx / ./TrainingJobsTab.tsx - data tabs
 */
import React from 'react';
import { Tabs, Typography } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { MetricsTab } from './MetricsTab';
import { ExperimentsTab } from './ExperimentsTab';
import { ModelRegistryTab } from './ModelRegistryTab';
import { TrainingJobsTab } from './TrainingJobsTab';

const { Title, Text } = Typography;

// ============================================================================
// Tab registry
// ============================================================================

const TAB_ITEMS = [
  { key: 'overview', label: '概览', children: <MetricsTab /> },
  { key: 'experiments', label: '实验管理', children: <ExperimentsTab /> },
  { key: 'models', label: '模型注册', children: <ModelRegistryTab /> },
  { key: 'jobs', label: '训练任务', children: <TrainingJobsTab /> },
];

// ============================================================================
// Main Page
// ============================================================================

const MLOpsPage: React.FC = () => {
  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md, color: colors.neutral[900] }}>
        <ExperimentOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        MLOps 平台
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        管理 ML 模型的全生命周期：实验跟踪、模型注册、训练调度和模型部署
      </Text>
      <Tabs defaultActiveKey="overview" items={TAB_ITEMS} size="large" />
    </div>
  );
};

export default MLOpsPage;
