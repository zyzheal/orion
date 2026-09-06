/**
 * TicketMainColumn.tsx - 工单详情左列 (描述 + 标签 + SLA + 评论 + 关联 + 转交历史)
 * 抽取自 TicketDetail/index.tsx (P2-9 Phase 58)
 */
import React from 'react';
import { Typography, Card, Space, Tag, Progress, Descriptions, Avatar } from 'antd';
import { TagOutlined, LinkOutlined, SwapOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors, spacing, themeVars } from '@/tokens';
import { relationTypeLabels, relationTypeColors, slaStatusColors } from './constants';
import type { Ticket } from './types';
import type { calculateSLA } from './helpers';
import TicketComments from './TicketComments';

const { Text, Paragraph } = Typography;

type SLAInfo = NonNullable<ReturnType<typeof calculateSLA>>;

export interface TicketMainColumnProps {
  ticket: Ticket;
  sla: SLAInfo | null;
  relations: any[];
  transfers: any[];
  onNavigate: (path: string) => void;
}

export const TicketMainColumn: React.FC<TicketMainColumnProps> = (props) => {
  const { ticket, sla, relations, transfers, onNavigate } = props;

  return (
    <>
      {/* Description */}
      <Card title="工单描述" size="small" style={{ marginBottom: spacing.md }}>
        <Paragraph>{ticket.description}</Paragraph>
      </Card>

      {/* Tags */}
      <Card
        title={
          <Space>
            <TagOutlined />
            标签
          </Space>
        }
        size="small"
        style={{ marginBottom: spacing.md }}
      >
        <Space wrap>
          {Object.entries(ticket.tags).map(([key, value]) => (
            <Tag key={key} color="blue">
              {key}: {value}
            </Tag>
          ))}
        </Space>
      </Card>

      {/* SLA section */}
      {sla && (
        <Card
          title="SLA 信息"
          size="small"
          style={{ marginBottom: spacing.md }}
          data-testid="sla-section"
        >
          <div style={{ marginBottom: spacing[3] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text>已用时间: {sla.elapsed}</Text>
              <Text>总时限: {sla.total}</Text>
            </div>
            <Progress
              percent={sla.percent}
              strokeColor={slaStatusColors[sla.status]}
              status={sla.status === 'danger' ? 'exception' : 'normal'}
            />
          </div>
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="创建时间">
              {dayjs(ticket.createdAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="SLA 截止">
              {dayjs(ticket.dueDate).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="SLA 状态">
              <Tag color={slaStatusColors[sla.status]}>
                {sla.overdue
                  ? '已超时'
                  : sla.status === 'danger'
                    ? '高风险'
                    : sla.status === 'warning'
                      ? '警告'
                      : '正常'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="升级级别">
              {ticket.escalationLevel > 0 ? `L${ticket.escalationLevel}` : '无'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* Comments and Notes */}
      <TicketComments ticketId={ticket.id} />

      {/* Relations */}
      {relations.length > 0 && (
        <Card
          title={
            <Space>
              <LinkOutlined />
              关联工单
            </Space>
          }
          size="small"
          style={{ marginBottom: spacing.md }}
        >
          {relations.map((rel) => (
            <div
              key={rel.relationId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                padding: '8px 0',
                borderBottom: `1px solid ${themeVars.borderLight}`,
              }}
            >
              <Tag color={relationTypeColors[rel.relationType]}>
                {relationTypeLabels[rel.relationType]}
              </Tag>
              <Text
                strong
                style={{ cursor: 'pointer', color: colors.primary[500] }}
                onClick={() => onNavigate(`/tickets/${rel.relatedTicketId}`)}
              >
                {rel.relatedTicketId}
              </Text>
              <Text type="secondary" ellipsis style={{ maxWidth: 300 }}>
                {rel.relatedTicketTitle}
              </Text>
            </div>
          ))}
        </Card>
      )}

      {/* Transfer history */}
      {transfers.length > 0 && (
        <Card
          title={
            <Space>
              <SwapOutlined />
              转交历史
            </Space>
          }
          size="small"
          style={{ marginBottom: spacing.md }}
        >
          {transfers.map((t) => (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                padding: '8px 0',
                borderBottom: `1px solid ${themeVars.borderLight}`,
              }}
            >
              <Avatar size="small">{t.fromEngineer[0]}</Avatar>
              <Text>{t.fromEngineer}</Text>
              <SwapOutlined />
              <Avatar size="small" style={{ background: colors.primary[500] }}>
                {t.toEngineer[0]}
              </Avatar>
              <Text>{t.toEngineer}</Text>
              <Text type="secondary" style={{ marginLeft: 'auto' }}>
                {t.reason}
              </Text>
              <Text type="secondary" style={{ fontSize: spacing[3] }}>
                {dayjs(t.timestamp).format('MM-DD HH:mm')}
              </Text>
            </div>
          ))}
        </Card>
      )}
    </>
  );
};
