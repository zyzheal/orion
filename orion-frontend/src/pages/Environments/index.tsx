/**
 * Environment Management Page
 * List, create, edit, view detail, and manage status of deployment environments
 *
 * P2-9 Phase 82: 拆分为 state hook + columns + constants + 2 Modal + 详情 Drawer + 精简主页面
 */
import React, { useMemo } from 'react';
import { Typography, Button, Space, Card } from 'antd';
import { PlusOutlined, ReloadOutlined, EnvironmentOutlined } from '@ant-design/icons';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { useEnvironmentState } from './useEnvironmentState';
import { makeEnvironmentColumns, environmentFilterDefs } from './EnvironmentColumns';
import { CreateEnvironmentModal } from './CreateEnvironmentModal';
import { EditEnvironmentModal } from './EditEnvironmentModal';
import { EnvironmentDetailDrawer } from './EnvironmentDetailDrawer';

const { Title, Text } = Typography;

const EnvironmentManagement: React.FC = () => {
  const {
    loading,
    setSearchQuery,
    setFilters,
    createModalVisible,
    setCreateModalVisible,
    editModalVisible,
    setEditModalVisible,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedEnv,
    createForm,
    editForm,
    submitting,
    filteredData,
    loadData,
    handleCreate,
    handleEdit,
    handleDelete,
    handleStatusChange,
    openEdit,
    openDetail,
  } = useEnvironmentState();

  const columns = useMemo(
    () => makeEnvironmentColumns({ openDetail, openEdit, handleDelete, handleStatusChange }),
    [openDetail, openEdit, handleDelete, handleStatusChange],
  );

  return (
    <div style={{ padding: 0 }}>
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
            <EnvironmentOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            环境管理
          </Title>
          <Text type="secondary">管理项目的部署环境（开发、测试、预发、生产）</Text>
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
            创建环境
          </Button>
        </Space>
      </div>

      {/* Environment List */}
      <Card>
        <div style={{ marginBottom: spacing.md }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={environmentFilterDefs}
            searchPlaceholder="搜索环境名称、集群、命名空间..."
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
      <CreateEnvironmentModal
        visible={createModalVisible}
        form={createForm}
        submitting={submitting}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
      />

      {/* Edit Modal */}
      <EditEnvironmentModal
        visible={editModalVisible}
        form={editForm}
        submitting={submitting}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleEdit}
      />

      {/* Detail Drawer */}
      <EnvironmentDetailDrawer
        visible={detailDrawerVisible}
        selectedEnv={selectedEnv}
        onClose={() => setDetailDrawerVisible(false)}
        handleStatusChange={handleStatusChange}
      />
    </div>
  );
};

export default EnvironmentManagement;
