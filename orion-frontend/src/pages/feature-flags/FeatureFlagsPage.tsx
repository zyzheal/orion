/**
 * Feature Flags Page (Workflow 10: Feature Flag Enhancement)
 *
 * Features:
 * - Feature flag list with toggle controls
 * - Per-tenant/user-group grayscale configuration
 * - Create/edit/delete flags
 * - Evaluate flag for specific context
 * - Evaluation statistics
 *
 * Backend API: Not yet available - uses graceful fallback
 *
 * P2-9 Phase 54 重构:
 * - 全部 state + loadFlags/loadStats + 7 handlers + filteredFlags memo 抽入 useFeatureFlagsState.ts
 * - 9 列表格列配置 + 常量 + filterDefinitions 抽入 FeatureFlagColumns.tsx
 * - 4 个 Modal (Create/Edit/Evaluate/Detail) 抽入 FeatureFlagModals.tsx
 * - 主页面仅保留 layout + 3 Form.useForm + 2 setFieldsValue/resetFields useEffects + 3 wrapper handlers
 */
import { useEffect } from 'react';
import { Typography, Card, Table, Space, Button, Alert, Row, Col, Form } from 'antd';
import { PlusOutlined, ReloadOutlined, WarningOutlined, FlagOutlined } from '@ant-design/icons';
import MetricCard from '@/components/MetricCard';
import SearchFilterBar from '@/components/SearchFilterBar';
import { colors, spacing } from '@/tokens';
import { useFeatureFlagsState } from './useFeatureFlagsState';
import { useFeatureFlagColumns, filterDefinitions } from './FeatureFlagColumns';
import { FeatureFlagModals } from './FeatureFlagModals';

const { Title, Text } = Typography;

export default function FeatureFlagsPage() {
  const state = useFeatureFlagsState();
  const {
    loading,
    setSearchQuery,
    setTypeFilter,
    setStrategyFilter,
    createModalVisible,
    setCreateModalVisible,
    editModalVisible,
    setEditModalVisible,
    editingFlag,
    setEditingFlag,
    evaluateModalVisible,
    setEvaluateModalVisible,
    evaluatingFlag,
    setEvaluatingFlag,
    detailModalVisible,
    setDetailModalVisible,
    selectedFlag,
    setSelectedFlag,
    submitting,
    stats,
    evaluationResult,
    apiError,
    filteredFlags,
    loadFlags,
    handleCreate,
    handleEdit,
    handleDelete,
    handleToggle,
    handleEvaluate,
    handleOpenEdit,
    handleOpenEvaluate,
    handleViewDetail,
  } = state;

  // ---- Forms (kept in main page; modals file consumes the form instance) ----
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [evaluateForm] = Form.useForm();

  // ---- Form setFieldsValue/resetFields on modal open ----
  useEffect(() => {
    if (editingFlag) {
      editForm.setFieldsValue({
        name: editingFlag.name,
        key: editingFlag.key,
        description: editingFlag.description,
        type: editingFlag.type,
        defaultValue: editingFlag.defaultValue,
        strategy: editingFlag.strategy,
        tenantId: editingFlag.tenantId || '',
        userGroups: (editingFlag.userGroups || []).join(', '),
        percentage: editingFlag.percentage || undefined,
      });
    } else {
      editForm.resetFields();
    }
  }, [editingFlag, editModalVisible, editForm]);

  useEffect(() => {
    if (evaluatingFlag) {
      evaluateForm.resetFields();
    }
  }, [evaluatingFlag, evaluateForm]);

  // ---- Form wrapper handlers (validateFields + call hook handler with values) ----
  const handleCreateWrapper = async () => {
    try {
      const values = await createForm.validateFields();
      await handleCreate(values);
    } catch {
      // Form validation error - do nothing
    }
  };

  const handleEditWrapper = async () => {
    try {
      const values = await editForm.validateFields();
      await handleEdit(values);
    } catch {
      // Form validation error
    }
  };

  const handleEvaluateWrapper = async () => {
    try {
      const values = await evaluateForm.validateFields();
      await handleEvaluate(values);
    } catch {
      // Form validation error
    }
  };

  // ---- Table Columns ----
  const columns = useFeatureFlagColumns({
    handleToggle,
    handleViewDetail,
    handleOpenEvaluate,
    handleOpenEdit,
    handleDelete,
  });

  // ---- Render ----
  return (
    <div style={{ padding: 0 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing[6],
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <FlagOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            特性开关管理
          </Title>
          <Text type="secondary">按租户/用户组的灰度发布和特性开关控制</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadFlags} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建开关
          </Button>
        </Space>
      </div>

      {/* API Warning */}
      {apiError && (
        <Alert
          message="后端 API 尚未就绪"
          description={`特性开关管理功能的后端接口尚未实现 (${apiError})。页面已准备好，等待后端完成后启用。`}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: spacing[4] }}
        />
      )}

      {/* Stats Cards */}
      {stats && (
        <div style={{ marginBottom: spacing[6] }}>
          <Row gutter={spacing[4]}>
            <Col span={6}>
              <MetricCard title="开关总数" value={stats.totalFlags} />
            </Col>
            <Col span={6}>
              <MetricCard title="已启用" value={stats.enabledFlags} color={colors.success[500]} />
            </Col>
            <Col span={6}>
              <MetricCard title="总评估次数" value={stats.totalEvaluations} />
            </Col>
            <Col span={6}>
              <MetricCard title="租户级开关" value={stats.tenantScopedFlags} />
            </Col>
          </Row>
        </div>
      )}

      {/* Flag Table */}
      <Card>
        <div style={{ marginBottom: spacing[4] }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            filters={filterDefinitions}
            searchPlaceholder="搜索开关名称或 Key..."
            onFilter={(filters) => {
              if (filters.type) setTypeFilter(String(filters.type));
              if (filters.strategy) setStrategyFilter(String(filters.strategy));
            }}
            initialFilters={{ type: 'all', strategy: 'all' }}
          />
        </div>

        <Table
          columns={columns}
          dataSource={filteredFlags}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{ pageSize: 15, showTotal: (total) => `共 ${total} 个开关` }}
          locale={{ emptyText: apiError ? 'API 不可用，暂无数据' : '暂无特性开关' }}
        />
      </Card>

      <FeatureFlagModals
        createModalVisible={createModalVisible}
        setCreateModalVisible={setCreateModalVisible}
        createForm={createForm}
        handleCreate={handleCreateWrapper}
        editModalVisible={editModalVisible}
        setEditModalVisible={setEditModalVisible}
        editingFlag={editingFlag}
        setEditingFlag={setEditingFlag}
        editForm={editForm}
        handleEdit={handleEditWrapper}
        evaluateModalVisible={evaluateModalVisible}
        setEvaluateModalVisible={setEvaluateModalVisible}
        evaluatingFlag={evaluatingFlag}
        setEvaluatingFlag={setEvaluatingFlag}
        evaluateForm={evaluateForm}
        handleEvaluate={handleEvaluateWrapper}
        evaluationResult={evaluationResult}
        detailModalVisible={detailModalVisible}
        setDetailModalVisible={setDetailModalVisible}
        selectedFlag={selectedFlag}
        setSelectedFlag={setSelectedFlag}
        submitting={submitting}
      />
    </div>
  );
}
