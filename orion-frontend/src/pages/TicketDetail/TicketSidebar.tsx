/**
 * TicketSidebar.tsx - 工单详情右列 (基本信息 + 负责人 + 升级信息 + 工作流历史)
 * 抽取自 TicketDetail/index.tsx (P2-9 Phase 58)
 */
import React from 'react';
import { Typography, Card, Space, Tag, Descriptions, Avatar, Timeline } from 'antd';
import { UserOutlined, ExclamationCircleOutlined, HistoryOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';
import { categoryLabels, sourceLabels, statusConfig, priorityConfig, historyActionLabels } from './constants';
import type { Ticket } from './types';

const { Text } = Typography;

export interface TicketSidebarProps {
  ticket: Ticket;
  history: any[];
}

export const TicketSidebar: React.FC<TicketSidebarProps> = (props) => {
  const { ticket, history } = props;

  const pConfig = priorityConfig[ticket.priority] || { color: 'default', label: ticket.priority };

  return (
    <>
      <Card title="基本信息" size="small" style={{ marginBottom: spacing.md }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="分类">
            {categoryLabels[ticket.category] || ticket.category}
          </Descriptions.Item>
          <Descriptions.Item label="优先级">
            <Tag color={pConfig.color}>{pConfig.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="来源">
            {sourceLabels[ticket.source] || ticket.source}
          </Descriptions.Item>
          <Descriptions.Item label="报告人">{ticket.reporter}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(ticket.createdAt).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {dayjs(ticket.updatedAt).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="截止时间">
            {dayjs(ticket.dueDate).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="负责人" size="small" style={{ marginBottom: spacing.md }}>
        {ticket.assignee ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <Avatar style={{ background: colors.primary[500] }}>{ticket.assignee[0]}</Avatar>
              <Text strong>{ticket.assignee}</Text>
            </Space>
          </Space>
        ) : (
          <Text type="secondary">
            <UserOutlined /> 未分配
          </Text>
        )}
      </Card>

      {ticket.escalationLevel > 0 && (
        <Card title="升级信息" size="small" style={{ marginBottom: spacing.md }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <ExclamationCircleOutlined style={{ color: colors.error[400] }} />
              <Text strong>当前级别: L{ticket.escalationLevel}</Text>
            </div>
            {Array.from({ length: ticket.escalationLevel }).map((_, i) => (
              <Tag key={String(i)} color={i === ticket.escalationLevel - 1 ? 'red' : 'orange'}>
                升级 {i + 1}
              </Tag>
            ))}
          </Space>
        </Card>
      )}

      <Card
        title={
          <Space>
            <HistoryOutlined />
            工作流历史
          </Space>
        }
        size="small"
      >
        <Timeline
          items={history.map((entry) => ({
            color:
              entry.action === 'created'
                ? 'green'
                : entry.action === 'resolved'
                  ? 'blue'
                  : entry.action === 'escalated'
                    ? 'red'
                    : 'gray',
            children: (
              <div>
                <Text strong>{historyActionLabels[entry.action] || entry.action}</Text>
                {entry.fromStatus && entry.toStatus && (
                  <Text type="secondary">
                    {statusConfig[entry.fromStatus]?.label || entry.fromStatus} →{' '}
                    {statusConfig[entry.toStatus]?.label || entry.toStatus}
                  </Text>
                )}
                {entry.reason && (
                  <div>
                    <Text type="secondary" style={{ fontSize: spacing[3] }}>
                      {entry.reason}
                    </Text>
                  </div>
                )}
                <div>
                  <Text type="secondary" style={{ fontSize: spacing[3] }}>
                    {entry.performedBy} · {dayjs(entry.timestamp).format('MM-DD HH:mm')}
                  </Text>
                </div>
              </div>
            ),
          }))}
        />
        {history.length === 0 && <Text type="secondary">暂无历史记录</Text>}
      </Card>
    </>
  );
};
