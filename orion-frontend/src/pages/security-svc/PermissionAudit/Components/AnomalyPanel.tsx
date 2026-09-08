/**
 * PermissionAudit AnomalyPanel
 * 抽取自 index.tsx (P2-9 Phase 192)
 */
import { Alert, Badge, Card, Space, Tag } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { UEBAAnomaly } from '@/api/permission-audit';

interface AnomalyPanelProps {
  anomalies: UEBAAnomaly[];
}

const severityColor: Record<string, string> = {
  low: 'blue',
  medium: 'orange',
  high: 'red',
  critical: 'magenta',
};

export const AnomalyPanel = ({ anomalies }: AnomalyPanelProps) => {
  if (anomalies.length === 0) return null;
  return (
    <Card
      title={
        <Space>
          <WarningOutlined style={{ color: colors.warning[500] }} />
          异常行为告警 (UEBA)
          <Badge count={anomalies.length} style={{ backgroundColor: colors.error[500] }} />
        </Space>
      }
      style={{ marginBottom: spacing.md }}
    >
      {anomalies.map((anomaly, index) => (
        <Alert
          key={String(index)}
          type={
            anomaly.severity === 'critical' || anomaly.severity === 'high'
              ? 'error'
              : 'warning'
          }
          message={
            <Space>
              <Tag color={severityColor[anomaly.severity] || 'default'}>
                {anomaly.severity.toUpperCase()}
              </Tag>
              <span>{anomaly.message}</span>
            </Space>
          }
          description={`用户: ${anomaly.userId} | 类型: ${anomaly.alertType} | 检测时间: ${new Date(anomaly.timestamp).toLocaleString('zh-CN')}`}
          showIcon
          style={{ marginBottom: spacing.sm }}
        />
      ))}
    </Card>
  );
};
