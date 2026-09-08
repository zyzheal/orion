import { Card, Row, Col, Progress, Typography } from 'antd';
import { colors } from '@/tokens';
import { SPACE_CONFIG } from '../constants';

const { Text } = Typography;

interface Props {
  overallScore: number;
}

export function OverallPanel({ overallScore }: Props) {
  return (
    <Card style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <div style={{ textAlign: 'center' }}>
            <Progress type="dashboard" percent={overallScore}
              strokeColor={{ from: colors.primary[400], to: colors.primary[600] }}
              format={() => `${overallScore}%`} />
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>SPACE 综合效能</Text>
          </div>
        </Col>
        <Col span={16}>
          <Row gutter={[16, 8]}>
            {Object.entries(SPACE_CONFIG).map(([key, cfg]) => (
              <Col span={8} key={key}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{cfg.icon}</div>
                  <Text strong>{cfg.label}</Text>
                </Card>
              </Col>
            ))}
          </Row>
        </Col>
      </Row>
    </Card>
  );
}
