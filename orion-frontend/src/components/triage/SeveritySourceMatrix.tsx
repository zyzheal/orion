import React from 'react';
import { Card, Row, Col, Statistic, Typography } from 'antd';

const { Text } = Typography;

interface Props {
  openBySeverity: Record<string, number>;
  openByStatus: Record<string, number>;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff4d4f',
  warning: '#faad14',
  info: '#1677ff',
};

const STATUS_LABELS: Record<string, string> = {
  open: '待处理',
  acknowledged: '已确认',
  assigned: '已分配',
  in_progress: '处理中',
  resolved: '已解决',
  cancelled: '已取消',
};

export const SeveritySourceMatrix: React.FC<Props> = ({ openBySeverity, openByStatus }) => {
  const severities = ['critical', 'warning', 'info'] as const;

  return (
    <Card size="small" className="orion-card" title="严重度 / 状态分布">
      <Row gutter={[16, 16]}>
        {severities.map((sev) => (
          <Col span={8} key={sev}>
            <Statistic
              title={
                <Text color={SEVERITY_COLORS[sev]}>● {sev}</Text>
              }
              value={openBySeverity[sev] ?? 0}
              valueStyle={{ color: SEVERITY_COLORS[sev] }}
            />
          </Col>
        ))}
      </Row>
      <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {Object.entries(openByStatus || {}).map(([status, count]) => (
          <Text key={status} type="secondary">
            {STATUS_LABELS[status] ?? status}: {count}
          </Text>
        ))}
      </div>
    </Card>
  );
};

export default SeveritySourceMatrix;
