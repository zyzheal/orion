/**
 * Budget Guard Page - 布局编排
 * Phase 2 - Budget guard configuration, evaluation, and cost forecasting
 *
 * 主页面仅保留: 页头 + SummaryCards + ForecastCard + Filters + Table + 3 Modals
 * 状态+加载器+CRUD+评估抽到 useBudgetGuardState hook (Form 实例由主页面持有)
 * 顶部统计卡抽到 SummaryCards，预测卡抽到 ForecastCard
 * 表格列配置抽到 buildBudgetGuardColumns，3 个 Modal 各自独立组件
 */
import React, { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Form,
  Input,
  Select,
  Space,
  Typography,
} from 'antd';
import {
  SafetyOutlined,
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import type { BudgetGuard } from '@/api/cost-operations';
import { colors, spacing, themeVars } from '@/tokens';
import { useBudgetGuardState } from './useBudgetGuardState';
import { buildBudgetGuardColumns } from './BudgetGuardColumns';
import { SummaryCards } from './SummaryCards';
import { ForecastCard } from './ForecastCard';
import { CreateGuardModal } from './CreateGuardModal';
import { EditGuardModal } from './EditGuardModal';
import { EvaluateGuardModal } from './EvaluateGuardModal';

const { Title, Text } = Typography;

const BudgetGuardPage: React.FC = () => {
  const state = useBudgetGuardState();
  const {
    guards,
    loading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    actionFilter,
    setActionFilter,
    filteredGuards,
    submitting,
    forecast,
    forecastLoading,
    evaluationCount,
    blockedCount,
    evalLoading,
    evalResult,
    setEvalResult,
    loadGuards,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleToggle,
    handleEvaluate,
  } = state;

  // Modal state (form owners)
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingGuard, setEditingGuard] = useState<BudgetGuard | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // Evaluation modal state
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [evalForm] = Form.useForm();

  // ============================================================================
  // Handlers (form wrappers)
  // ============================================================================

  const handleOpenCreate = () => {
    createForm.resetFields();
    setCreateModalOpen(true);
  };

  const handleOpenEdit = (guard: BudgetGuard) => {
    setEditingGuard(guard);
    editForm.setFieldsValue({
      name: guard.name,
      description: guard.description || undefined,
      budgetAmount: guard.budgetAmount,
      currency: guard.currency || 'CNY',
      action: guard.action,
    });
    setEditModalOpen(true);
  };

  const handleCreateSubmit = async (values: unknown) => {
    await handleCreate(values as Parameters<typeof handleCreate>[0]);
    setCreateModalOpen(false);
    createForm.resetFields();
  };

  const handleUpdateSubmit = async (values: unknown) => {
    if (!editingGuard) return;
    await handleUpdate(values as Parameters<typeof handleUpdate>[0], editingGuard);
    setEditModalOpen(false);
  };

  const handleOpenEvaluate = () => {
    setEvalResult(null);
    evalForm.resetFields();
    setEvalModalOpen(true);
  };

  // ============================================================================
  // Table Columns
  // ============================================================================

  const columns = buildBudgetGuardColumns({
    editForm,
    onEdit: handleOpenEdit,
    onToggle: handleToggle,
    onDelete: handleDelete,
  });

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div style={{ padding: spacing[6], background: themeVars.bgPrimary, minHeight: '100vh' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing[4],
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <DollarOutlined
              style={{ marginRight: spacing[3], color: colors.primary[500] }}
            />
            <SafetyOutlined style={{ marginRight: spacing[2] }} />
            Budget Guard
          </Title>
          <Text type="secondary">
            Configure budget guards to control pipeline execution based on cost constraints
          </Text>
        </div>
        <Space>
          <Button icon={<ThunderboltOutlined />} onClick={handleOpenEvaluate}>
            Evaluate
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadGuards}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            Create Guard
          </Button>
        </Space>
      </div>

      {/* Summary Cards */}
      <SummaryCards
        guards={guards}
        forecast={forecast}
        evaluationCount={evaluationCount}
        blockedCount={blockedCount}
      />

      {/* Forecast Card */}
      <ForecastCard forecast={forecast} loading={forecastLoading} />

      {/* Filters */}
      <Card style={{ marginTop: spacing[4], marginBottom: spacing[4] }}>
        <Space>
          <Input.Search
            placeholder="Search guards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 120 }}
            options={[
              { label: 'All Status', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
            ]}
          />
          <Select
            value={actionFilter}
            onChange={setActionFilter}
            style={{ width: 120 }}
            options={[
              { label: 'All Actions', value: 'all' },
              { label: 'Allow', value: 'allow' },
              { label: 'Block', value: 'block' },
              { label: 'Warn', value: 'warn' },
            ]}
          />
        </Space>
      </Card>

      {/* Guard List Table */}
      <Card title={`Budget Guards (${filteredGuards.length})`}>
        <Table
          columns={columns}
          dataSource={filteredGuards}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} guards`,
          }}
        />
      </Card>

      {/* Create Modal */}
      <CreateGuardModal
        open={createModalOpen}
        form={createForm}
        submitting={submitting}
        onCancel={() => setCreateModalOpen(false)}
        onSubmit={handleCreateSubmit}
      />

      {/* Edit Modal */}
      <EditGuardModal
        open={editModalOpen}
        form={editForm}
        submitting={submitting}
        onCancel={() => setEditModalOpen(false)}
        onSubmit={handleUpdateSubmit}
      />

      {/* Evaluation Modal */}
      <EvaluateGuardModal
        open={evalModalOpen}
        form={evalForm}
        evalLoading={evalLoading}
        evalResult={evalResult}
        onCancel={() => setEvalModalOpen(false)}
        onSubmit={handleEvaluate}
      />
    </div>
  );
};

export default BudgetGuardPage;
