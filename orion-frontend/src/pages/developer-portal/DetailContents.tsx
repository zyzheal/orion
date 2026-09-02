/**
 * DeveloperPortal Detail Contents — DocDetailContent, SdkDetailContent, SubDetailContent, PgHistoryContent
 */
import { Descriptions, Tag, Typography, Space, Card, Table, Statistic, Row, Col, Spin, Empty } from 'antd';
import type { PortalDocument, SDKGenerationTask, APISubscription } from '@/api/developer-portal';
import { documentTypeConfig, subscriptionStatusMap, sdkStatusMap } from './config';
import { colors } from '@/tokens';
import { StarOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface DocDetailContentProps {
  doc: PortalDocument;
  docVersions: Array<{ id: string; version?: string; published?: boolean; updatedAt?: string }>;
}

export function DocDetailContent({ doc, docVersions }: DocDetailContentProps) {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="标题" span={2}>
          {doc.title}
        </Descriptions.Item>
        <Descriptions.Item label="URL 别名" span={2}>
          <Text code>{doc.slug}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="文档类型">
          <Tag color={documentTypeConfig[doc.documentType]?.color}>
            {documentTypeConfig[doc.documentType]?.label || doc.documentType}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          {doc.published ? <Tag color="green">已发布</Tag> : <Tag>草稿</Tag>}
        </Descriptions.Item>
        <Descriptions.Item label="分类">{doc.category || '未分类'}</Descriptions.Item>
        <Descriptions.Item label="版本">{doc.version || '-'}</Descriptions.Item>
        <Descriptions.Item label="标签" span={2}>
          <Space wrap>
            {(doc.tags || []).map((t: string, i: number) => (
              <Tag key={String(i)}>{t}</Tag>
            ))}
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="浏览">{doc.viewCount || 0}</Descriptions.Item>
        <Descriptions.Item label="点赞">
          <StarOutlined style={{ color: colors.warning[500], marginRight: 4 }} />
          {doc.helpfulCount || 0}
        </Descriptions.Item>
        <Descriptions.Item label="作者">{doc.authorId}</Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {doc.createdAt
            ? new Date(doc.createdAt).toLocaleString()
            : doc.created_at
              ? new Date(doc.created_at).toLocaleString()
              : '-'}
        </Descriptions.Item>
      </Descriptions>
      <Card size="small" title="内容预览">
        <Paragraph>
          {doc.content?.substring(0, 500) || '无内容'}
          {(doc.content?.length || 0) > 500 && '...'}
        </Paragraph>
      </Card>
      {docVersions.length > 1 && (
        <Card size="small" title={`版本历史 (${docVersions.length})`}>
          <Table
            dataSource={docVersions}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              { title: '版本', dataIndex: 'version', key: 'version', width: 100 },
              {
                title: '状态',
                dataIndex: 'published',
                key: 'published',
                width: 100,
                render: (p: boolean) =>
                  p ? <Tag color="green">已发布</Tag> : <Tag>草稿</Tag>,
              },
              {
                title: '更新时间',
                dataIndex: 'updatedAt',
                key: 'updatedAt',
                render: (t: string) => t ? new Date(t).toLocaleString() : '-',
              },
            ]}
          />
        </Card>
      )}
    </Space>
  );
}

interface SdkDetailContentProps {
  sdk: SDKGenerationTask;
}

