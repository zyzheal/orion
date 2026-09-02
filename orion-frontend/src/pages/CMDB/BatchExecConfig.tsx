/**
 * BatchExecPage configuration constants and pure utility functions.
 * Extracted from BatchExecPage.tsx (P2-9 refactor).
 *
 * Only contains self-contained constants / pure functions.
 * No stateful logic, no handlers, no page-context dependencies.
 */
import { Progress, Row, Col, Statistic, Space, Tag } from 'antd';
import type { UploadTask } from '@/api/visor-exec';
import { colors, spacing } from '@/tokens';

// ============================================================================
// Exec Record Status Maps
// ============================================================================

export const EXEC_STATUS_COLOR_MAP: Record<string, string> = {
  pending: 'blue',
  running: 'orange',
  success: 'green',
  failed: 'red',
  partial: 'orange',
};

export const EXEC_STATUS_LABEL_MAP: Record<string, string> = {
  pending: '等待中',
  running: '执行中',
  success: '成功',
  failed: '失败',
  partial: '部分成功',
};

// ============================================================================
// Upload Task Status Maps
// ============================================================================

export const UPLOAD_TASK_STATUS_COLOR_MAP: Record<string, string> = {
  pending: 'blue',
  running: 'orange',
  success: 'green',
  failed: 'red',
  partial: 'orange',
};

export const UPLOAD_TASK_STATUS_LABEL_MAP: Record<string, string> = {
  pending: '等待中',
  running: '上传中',
  success: '成功',
  failed: '失败',
  partial: '部分成功',
};

// ============================================================================
// Template Category Options
// ============================================================================

export const TEMPLATE_CATEGORY_OPTIONS = [
  { label: '系统检查', value: '系统检查' },
  { label: '服务检查', value: '服务检查' },
  { label: '系统维护', value: '系统维护' },
  { label: '自定义', value: '自定义' },
] as const;

// ============================================================================
// Tab Keys
// ============================================================================

export const BATCH_EXEC_TAB_KEYS = {
  exec: 'exec',
  templates: 'templates',
  cron: 'cron',
  upload: 'upload',
} as const;

// ============================================================================
// File Size Formatter (pure utility)
// ============================================================================

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// Render Helpers (pure, no state)
// ============================================================================

export function renderUploadTaskStatusTag(v: UploadTask['status']): React.ReactElement {
  return (
    <Tag color={UPLOAD_TASK_STATUS_COLOR_MAP[v]}>{UPLOAD_TASK_STATUS_LABEL_MAP[v]}</Tag>
  );
}

export function renderUploadTaskProgress(
  percent: number,
  record: UploadTask,
): React.ReactElement {
  return (
    <Progress
      percent={percent}
      size="small"
      status={
        record.status === 'failed'
          ? 'exception'
          : record.status === 'success'
            ? 'success'
            : 'active'
      }
    />
  );
}

export function renderHostTags(hostnames: string[]): React.ReactElement {
  return (
    <Space wrap>
      {hostnames.slice(0, 2).map((name, i) => (
        <Tag key={String(i)}>
          {name}
        </Tag>
      ))}
      {hostnames.length > 2 && <Tag>+{hostnames.length - 2}</Tag>}
    </Space>
  );
}

// ============================================================================
// Page-level Stats Row (pure render, data as props)
// ============================================================================

export function renderStatsRow(stats: {
  total: number;
  success: number;
  partial: number;
  failed: number;
}): React.ReactElement {
  return (
    <Row gutter={16} style={{ marginBottom: spacing.md }}>
      <Col span={6}>
        <Statistic title="执行总数" value={stats.total} />
      </Col>
      <Col span={6}>
        <Statistic
          title="成功"
          value={stats.success}
          valueStyle={{ color: colors.success[500] }}
        />
      </Col>
      <Col span={6}>
        <Statistic
          title="部分成功"
          value={stats.partial}
          valueStyle={{ color: colors.warning[500] }}
        />
      </Col>
      <Col span={6}>
        <Statistic
          title="失败"
          value={stats.failed}
          valueStyle={{ color: colors.error[500] }}
        />
      </Col>
    </Row>
  );
}
