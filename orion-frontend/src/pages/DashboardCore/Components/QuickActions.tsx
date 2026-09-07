/**
 * Dashboard quick actions panel
 * 抽取自 index.tsx (P2-9 Phase 156)
 */
import { Card, Row, Col, Typography } from 'antd';
import { spacing } from '@/tokens';
import { useNavigate } from 'react-router-dom';
import CardPanel from '@/components/CardPanel';
import { QUICK_ACTIONS, QUICK_ACTION_ICONS } from '../constants';

const { Text } = Typography;

export const QuickActions = () => {
  const navigate = useNavigate();
  return (
    <CardPanel title="快速操作">
      <Row gutter={[12, 12]}>
        {QUICK_ACTIONS.map((action) => (
          <Col span={12} key={action.name}>
            <Card
              hoverable
              size="small"
              style={{
                textAlign: 'center',
                cursor: 'pointer',
                height: 100,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                transition: 'all 0.3s',
              }}
              onClick={() => navigate(action.path)}
            >
              <div
                style={{
                  fontSize: 28,
                  color: action.color,
                  marginBottom: spacing.sm,
                }}
              >
                {QUICK_ACTION_ICONS[action.icon]}
              </div>
              <Text style={{ fontSize: spacing[3] }}>{action.name}</Text>
            </Card>
          </Col>
        ))}
      </Row>
    </CardPanel>
  );
};
