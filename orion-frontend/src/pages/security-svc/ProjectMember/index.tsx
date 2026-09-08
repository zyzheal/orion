/**
 * Project Member Management Page
 * 项目成员管理界面
 * 组件化重构 (P2-9 Phase 264): 180→33行, 4 文件拆分
 */
import React from 'react';
import { Card, Table } from 'antd';
import { spacing } from '@/tokens';
import { useProjectMemberState } from './useProjectMemberState';
import { PageHeader } from './Components/PageHeader';
import { buildColumns } from './Components/Columns';
import { AddMemberModal } from './Components/AddMemberModal';

interface Props {
  projectId?: string;
}

const ProjectMemberManagement: React.FC<Props> = ({ projectId: propProjectId }) => {
  const state = useProjectMemberState(propProjectId);
  const {
    loading, members, modalOpen, setModalOpen,
    projectId, setProjectId, form,
    fetchMembers, handleAdd, handleRemove,
  } = state;

  const columns = buildColumns(handleRemove);

  return (
    <div style={{ padding: spacing.lg }}>
      <Card
        title="项目成员管理"
        extra={
          <PageHeader
            projectId={projectId}
            onSearchProject={setProjectId}
            onRefresh={fetchMembers}
            onOpenAdd={() => setModalOpen(true)}
          />
        }
      >
        <Table
          dataSource={members}
          columns={columns}
          rowKey="user_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <AddMemberModal
        open={modalOpen}
        form={form}
        onOk={handleAdd}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
      />
    </div>
  );
};

export default ProjectMemberManagement;
