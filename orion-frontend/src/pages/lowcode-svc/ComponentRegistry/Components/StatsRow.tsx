/**
 * ComponentRegistry StatsRow
 * 抽取自 index.tsx (P2-9 Phase 194)
 */
import { Card, Row, Col, Typography } from 'antd';
import { colors, spacing } from '@/tokens';
import type { ComponentRegistry } from '@/api/lowcode';

const { Text } = Typography;

interface StatsRowProps {
  components: ComponentRegistry[];
}

export const StatsRow = ({ components }: StatsRowProps) => {
  const customCount = components.filter((c) => !c.isBuiltin).length;
  const builtinCount = components.filter((c) => c.isBuiltin).length;
  const categoryCount = new Set(components.map((c) => c.category)).size;

  return (
    <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
      <Col span={6}>
        <Card>
          <Text type="secondary">组件总数</Text>
          <div style={{ fontSize: 24, fontWeight: 600, color: colors.primary[500] }}>
            {components.length}
          </div>
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Text type="secondary">自定义组件</Text>
          <div style={{ fontSize: 24, fontWeight: 600, color: colors.info[500] }}>
            {customCount}
          </div>
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Text type="secondary">内置组件</Text>
          <div style={{ fontSize: 24, fontWeight: 600, color: colors.success[500] }}>
            {builtinCount}
          </div>
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Text type="secondary">分类数</Text>
          <div style={{ fontSize: 24, fontWeight: 600, color: colors.purple[500] }}>
            {categoryCount}
          </div>
        </Card>
      </Col>
    </Row>
  );
};
