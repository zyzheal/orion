/**
 * Environment Management Page
 * Environment list, hibernate state, TTL config, environment templates
 *
 * 拆分结构（P2-9 Phase 29）:
 * - useEnvironmentState.ts: 状态 + loadData + 过滤 + 6 个 CRUD/状态/锁处理器 + filterDefs
 * - EnvironmentColumns.tsx: 10 列表格配置 Hook
 * - EnvironmentCreateModal.tsx: 创建环境 Modal（含模板应用）
 * - EnvironmentEditModal.tsx: 编辑环境 Modal
 * - EnvironmentDetailDrawer.tsx: 环境详情 Drawer（含高级配置 + 快捷操作）
 * - StatCard.tsx: 统计卡组件
 * - constants.ts: 类型/状态颜色标签映射 + 环境模板预设
 */
import React from 'react';
import {
  Typography,
  Button,
  Space,
  Card,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  CloudServerOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { useEnvironmentState } from './useEnvironmentState';
import { useEnvironmentColumns } from './EnvironmentColumns';
import { EnvironmentCreateModal } from './EnvironmentCreateModal';
import { EnvironmentEditModal } from './EnvironmentEditModal';
import { EnvironmentDetailDrawer } from './EnvironmentDetailDrawer';
import { StatCard } from './StatCard';

const { Title, Text } = Typography;

const EnvironmentPage: React.FC = () => {
  const {
    loading,
    setSearchQuery,
    setFilters,
    createModalVisible,
    setCreateModalVisible,
    editModalVisible,
    setEditModalVisible,
    selectedEnv,
    detailDrawerVisible,
    setDetailDrawerVisible,
    createForm,
    editForm,
    submitting,
    loadData,
    filteredData,
    stats,
    handleCreate,
    handleEdit,
    handleDelete,
    handleStatusChange,
    handleLock,
    handleUnlock,
    openEdit,
    openDetail,
    applyTemplate,
    filterDefs,
    envTemplates,
  } = useEnvironmentState();

  const columns = useEnvironmentColumns({
    openDetail,
    openEdit,
    loadData,
    handleDelete,
    handleStatusChange,
    handleLock,
    handleUnlock,
  });

  return (
    <div style={{ padding: 0 }} data-testid="environment-page">
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
            <CloudServerOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            环境管理
          </Title>
          <Text type="secondary">管理项目的部署环境、休眠状态、TTL 配置和环境模板</Text>
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

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <StatCard title="总环境数" value={stats.total} icon={<CloudServerOutlined />} />
        </Col>
        <Col span={6}>
          <StatCard
            title="运行中"
            value={stats.active}
            icon={<PlayCircleOutlined />}
            color={colors.success[500]}
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="休眠中"
            value={stats.hibernated}
            icon={<PauseCircleOutlined />}
            color={colors.warning[500]}
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="维护中"
            value={stats.maintenance}
            icon={<ClockCircleOutlined />}
            color={colors.info[500]}
          />
        </Col>
      </Row>

      {/* Environment List */}
      <Card>
        <div style={{ marginBottom: spacing.md }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={filterDefs}
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
      <EnvironmentCreateModal
        visible={createModalVisible}
        form={createForm}
        submitting={submitting}
        templates={envTemplates}
        onOk={handleCreate}
        onCancel={() => setCreateModalVisible(false)}
        onApplyTemplate={applyTemplate}
      />

      {/* Edit Modal */}
      <EnvironmentEditModal
        visible={editModalVisible}
        form={editForm}
        submitting={submitting}
        onOk={handleEdit}
        onCancel={() => setEditModalVisible(false)}
      />

      {/* Detail Drawer */}
      <EnvironmentDetailDrawer
        visible={detailDrawerVisible}
        env={selectedEnv}
        onClose={() => setDetailDrawerVisible(false)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
};

export default EnvironmentPage;
