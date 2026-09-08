/**
 * OnCall Management Page
 * Schedule management, rotation viewing, and override operations
 * P2-9 Phase 78: 拆分为 state hook + columns + detail content + 精简主页面
 * P2-9 Phase 274: 157->77 行 (-51%), 新增 Components/PageHeader.tsx + Components/DetailContent.tsx
 */
import React, { useMemo } from 'react';
import { Card, Table as AntTable } from 'antd';
import { OnCallModals } from './OnCallModals';
import PageSkeleton from '@/components/PageSkeleton';
import { useOnCallState } from './useOnCallState';
import { makeOnCallColumns } from './OnCallColumns';
import { PageHeader } from './Components/PageHeader';
import { makeDetailContentFactory } from './Components/DetailContent';

const OnCallManagement: React.FC = () => {
  const state = useOnCallState();
  const { loading, schedules, currentOnCall, resolveUserName, loadData, createForm } = state;

  const columns = useMemo(
    () => makeOnCallColumns({
      currentOnCall,
      resolveUserName,
      openDetail: state.openDetail,
      openOverrideModal: state.openOverrideModal,
      handleDelete: state.handleDelete,
    }),
    [currentOnCall, resolveUserName, state.openDetail, state.openOverrideModal, state.handleDelete],
  );

  const isInitialLoading = loading && schedules.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {isInitialLoading && <PageSkeleton rows={8} />}

      {isInitialLoading ? null : (
        <>
          <PageHeader
            loading={loading}
            onRefresh={loadData}
            onCreateClick={() => {
              state.setCreateModalVisible(true);
              createForm.resetFields();
              state.setMemberInput('');
            }}
          />

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

          <OnCallModals
            renderDetailContent={makeDetailContentFactory(state)}
            resolveUserName={resolveUserName}
            createModalVisible={state.createModalVisible}
            setCreateModalVisible={state.setCreateModalVisible}
            overrideModalVisible={state.overrideModalVisible}
            setOverrideModalVisible={state.setOverrideModalVisible}
            detailDrawerVisible={state.detailDrawerVisible}
            setDetailDrawerVisible={state.setDetailDrawerVisible}
            selectedSchedule={state.selectedSchedule}
            setSelectedSchedule={state.setSelectedSchedule}
            createForm={state.createForm}
            overrideForm={state.overrideForm}
            submitting={state.submitting}
            setSubmitting={state.setSubmitting}
            memberInput={state.memberInput}
            setMemberInput={state.setMemberInput}
            handleCreate={state.handleCreate}
            handleCreateOverride={state.handleCreateOverride}
            schedules={schedules}
            userMap={state.userMap}
            usersLoading={state.usersLoading}
          />
        </>
      )}
    </div>
  );
};

export default OnCallManagement;
