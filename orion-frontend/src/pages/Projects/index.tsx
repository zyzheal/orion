/**
 * Project Management Page (M7)
 * List, create, edit, view details, delete projects
 *
 * P2-9 Phase 83: 拆分为 state hook + columns + constants + 2 Modal + 详情 Drawer + 精简主页面
 */
import React, { useMemo } from 'react';
import { Typography, Button, Space, Card } from 'antd';
import { PlusOutlined, ReloadOutlined, FolderOutlined } from '@ant-design/icons';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import PageSkeleton from '@/components/PageSkeleton';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { useProjectState } from './useProjectState';
import { makeProjectColumns, projectFilterDefs } from './ProjectColumns';
import { CreateProjectModal } from './CreateProjectModal';
import { EditProjectModal } from './EditProjectModal';
import { ProjectDetailDrawer } from './ProjectDetailDrawer';

const { Title, Text } = Typography;

const ProjectManagement: React.FC = () => {
  const {
    loading,
    projects,
    setSearchQuery,
    setFilters,
    createModalVisible,
    setCreateModalVisible,
    editModalVisible,
    setEditModalVisible,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedProject,
    projectResources,
    createForm,
    editForm,
    submitting,
    filteredData,
    loadData,
    handleCreate,
    handleEdit,
    handleDelete,
    openEdit,
    openDetail,
  } = useProjectState();

  const columns = useMemo(
    () => makeProjectColumns({ openDetail, openEdit, handleDelete }),
    [openDetail, openEdit, handleDelete],
  );

  const isInitialLoading = loading && projects.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {/* Page loading skeleton (initial load) */}
      {isInitialLoading && <PageSkeleton rows={8} />}

      {isInitialLoading ? null : (
        <>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: spacing.lg,
            }}
          >
            <div>
              <Title level={2} style={{ marginBottom: spacing.sm }}>
                <FolderOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
                项目管理
              </Title>
              <Text type="secondary">管理项目、团队关联和资源分配</Text>
            </div>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                创建项目
              </Button>
            </Space>
          </div>

          {/* Project List */}
          <Card>
            <div style={{ marginBottom: spacing.md }}>
              <SearchFilterBar
                onSearch={setSearchQuery}
                onFilter={setFilters}
                filters={projectFilterDefs}
                searchPlaceholder="搜索项目..."
              />
            </div>
            <Table
              columns={columns}
              dataSource={filteredData}
              loading={loading}
              rowKey="id"
              size="middle"
              striped
            />
          </Card>

          {/* Create Modal */}
          <CreateProjectModal
            visible={createModalVisible}
            form={createForm}
            submitting={submitting}
            onCancel={() => setCreateModalVisible(false)}
            onOk={handleCreate}
          />

          {/* Edit Modal */}
          <EditProjectModal
            visible={editModalVisible}
            form={editForm}
            submitting={submitting}
            onCancel={() => setEditModalVisible(false)}
            onOk={handleEdit}
          />

          {/* Detail Drawer */}
          <ProjectDetailDrawer
            visible={detailDrawerVisible}
            selectedProject={selectedProject}
            projectResources={projectResources}
            onClose={() => setDetailDrawerVisible(false)}
          />
        </>
      )}
    </div>
  );
};

export default ProjectManagement;
