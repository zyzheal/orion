/**
 * Problem Management Page
 * Problem lifecycle management with KEDB (Known Error Database) and incident/change linking.
 *
 * 拆分结构（P2-9 Phase 33）:
 * - useProblemState.tsx: 全部 state + 4 loader + 12 handler（不含 form 校验）
 * - ProblemListTab.tsx: 问题列表 Tab (SearchFilterBar + Table)
 * - ProblemDetailTab.tsx: 问题详情 Tab (Descriptions + 状态流转 + 关联项)
 * - KEDBTab.tsx: 已知错误库 Tab
 * - ProblemStatsCards.tsx: 4 张 MetricCard 统计条
 * - ProblemModals.tsx: 6 个 Modal（保留原样）
 * - columns.tsx + config.tsx: 保留（列配置 + 状态配置）
 */
import React from 'react';
import { Typography, Form, Tabs, Spin } from 'antd';
import {
  BugOutlined,
  EyeOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { Layout } from '@/components/Layout';
import { colors, spacing } from '@/tokens';
import { useProblemState } from './useProblemState';
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

  // ---- Wrapper handlers that call form.validateFields() then state hook handler ----
  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await s.handleCreate(values);
      createForm.resetFields();
    } catch {}
  };

  const handleEdit = async () => {
    try {
      const values = await editForm.validateFields();
      await s.handleEdit(values);
      editForm.resetFields();
    } catch {}
  };

  const handleLinkIncident = async () => {
    try {
      const values = await linkForm.validateFields();
      await s.handleLinkIncident(values.id);
      linkForm.resetFields();
    } catch {}
  };

  const handleLinkChange = async () => {
    try {
      const values = await linkForm.validateFields();
      await s.handleLinkChange(values.id);
      linkForm.resetFields();
    } catch {}
  };

  const handleCreateKnownError = async () => {
    try {
      const values = await kedbForm.validateFields();
      await s.handleCreateKnownError(values);
      kedbForm.resetFields();
    } catch {}
  };

  const handleEditKnownError = async () => {
    try {
      const values = await kedbEditForm.validateFields();
      await s.handleEditKnownError(values);
      kedbEditForm.resetFields();
    } catch {}
  };

  const handleOpenEditModal = (problem: import('@/api/problem').Problem) => {
    s.setSelectedProblem(problem);
    editForm.setFieldsValue({
      title: problem.title,
      description: problem.description,
      severity: problem.severity,
      category: problem.category,
      assigned_to: problem.assigned_to,
      root_cause: problem.root_cause,
      workaround: problem.workaround,
      resolution: problem.resolution,
    });
    s.setEditModalVisible(true);
  };

  const handleOpenKedbEditModal = (ke: import('@/api/problem').KnownError) => {
    s.setEditingKnownError(ke);
    kedbEditForm.setFieldsValue({
      title: ke.title,
      description: ke.description,
      symptoms: ke.symptoms,
      root_cause: ke.root_cause,
      workaround: ke.workaround,
      keywords: ke.keywords?.join(', '),
      status: ke.status,
    });
    s.setKedbEditModalVisible(true);
  };

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
        {/* Page header */}
        <div style={{ marginBottom: spacing.lg }}>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <BugOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            问题管理
          </Title>
          <Text type="secondary">管理问题生命周期，关联事件和变更，维护已知错误数据库</Text>
        </div>

        <ProblemStatsCards stats={s.stats} />

        <Spin spinning={s.loading}>
          <Tabs activeKey={s.activeTab} onChange={s.setActiveTab} items={tabItems} size="large" />
        </Spin>

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
