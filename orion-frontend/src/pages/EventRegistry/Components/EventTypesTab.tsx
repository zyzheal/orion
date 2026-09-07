/**
 * EventRegistry Event Types tab
 * 抽取自 index.tsx (P2-9 Phase 166)
 */
import { Button, Card, Space, Tag, Typography } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import type { EventTypeInfo } from '@/api/event-registry';
import { categoryColorMap } from '../constants';

const { Text } = Typography;

interface EventTypesTabProps {
  categories: string[];
  eventTypesByCategory: Record<string, EventTypeInfo[]>;
  copySamplePayload: (sample: Record<string, unknown>) => void;
}

export const EventTypesTab = ({
  categories,
  eventTypesByCategory,
  copySamplePayload,
}: EventTypesTabProps) => (
  <div>
    <div style={{ marginBottom: spacing.lg }}>
      <Text strong style={{ marginRight: spacing.md }}>
        分类:
      </Text>
      {categories.map((cat) => (
        <Tag
          key={cat}
          color={categoryColorMap[cat] || 'default'}
          style={{ marginRight: spacing.sm, marginBottom: spacing.sm }}
        >
          {cat} ({eventTypesByCategory[cat]?.length || 0})
        </Tag>
      ))}
    </div>

    {categories.map((category) => (
      <Card
        key={category}
        size="small"
        title={
          <Space>
            <Tag color={categoryColorMap[category] || 'default'}>{category}</Tag>
            <Text type="secondary">
              {eventTypesByCategory[category]?.length || 0} 个事件类型
            </Text>
          </Space>
        }
        style={{ marginBottom: spacing.md }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: spacing.md,
          }}
        >
          {eventTypesByCategory[category]?.map((et) => (
            <Card
              key={et.type}
              size="small"
              hoverable
              style={{ borderLeft: `3px solid ${colors.primary[500]}` }}
            >
              <Space direction="vertical" size={0} style={{ width: '100%' }}>
                <Text strong code style={{ fontSize: 13 }}>
                  {et.type}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {et.description}
                </Text>
                <div style={{ marginTop: spacing.xs }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    示例 Payload:
                  </Text>
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => copySamplePayload(et.samplePayload)}
                    style={{ float: 'right', fontSize: 11 }}
                  >
                    复制
                  </Button>
                </div>
                <pre
                  style={{
                    background: colors.neutral[50],
                    padding: spacing.xs,
                    borderRadius: 4,
                    fontSize: 10,
                    overflow: 'auto',
                    maxHeight: 80,
                    margin: 0,
                  }}
                >
                  {JSON.stringify(et.samplePayload, null, 2)}
                </pre>
              </Space>
            </Card>
          ))}
        </div>
      </Card>
    ))}
  </div>
);
