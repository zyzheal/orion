/**
 * Components/DetailDrawer.tsx - 工作流任务详情抽屉
 * 抽取自 WorkflowTasks/index.tsx (P2-9 Phase 99)
 */
import React from 'react';
import { Drawer, Descriptions, Tag, Space, Button, Card, Typography } from 'antd';
import { CheckOutlined, SendOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import PageSkeleton from '@/components/PageSkeleton';
import type { WorkflowTask } from '@/api/workflow-task';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { statusColorMap, statusLabelMap, priorityColorMap, priorityLabelMap } from '../constants';

const { Paragraph } = Typography;

interface DetailDrawerProps {
  open: boolean;
  loading: boolean;
  selectedTask: WorkflowTask | null;
  currentUserId: string;
  openClaimModal: (taskId: string) => void;
  openCompleteModal: (taskId: string) => void;
  onClose: () => void;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
  open,
  loading,
  selectedTask,
  currentUserId,
  openClaimModal,
  openCompleteModal,
  onClose,
}) => {
  const t = selectedTask;

  const detailContent = t ? (
    <div>
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label="任务标题" span={2}>
          {t.title}
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={statusColorMap[t.status]}>{statusLabelMap[t.status]}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="优先级">
          <Tag color={priorityColorMap[t.priority]}>{priorityLabelMap[t.priority]}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="任务类型">
          {t.task_type === 'manual' ? '人工任务' : '系统任务'}
        </Descriptions.Item>
        <Descriptions.Item label="分配类型">
          {t.assignee_type === 'user' ? '用户' : '角色'}
        </Descriptions.Item>
        <Descriptions.Item label="处理人">{t.assignee_id || '-'}</Descriptions.Item>
        <Descriptions.Item label="候选用户">
          {t.candidate_users?.join(', ') || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="候选角色">
          {t.candidate_roles?.join(', ') || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="截止时间">
          {t.due_date ? dayjs(t.due_date).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {dayjs(t.created_at).format('YYYY-MM-DD HH:mm:ss')}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间" span={2}>
          {dayjs(t.updated_at).format('YYYY-MM-DD HH:mm:ss')} ({dayjs(t.updated_at).fromNow()})
        </Descriptions.Item>
        {t.description && (
          <Descriptions.Item label="描述" span={2}>
            <Paragraph style={{ marginBottom: 0 }}>{t.description}</Paragraph>
          </Descriptions.Item>
        )}
        {t.completed_at && (
          <>
            <Descriptions.Item label="完成时间">
              {dayjs(t.completed_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="完成人">{t.completed_by || '-'}</Descriptions.Item>
          </>
        )}
        {t.completion_comment && (
          <Descriptions.Item label="完成评论" span={2}>
            {t.completion_comment}
          </Descriptions.Item>
        )}
      </Descriptions>

      {/* Form Data */}
      {t.form_data && Object.keys(t.form_data).length > 0 && (
        <Card size="small" title="表单数据" style={{ marginTop: spacing.md }}>
          <Descriptions column={1} size="small">
            {Object.entries(t.form_data).map(([key, value]) => (
              <Descriptions.Item key={key} label={key}>
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        </Card>
      )}

      {t.status === 'pending' && (
        <Space style={{ marginTop: spacing.md }}>
          <Button type="primary" icon={<CheckOutlined />} onClick={() => openClaimModal(t.id)}>
            认领任务
          </Button>
        </Space>
      )}
      {t.status === 'assigned' && (
        <Space style={{ marginTop: spacing.md }}>
          <Button
            type="primary"
            icon={<SendOutlined />}
            style={{ backgroundColor: colors.success[500], borderColor: colors.success[500] }}
            onClick={() => openCompleteModal(t.id)}
          >
            完成任务
          </Button>
        </Space>
      )}
    </div>
  ) : null;

  return (
    <Drawer
      title={t ? t.title : '任务详情'}
      open={open}
      onClose={onClose}
      width={720}
      destroyOnClose
    >
      {loading ? <PageSkeleton rows={6} /> : detailContent}
    </Drawer>
  );
};
