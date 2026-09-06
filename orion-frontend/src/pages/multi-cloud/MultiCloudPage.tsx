/**
 * Multi-Cloud Management Page (P2-9 Phase 71 - slim)
 *
 * 模块拆分：
 * - ./MultiCloudConfig    颜色 / 标签 / 选项等纯数据常量
 * - ./MultiCloudColumns   表格列定义（含工厂函数模式）
 * - ./MultiCloudModals    注册 / 编辑 / 成本对比弹窗
 * - ./useMultiCloudState  状态 / 数据加载 / 事件处理
 * - ./DashboardSection    资源概览 Dashboard
 */
import React from 'react';
import { Card, Button, Space, Typography, Tabs, Table } from 'antd';
import {
  CloudServerOutlined,
  PlusOutlined,
  ReloadOutlined,
  CloudOutlined,
  DollarOutlined,
  HddOutlined,
} from '@ant-design/icons';
import { colors, spacing, themeVars } from '@/tokens';
import { useMultiCloudState } from './useMultiCloudState';
import { DashboardSection } from './DashboardSection';
import { CreateAccountModal, EditAccountModal, CostComparisonModal } from './MultiCloudModals';

const { Title, Text } = Typography;

const MultiCloudPage: React.FC = () => {
  const {
    accounts,
    resources,
    loading,
    statistics,
    createModalOpen,
    setCreateModalOpen,
    editModalOpen,
    setEditModalOpen,
    setEditingAccount,
    editForm,
    costModalOpen,
    setCostModalOpen,
    costComparison,
    setCostComparison,
    costLoading,
    costTrendData,
    costTrendLoading,
    maxCost,
    stats,
    providerDistribution,
    resourceTypeDistribution,
    accountColumns,
    resourceColumns,
    form,
    costForm,
    loadData,
    handleCreate,
    handleEditSubmit,
    handleCostCompare,
  } = useMultiCloudState();

  const tabItems = [
    {
      key: 'accounts',
      label: (
        <>
          <CloudServerOutlined /> 云账号
        </>
      ),
      children: (
        <Table
          columns={accountColumns}
          dataSource={accounts}
          rowKey="account_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      ),
    },
    {
      key: 'resources',
      label: (
        <>
          <HddOutlined /> 云资源
        </>
      ),
      children: (
        <Table
          columns={resourceColumns}
          dataSource={resources}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg, background: themeVars.bgSecondary, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <CloudOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            多云管理
          </Title>
          <Text type="secondary">统一管理多云账号、资源跟踪、成本分析和跨云编排</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button icon={<DollarOutlined />} onClick={() => setCostModalOpen(true)}>
            成本对比
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            添加云账号
          </Button>
        </Space>
      </div>

      {/* Dashboard */}
      <DashboardSection
        stats={stats}
        statistics={statistics}
        resourceTypeDistribution={resourceTypeDistribution}
        providerDistribution={providerDistribution}
        costTrendData={costTrendData}
        costTrendLoading={costTrendLoading}
        maxCost={maxCost}
        onCostCompare={() => setCostModalOpen(true)}
      />

      {/* Tabs */}
      <Card style={{ borderRadius: 12 }}>
        <Tabs items={tabItems} />
      </Card>

      <CreateAccountModal
        open={createModalOpen}
        form={form}
        onCancel={() => setCreateModalOpen(false)}
        onFinish={handleCreate}
      />

      <EditAccountModal
        open={editModalOpen}
        form={editForm}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingAccount(null);
          editForm.resetFields();
        }}
        onFinish={handleEditSubmit}
      />

      <CostComparisonModal
        open={costModalOpen}
        form={costForm}
        comparison={costComparison}
        loading={costLoading}
        onCancel={() => {
          setCostModalOpen(false);
          setCostComparison([]);
        }}
        onFinish={handleCostCompare}
      />
    </div>
  );
};

export default MultiCloudPage;
