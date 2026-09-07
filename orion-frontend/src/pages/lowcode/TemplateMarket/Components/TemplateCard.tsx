/**
 * TemplateCard - 单个模板卡片
 * 抽取自 index.tsx (P2-9 Phase 141)
 */
import React from 'react';
import { Card, Tag, Space, Typography, Tooltip, Button, Divider } from 'antd';
import { AppstoreOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';
import type { LowcodeTemplate } from '@/api/lowcode';

const { Text } = Typography;

interface TemplateCardProps {
  template: LowcodeTemplate;
  onViewDetail: (t: LowcodeTemplate) => void;
  onOpenApply: (t: LowcodeTemplate) => void;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onViewDetail,
  onOpenApply,
}) => (
  <Card
    key={template.id}
    hoverable
    style={{ borderRadius: 12, height: '100%', display: 'flex', flexDirection: 'column' }}
    cover={
      template.thumbnail ? (
        <div
          style={{
            height: 140,
            background: `url(${template.thumbnail}) center/cover`,
            borderRadius: '12px 12px 0 0',
          }}
        />
      ) : (
        <div
          style={{
            height: 100,
            background: `linear-gradient(135deg, ${colors.primary[100]}, ${colors.primary[200]})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppstoreOutlined style={{ fontSize: 40, color: colors.primary[500] }} />
        </div>
      )
    }
    actions={[
      <Tooltip title="查看详情" key="view">
        <Button type="text" icon={<EyeOutlined />} onClick={() => onViewDetail(template)} />
      </Tooltip>,
      <Tooltip title="使用模板创建流程" key="apply">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => onOpenApply(template)}>
          使用
        </Button>
      </Tooltip>,
    ]}
  >
    <Card.Meta
      title={
        <Space>
          <span style={{ fontWeight: 600 }}>{template.name}</span>
          {template.category && (
            <Tag color="blue" style={{ marginLeft: 4 }}>
              {template.category}
            </Tag>
          )}
        </Space>
      }
      description={
        <div>
          <Text
            type="secondary"
            ellipsis
            style={{ display: 'block', marginBottom: 4 }}
          >
            {template.description || '无描述'}
          </Text>
          <Space size="small">
            {template.tags &&
              template.tags
                .split(',')
                .filter(Boolean)
                .map((tag) => (
                  <Tag key={tag} style={{ fontSize: 11 }}>
                    {tag.trim()}
                  </Tag>
                ))}
          </Space>
          <Divider style={{ margin: '8px 0' }} />
          <Space size="large" style={{ fontSize: 12, color: colors.neutral[500] }}>
            <span>使用 {template.usageCount || 0} 次</span>
          </Space>
        </div>
      }
    />
  </Card>
);