export function SdkDetailContent({ sdk }: SdkDetailContentProps) {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="语言">
          <Tag color="blue">{sdk.language}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="包名">
          <Text code>{sdk.packageName}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="版本">{sdk.version}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={sdkStatusMap[sdk.status]?.color}>
            {sdkStatusMap[sdk.status]?.label}
          </Tag>
        </Descriptions.Item>
      </Descriptions>
      {sdk.status === 'completed' && sdk.output ? (
        <Card size="small" title="生成的代码">
          <pre
            style={{
              background: '#1e1e1e',
              padding: 16,
              borderRadius: 8,
              maxHeight: 500,
              overflow: 'auto',
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {sdk.output}
          </pre>
        </Card>
      ) : sdk.status === 'failed' ? (
        <Card size="small" title="错误信息">
          <Text type="danger">{sdk.error}</Text>
        </Card>
      ) : (
        <Card size="small">
          <Spin tip="生成中..." />
        </Card>
      )}
    </Space>
  );
}

interface SubDetailContentProps {
  sub: APISubscription;
}

export function SubDetailContent({ sub }: SubDetailContentProps) {
  const dailyUsage =
    sub.quotaPerDay > 0 ? Math.round((sub.usedToday / sub.quotaPerDay) * 100) : 0;
  const monthlyUsage =
    sub.quotaPerMonth > 0
      ? Math.round((sub.usedThisMonth / sub.quotaPerMonth) * 100)
      : 0;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="API 名称" span={2}>
          {sub.apiName}
        </Descriptions.Item>
        <Descriptions.Item label="套餐">{sub.planName}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={subscriptionStatusMap[sub.status]?.color}>
            {subscriptionStatusMap[sub.status]?.label}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="日用量">
          {sub.usedToday} / {sub.quotaPerDay}
        </Descriptions.Item>
        <Descriptions.Item label="月用量">
          {sub.usedThisMonth} / {sub.quotaPerMonth}
        </Descriptions.Item>
        <Descriptions.Item label="API Key" span={2}>
          <Text code copyable>{sub.apiKey}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="申请人">{sub.userId}</Descriptions.Item>
        <Descriptions.Item label="审批人">{sub.approvedBy || '-'}</Descriptions.Item>
        <Descriptions.Item label="申请理由" span={2}>
          {sub.reason || '-'}
        </Descriptions.Item>
        {sub.rejectReason && (
          <Descriptions.Item label="拒绝原因" span={2}>
            <Text type="danger">{sub.rejectReason}</Text>
          </Descriptions.Item>
        )}
        {sub.expiresAt && (
          <Descriptions.Item label="到期时间">
            {new Date(sub.expiresAt).toLocaleDateString()}
          </Descriptions.Item>
        )}
        <Descriptions.Item label="创建时间">
          {sub.createdAt
            ? new Date(sub.createdAt).toLocaleString()
            : sub.created_at
              ? new Date(sub.created_at).toLocaleString()
              : '-'}
        </Descriptions.Item>
      </Descriptions>

      <Card size="small" title="用量趋势">
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Statistic
                title="日配额使用率"
                value={dailyUsage}
                suffix="%"
                valueStyle={{
                  color: dailyUsage > 80 ? colors.error[500] : colors.success[500],
                }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="月配额使用率"
                value={monthlyUsage}
                suffix="%"
                valueStyle={{
                  color: monthlyUsage > 80 ? colors.error[500] : colors.success[500],
                }}
              />
            </Col>
          </Row>
        </div>
      </Card>
    </Space>
  );
}

interface PgHistoryContentProps {
  history: Array<{ id: string; statusCode: number; latencyMs: number; timestamp: string }>;
}

export function PgHistoryContent({ history }: PgHistoryContentProps) {
  return (
    <Table
      dataSource={history}
      rowKey="id"
      size="small"
      pagination={false}
      columns={[
        {
          title: '状态码',
          dataIndex: 'statusCode',
          key: 'statusCode',
          width: 80,
          render: (c: number) => (
            <Tag color={c < 300 ? 'green' : c < 400 ? 'blue' : 'red'}>{c}</Tag>
          ),
        },
        {
          title: '延迟',
          dataIndex: 'latencyMs',
          key: 'latencyMs',
          width: 80,
          render: (ms: number) => `${ms}ms`,
        },
        {
          title: '时间',
          dataIndex: 'timestamp',
          key: 'timestamp',
          render: (t: string) => new Date(t).toLocaleString(),
        },
      ]}
      locale={{ emptyText: <Empty description="暂无响应历史" /> }}
    />
  );
}
