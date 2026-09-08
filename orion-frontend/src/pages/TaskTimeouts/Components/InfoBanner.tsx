/**
 * TaskTimeouts InfoBanner
 * 抽取自 index.tsx (P2-9 Phase 200)
 */
import { Card, Space, Typography } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Text } = Typography;

export const InfoBanner = () => (
  <Card
    style={{ marginBottom: spacing.lg, borderRadius: 12 }}
    bodyStyle={{ padding: '12px 16px' }}
  >
    <Space>
      <QuestionCircleOutlined style={{ color: colors.info[500] }} />
      <Text type="secondary" style={{ fontSize: 12 }}>
        超时动作说明：提醒 - 发送通知 | 升级 - 转交上级 | 自动完成 - 标记完成 | 取消 - 跳过任务
      </Text>
    </Space>
  </Card>
);
