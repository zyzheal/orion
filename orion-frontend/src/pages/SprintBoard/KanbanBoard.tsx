/**
 * KanbanBoard - Sprint 看板列渲染组件
 * 抽取自 index.tsx renderKanbanBoard
 */
import React from 'react';
import {
  Typography,
  Card,
  Tag,
  Row,
  Col,
  Empty,
  Popconfirm,
  Badge,
  Button,
} from 'antd';
import { colors, spacing, componentRadius, shadows, themeVars } from '@/tokens';
import type { SprintBoard } from '@/api/sprints';
import { kanbanColumnLabels, priorityColor, priorityLabel } from './constants';

const { Text } = Typography;

export interface KanbanBoardProps {
  selectedSprintId: string | null;
  boardData: SprintBoard | null;
  boardLoading: boolean;
  handleRemoveTicket: (ticketId: string) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  selectedSprintId,
  boardData,
  boardLoading,
  handleRemoveTicket,
}) => {
  if (!selectedSprintId) {
    return (
      <Empty
        description="请先在下方列表中选择一个 Sprint"
        style={{ marginTop: spacing.xl * 2 }}
      />
    );
  }

  if (boardLoading) {
    return (
      <div style={{ textAlign: 'center', padding: spacing.xl * 2 }}>
        <Text type="secondary">加载中...</Text>
      </div>
    );
  }

  if (!boardData || !boardData.columns || Object.keys(boardData.columns).length === 0) {
    return <Empty description="看板数据为空" />;
  }

  const columnKeys = Object.keys(boardData.columns);

  return (
    <div
      style={{
        display: 'flex',
        gap: spacing.md,
        overflowX: 'auto',
        paddingBottom: spacing.md,
      }}
    >
      {columnKeys.map((colKey) => {
        const tickets = boardData.columns[colKey] ?? [];
        return (
          <div
            key={colKey}
            style={{
              minWidth: 280,
              flex: '0 0 280px',
              background: themeVars.bgSecondary,
              borderRadius: componentRadius.card,
              padding: spacing.md,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing.sm,
              }}
            >
              <Text strong>{kanbanColumnLabels[colKey] ?? colKey}</Text>
              <Badge count={tickets.length} style={{ backgroundColor: colors.primary[500] }} />
            </div>

            {tickets.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: spacing.lg,
                  color: colors.neutral[400],
                  fontSize: 13,
                }}
              >
                暂无工单
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {tickets.map((ticket) => (
                  <Card
                    key={ticket.ticketId}
                    size="small"
                    style={{
                      borderRadius: componentRadius.input,
                      boxShadow: shadows.xs,
                      cursor: 'pointer',
                    }}
                    styles={{ body: { padding: spacing.sm } }}
                  >
                    <div style={{ marginBottom: 4 }}>
                      <Text strong style={{ fontSize: 13 }}>
                        {ticket.title}
                      </Text>
                    </div>
                    <Row justify="space-between" align="middle">
                      <Col>
                        <Tag
                          color={priorityColor[ticket.priority]}
                          style={{ borderRadius: componentRadius.tag, fontSize: 11 }}
                        >
                          {priorityLabel[ticket.priority] ?? ticket.priority}
                        </Tag>
                      </Col>
                      <Col>
                        {ticket.assignee ? (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {ticket.assignee}
                          </Text>
                        ) : (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            未分配
                          </Text>
                        )}
                      </Col>
                    </Row>
                    <div style={{ marginTop: 6, textAlign: 'right' }}>
                      <Popconfirm
                        title="确认从 Sprint 移除？"
                        onConfirm={() => handleRemoveTicket(ticket.ticketId)}
                      >
                        <Button type="link" size="small" danger>
                          移除
                        </Button>
                      </Popconfirm>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
