import React from 'react';
import { List, Tag, Button, Space } from 'antd';
import type { TriageItem, Severity } from '../../api/triage';

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: 'red',
  warning: 'orange',
  info: 'blue',
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: '严重',
  warning: '警告',
  info: '信息',
};

const STATUS_LABEL: Record<string, string> = {
  open: '待处理',
  acknowledged: '已确认',
  assigned: '已分配',
  in_progress: '处理中',
  resolved: '已解决',
  cancelled: '已取消',
};

interface Props {
  item: TriageItem;
  onAction?: (item: TriageItem, action: 'acknowledge' | 'assign') => void;
}

export const TriageItemRow: React.FC<Props> = ({ item, onAction }) => (
  <List.Item
    aria-label={`${item.title} (${STATUS_LABEL[item.status] ?? item.status})`}
    actions={[
      onAction && item.status === 'open' ? (
        <Button
          key="ack"
          size="small"
          aria-label="确认"
          aria-keyshortcuts="a"
          onClick={(e) => {
            e.stopPropagation();
            onAction(item, 'acknowledge');
          }}
        >
          确认
        </Button>
      ) : null,
      onAction && !item.assigned_to ? (
        <Button
          key="assign"
          size="small"
          aria-label="分配"
          aria-keyshortcuts="d"
          onClick={(e) => {
            e.stopPropagation();
            onAction(item, 'assign');
          }}
        >
          分配
        </Button>
      ) : null,
    ].filter(Boolean) as React.ReactElement[]}
  >
    <List.Item.Meta
      title={
        <Space size={8}>
          <Tag color={SEVERITY_COLOR[item.severity]}>{SEVERITY_LABEL[item.severity]}</Tag>
          <Tag>{item.type}</Tag>
          <span>{item.title}</span>
        </Space>
      }
      description={
        <Space size={8} wrap>
          <Tag>{STATUS_LABEL[item.status] ?? item.status}</Tag>
          {item.assigned_to && <span>→ {item.assigned_to}</span>}
          <span style={{ color: '#999' }}>{new Date(item.created_at).toLocaleString()}</span>
        </Space>
      }
    />
  </List.Item>
);

export default TriageItemRow;
