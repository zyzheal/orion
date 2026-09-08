/**
 * Problem Management Page
 * Problem lifecycle management with KEDB (Known Error Database) and incident/change linking.
 *
 * 拆分结构（P2-9 Phase 33 + Phase 233）:
 * - useProblemState.tsx: 全部 state + 4 loader + 12 handler（不含 form 校验）
 * - useProblemHandlers.ts: 5 个 form 校验包装器 + 2 个 open modal 包装器
 * - ProblemListTab.tsx: 问题列表 Tab
 * - ProblemDetailTab.tsx: 问题详情 Tab
 * - KEDBTab.tsx: 已知错误库 Tab
 * - ProblemStatsCards.tsx: 4 张 MetricCard 统计条
 * - ProblemModals.tsx: 6 个 Modal（保留原样）
 * - columns.tsx + config.tsx: 列配置 + 状态配置
 * - index.tsx: 组合层
 */
import React from 'react';
import { Form, Tabs, Typography } from 'antd';
import {
  BookOutlined,
  BugOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { Layout } from '@/components/Layout';
import { colors, spacing } from '@/tokens';
import { useProblemState } from './useProblemState';
import { useProblemHandlers } from './useProblemHandlers';
import { ProblemStatsCards } from './ProblemStatsCards';
import { ProblemListTab } from './ProblemListTab';
import { ProblemDetailTab } from './ProblemDetailTab';
import { KEDBTab } from './KEDBTab';
import { ProblemModals } from './ProblemModals';

const { Title, Text } = Typography;

const ProblemPage: React.FC = () => {
  const s = useProblemState();

  // Forms (owned here since ProblemModals needs them; state hook handlers take values)
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [linkForm] = Form.useForm();
  const [kedbForm] = Form.useForm();
  const [kedbEditForm] = Form.useForm();

  const {
    handleCreate,
    handleEdit,
    handleLinkIncident,
    handleLinkChange,
    handleCreateKnownError,
    handleEditKnownError,
    handleOpenEditModal,
    handleOpenKedbEditModal,
  } = useProblemHandlers({
    state: s,
    createForm,
    editForm,
    linkForm,
    kedbForm,
    kedbEditForm,
  });

  const tabItems = [
    {
      key: 'list',
      label: <span><BugOutlined /> 问题列表</span>,
      children: (
        <ProblemListTab
          problems={s.problems}
          totalProblems={s.totalProblems}
          currentPage={s.currentPage}
          setCurrentPage={s.setCurrentPage}
          pageSize={s.pageSize}
          setPageSize={s.setPageSize}
          loading={s.loading}
          filters={s.filters}
          setFilters={s.setFilters}
          searchQuery={s.searchQuery}
          setSearchQuery={s.setSearchQuery}
          setCreateModalVisible={s.setCreateModalVisible}
          loadProblems={s.loadProblems}
          loadStats={s.loadStats}
          handleViewDetail={s.handleViewDetail}
          handleOpenEditModal={handleOpenEditModal}
          handleDelete={s.handleDelete}
        />
      ),
    },
    {
      key: 'detail',
      label: <span><EyeOutlined /> 问题详情</span>,
      children: (
        <ProblemDetailTab
          selectedProblem={s.selectedProblem}
          detailLoading={s.detailLoading}
          statusUpdating={s.statusUpdating}
          setActiveTab={s.setActiveTab}
          handleStatusTransition={s.handleStatusTransition}
          handleOpenEditModal={handleOpenEditModal}
          linkFormReset={linkForm.resetFields}
          setLinkIncidentModalVisible={s.setLinkIncidentModalVisible}
          setLinkChangeModalVisible={s.setLinkChangeModalVisible}
        />
      ),
    },
    {
      key: 'kedb',
      label: <span><BookOutlined /> 已知错误库</span>,
      children: (
        <KEDBTab
          knownErrors={s.knownErrors}
          kedbLoading={s.kedbLoading}
          kedbTotal={s.kedbTotal}
          kedbPage={s.kedbPage}
          setKedbPage={s.setKedbPage}
          kedbPageSize={s.kedbPageSize}
          setKedbPageSize={s.setKedbPageSize}
          kedbFilters={s.kedbFilters}
          setKedbFilters={s.setKedbFilters}
          setKedbModalVisible={s.setKedbModalVisible}
          loadKnownErrors={s.loadKnownErrors}
          handleOpenKedbEditModal={handleOpenKedbEditModal}
          handleDeleteKnownError={s.handleDeleteKnownError}
        />
      ),
    },
  ];

  return (
    <Layout>
      <div style={{ padding: 0 }}>
        <div style={{ marginBottom: spacing.lg }}>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <BugOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            问题管理
          </Title>
          <Text type="secondary">管理问题生命周期，关联事件和变更，维护已知错误数据库</Text>
        </div>

        <ProblemStatsCards stats={s.stats} />

        <Tabs
          activeKey={s.activeTab}
          onChange={s.setActiveTab}
          items={tabItems}
          size="large"
        />

        <ProblemModals
          createModalVisible={s.createModalVisible}
          setCreateModalVisible={s.setCreateModalVisible}
          createForm={createForm}
          handleCreate={handleCreate}
          editModalVisible={s.editModalVisible}
          setEditModalVisible={s.setEditModalVisible}
          editForm={editForm}
          handleEdit={handleEdit}
          linkIncidentModalVisible={s.linkIncidentModalVisible}
          setLinkIncidentModalVisible={s.setLinkIncidentModalVisible}
          linkForm={linkForm}
          handleLinkIncident={handleLinkIncident}
          linkingLoading={s.linkingLoading}
          linkChangeModalVisible={s.linkChangeModalVisible}
          setLinkChangeModalVisible={s.setLinkChangeModalVisible}
          handleLinkChange={handleLinkChange}
          kedbModalVisible={s.kedbModalVisible}
          setKedbModalVisible={s.setKedbModalVisible}
          kedbForm={kedbForm}
          handleCreateKnownError={handleCreateKnownError}
          kedbEditModalVisible={s.kedbEditModalVisible}
          setKedbEditModalVisible={s.setKedbEditModalVisible}
          kedbEditForm={kedbEditForm}
          handleEditKnownError={handleEditKnownError}
          setEditingKnownError={s.setEditingKnownError}
        />
      </div>
    </Layout>
  );
};

export default ProblemPage;
