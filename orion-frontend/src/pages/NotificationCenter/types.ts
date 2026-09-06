/**
 * NotificationCenter - Shared types
 * Centralised here so index.tsx / columns.tsx / NotificationCenterModals.tsx
 * all reference the same contracts without circular imports.
 */

/** Local type for notification data (matches API response shape) */
export interface NotificationItem {
  id: string;
  title: string;
  content: string;
  type:
    | 'ticket_assigned'
    | 'ticket_escalated'
    | 'sla_warning'
    | 'sla_breached'
    | 'pipeline_completed'
    | 'system_alert'
    | 'comment_mention'
    | 'transfer_request';
  priority: 'critical' | 'high' | 'medium' | 'low';
  read: boolean;
  createdAt: string;
  relatedId?: string;
  sender: string;
  actions?: Array<{ label: string; type: string }>;
}

export type NotificationType = NotificationItem['type'];
export type NotificationPriority = NotificationItem['priority'];

/** Summary counters rendered in the top stats row */
export interface NotificationStats {
  unread: number;
  critical: number;
  today: number;
  thisWeek: number;
}

/** Values accepted by the Ant Design `Button` `type` prop */
export type NotificationButtonKind =
  | 'primary'
  | 'default'
  | 'link'
  | 'text'
  | 'dashed'
  | undefined;
