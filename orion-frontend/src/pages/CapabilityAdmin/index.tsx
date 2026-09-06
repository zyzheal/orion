/**
 * Capability Admin - 能力权限配置页面
 * P2-9 Phase 86: 主页面拆分 (658→~140 行)
 * 3 个表格列配置 + 3 个 Modal + 状态 Hook 已抽取
 */
import React from 'react';
import { Table, Button, Space, Tabs } from 'antd';
import {
  PlusOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  AuditOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import { useCapabilityAdminState } from './useCapabilityAdminState';
import { makeCapabilityColumns, makeTempPermColumns, auditColumns } from './columns';
import { CapabilityModal } from './Modals/CapabilityModal';
import { GrantTemporaryModal } from './Modals/GrantTemporaryModal';
import { RequestPermissionModal } from './Modals/RequestPermissionModal';

export const CapabilityAdmin: React.FC = () => {
  const {
    loading,
    capabilities,
    modalVisible,
    setModalVisible,
    setTempPermModalVisible,
    setRequestModalVisible,
    modalType,
    form,
    tempPerms,
    tempPermLoading,
    tempPermModalVisible,
    tempPermForm,
    auditLogs,
    auditLoading,
    auditTotal,
    auditPage,
    requestModalVisible,
    requestForm,
    loadAuditLogs,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSubmit,
    handleGrantTempPerm,
    handleRevokeTempPerm,
    handleRequestPermission,
    handleCleanup,
    handleCleanupTempPerm,
    handleRequestPermissionOpen,
  } = useCapabilityAdminState();

  const capabilityColumns = makeCapabilityColumns(handleEdit, handleDelete);
  const tempPermColumns = makeTempPermColumns(handleRevokeTempPerm);

  const tabItems = [
    {
      key: 'capabilities',
      label: (
        <span>
          <SafetyCertificateOutlined /> 能力管理
        </span>
      ),
      children: (
        <Table
          columns={capabilityColumns}
          dataSource={capabilities}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      ),
    },
    {
      key: 'temporary',
      label: (
        <span>
          <ClockCircleOutlined /> 临时权限
        </span>
      ),
      children: (
        <Table
          columns={tempPermColumns}
          dataSource={tempPerms}
          rowKey="id"
          loading={tempPermLoading}
          pagination={{ pageSize: 20 }}
        />
      ),
    },
    {
      key: 'audit',
      label: (
        <span>
          <AuditOutlined /> 审计日志
        </span>
      ),
      children: (
        <Table
          columns={auditColumns}
          dataSource={auditLogs}
          rowKey="id"
          loading={auditLoading}
          pagination={{
            pageSize: 20,
            total: auditTotal,
            current: auditPage,
            onChange: (page) => loadAuditLogs(page),
          }}
        />
      ),
    },
  ];

  return (
    <div className="capability-admin" style={{ padding: spacing.md }}>
      <Tabs
        defaultActiveKey="capabilities"
        items={tabItems}
        tabBarExtraContent={
          <Space>
            <Button onClick={handleCleanup} icon={<ClockCircleOutlined />}>
              清理过期
            </Button>
            <Button onClick={handleCleanupTempPerm} icon={<PlusOutlined />}>
              授予临时权限
            </Button>
            <Button type="primary" onClick={handleRequestPermissionOpen} icon={<SendOutlined />}>
              申请权限
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新建能力
            </Button>
          </Space>
        }
      />

      <CapabilityModal
        visible={modalVisible}
        modalType={modalType}
        form={form}
        capabilities={capabilities}
        onSubmit={handleSubmit}
        onCancel={() => setModalVisible(false)}
      />

      <GrantTemporaryModal
        visible={tempPermModalVisible}
        form={tempPermForm}
        capabilities={capabilities}
        onSubmit={handleGrantTempPerm}
        onCancel={() => setTempPermModalVisible(false)}
      />

      <RequestPermissionModal
        visible={requestModalVisible}
        form={requestForm}
        capabilities={capabilities}
        onSubmit={handleRequestPermission}
        onCancel={() => setRequestModalVisible(false)}
      />
    </div>
  );
};

export default CapabilityAdmin;
