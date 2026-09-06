/**
 * OnCall Management Page
 * Schedule management, rotation viewing, and override operations
 * P2-9 Phase 78: 拆分为 state hook + columns + detail content + 精简主页面
 */
import React, { useMemo } from 'react';
import { Typography, Button, Space, Card, Table as AntTable } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { OnCallModals } from './OnCallModals';
import PageSkeleton from '@/components/PageSkeleton';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { useOnCallState } from './useOnCallState';
import { makeOnCallColumns } from './OnCallColumns';
import { OnCallDetailContent } from './OnCallDetailContent';

const { Title, Text } = Typography;

const OnCallManagement: React.FC = () => {
  const {
    loading,
    schedules,
    createModalVisible,
    setCreateModalVisible,
    overrideModalVisible,
    setOverrideModalVisible,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedSchedule,
    setSelectedSchedule,
    currentOnCall,
    overrides,
    createForm,
    overrideForm,
    submitting,
    setSubmitting,
    memberInput,
    setMemberInput,
    userMap,
    usersLoading,
    resolveUserName,
    loadData,
    loadUsers,
    loadCurrentOnCall,
    handleCreate,
    handleDelete,
    openOverrideModal,
    handleCreateOverride,
    openDetail,
    getAssignmentsForSchedule,
    getOverridesForSchedule,
  } = useOnCallState();

  const columns = useMemo(
    () => makeOnCallColumns({ currentOnCall, resolveUserName, openDetail, openOverrideModal, handleDelete }),
    [currentOnCall, resolveUserName, openDetail, openOverrideModal, handleDelete],
  );

  const renderDetailContent = () => (
    <OnCallDetailContent
      selectedSchedule={selectedSchedule}
      currentOnCall={currentOnCall}
      resolveUserName={resolveUserName}
      getAssignmentsForSchedule={getAssignmentsForSchedule}
      getOverridesForSchedule={getOverridesForSchedule}
    />
  );

  const isInitialLoading = loading && schedules.length === 0;

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
                <ClockCircleOutlined
                  style={{ marginRight: spacing[3], color: colors.primary[500] }}
                />
                OnCall 值班管理
              </Title>
              <Text type="secondary">管理值班排班、轮换分配和代班设置</Text>
            </div>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setCreateModalVisible(true);
                  createForm.resetFields();
                  setMemberInput('');
                }}
              >
                创建排班
              </Button>
            </Space>
          </div>

          {/* Schedule List */}
          <Card>
            <AntTable
              columns={columns}
              dataSource={schedules}
              rowKey="id"
              loading={loading}
              size="middle"
              pagination={false}
            />
          </Card>

          {/* Create Schedule Modal */}
          <OnCallModals
            renderDetailContent={renderDetailContent}
            resolveUserName={resolveUserName}
            createModalVisible={createModalVisible}
            setCreateModalVisible={setCreateModalVisible}
            overrideModalVisible={overrideModalVisible}
            setOverrideModalVisible={setOverrideModalVisible}
            detailDrawerVisible={detailDrawerVisible}
            setDetailDrawerVisible={setDetailDrawerVisible}
            selectedSchedule={selectedSchedule}
            setSelectedSchedule={setSelectedSchedule}
            createForm={createForm}
            overrideForm={overrideForm}
            submitting={submitting}
            setSubmitting={setSubmitting}
            memberInput={memberInput}
            setMemberInput={setMemberInput}
            handleCreate={handleCreate}
            handleCreateOverride={handleCreateOverride}
            schedules={schedules}
            userMap={userMap}
            usersLoading={usersLoading}
          />
        </>
      )}
    </div>
  );
};

export default OnCallManagement;
