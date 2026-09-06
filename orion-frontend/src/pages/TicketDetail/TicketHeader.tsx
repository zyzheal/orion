/**
 * TicketHeader.tsx - 工单头部 (返回按钮 + 标题 + 徽章 + 操作栏)
 * 抽取自 TicketDetail/index.tsx (P2-9 Phase 58)
 */
import React from 'react';
import { Typography, Button, Space, Tag, Badge, Card } from 'antd';
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  UserOutlined,
  SwapOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { priorityConfig, statusConfig } from './constants';
import type { Ticket } from './types';

const { Title, Text } = Typography;

export interface TicketHeaderProps {
  ticket: Ticket;
  canAssign: boolean;
  canEscalate: boolean;
  canResolve: boolean;
  canClose: boolean;
  canTransfer: boolean;
  onBack: () => void;
  onAssign: () => void;
  onEscalate: () => void;
  onResolve: () => void;
  onClose: () => void;
  onTransfer: () => void;
}

export const TicketHeader: React.FC<TicketHeaderProps> = (props) => {
  const {
    ticket,
    canAssign,
    canEscalate,
    canResolve,
    canClose,
    canTransfer,
    onBack,
    onAssign,
    onEscalate,
    onResolve,
    onClose,
    onTransfer,
  } = props;

  const pConfig = priorityConfig[ticket.priority] || { color: 'default', label: ticket.priority };
  const sConfig = statusConfig[ticket.status] || { color: 'default', label: ticket.status };

  return (
    <>
      {/* Top section: Back, Title, Badges */}
      <div style={{ marginBottom: spacing.md }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          style={{ padding: 0, marginBottom: spacing.sm }}
          data-testid="back-to-tickets"
        >
          返回工单列表
        </Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3], flexWrap: 'wrap' }}>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <FileTextOutlined style={{ marginRight: spacing[2], color: colors.primary[500] }} />
            {ticket.id}
          </Title>
          <Badge
            status={sConfig.color as 'success' | 'warning' | 'error' | 'processing' | 'default'}
            text={sConfig.label}
          />
          <Tag color={pConfig.color} style={{ fontWeight: 500, padding: '2px 12px' }}>
            {pConfig.label}
          </Tag>
        </div>
        <Text type="secondary" style={{ marginLeft: 36 }}>
          {ticket.title}
        </Text>
      </div>

      {/* Action bar */}
      <Card size="small" style={{ marginBottom: spacing.md }}>
        <Space wrap>
          {canAssign && (
            <Button
              type="primary"
              icon={<UserOutlined />}
              onClick={onAssign}
              data-testid="action-assign"
            >
              分配
            </Button>
          )}
          {canEscalate && (
            <Button
              icon={<ArrowUpOutlined />}
              danger={ticket.escalationLevel >= 2}
              onClick={onEscalate}
              data-testid="action-escalate"
            >
              升级 {ticket.escalationLevel > 0 && `(L${ticket.escalationLevel})`}
            </Button>
          )}
          {canResolve && (
            <Button
              icon={<CheckCircleOutlined />}
              onClick={onResolve}
              data-testid="action-resolve"
            >
              解决
            </Button>
          )}
          {canClose && (
            <Button icon={<CloseCircleOutlined />} onClick={onClose} data-testid="action-close">
              关闭
            </Button>
          )}
          {canTransfer && (
            <Button
              icon={<SwapOutlined />}
              onClick={onTransfer}
              data-testid="action-transfer"
            >
              转交
            </Button>
          )}
        </Space>
      </Card>
    </>
  );
};
