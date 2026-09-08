/**
 * SummaryCards - 审计链概览统计 + 链信息卡片
 * 抽取自 index.tsx (P2-9 Phase 208)
 */
import { Card, Row, Col, Statistic, Typography } from 'antd';
import { FileTextOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { ChainInfo, StorageStats } from '@/api/audit';
import { colors, spacing } from '@/tokens';

const { Text } = Typography;

interface Props {
  chainInfo: ChainInfo | null;
  storageStats: StorageStats | null;
}

export const SummaryCards = ({ chainInfo, storageStats }: Props) => (
  <>
    <Row gutter={16} style={{ marginBottom: spacing.lg }}>
      <Col span={6}>
        <Card>
          <Statistic
            title="审计条目总数"
            value={chainInfo?.totalEntries || 0}
            prefix={<FileTextOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="最早序列号"
            value={chainInfo?.firstSequence || 0}
            valueStyle={{ color: colors.primary[500] }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="最新序列号"
            value={chainInfo?.lastSequence || 0}
            valueStyle={{ color: colors.success[500] }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="存储条目数"
            value={storageStats?.totalEntries || 0}
            prefix={<CheckCircleOutlined />}
          />
        </Card>
      </Col>
    </Row>

    <Card title="链信息" style={{ marginBottom: spacing.lg }}>
      <Row gutter={16}>
        <Col span={12}>
          <Text type="secondary">创世 Hash:</Text>
          <Text code style={{ marginLeft: spacing.sm }} copyable>
            {chainInfo?.genesisHash || 'N/A'}
          </Text>
        </Col>
        <Col span={12}>
          <Text type="secondary">最新链 Hash:</Text>
          <Text code style={{ marginLeft: spacing.sm }} copyable>
            {chainInfo?.lastChainHash || 'N/A'}
          </Text>
        </Col>
      </Row>
    </Card>
  </>
);
