/**
 * TemplateGrid - 模板卡片网格
 * 抽取自 index.tsx (P2-9 Phase 141)
 */
import React from 'react';
import { Row, Col, Empty, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { LowcodeTemplate } from '@/api/lowcode';
import { TemplateCard } from './TemplateCard';

interface TemplateGridProps {
  templates: LowcodeTemplate[];
  loading: boolean;
  onViewDetail: (t: LowcodeTemplate) => void;
  onOpenApply: (t: LowcodeTemplate) => void;
  onOpenPublish: () => void;
}

export const TemplateGrid: React.FC<TemplateGridProps> = ({
  templates,
  loading,
  onViewDetail,
  onOpenApply,
  onOpenPublish,
}) => (
  <Row gutter={spacing.md}>
    {templates.length === 0 && !loading ? (
      <Col span={24}>
        <Empty description="暂无模板">
          <Button type="primary" icon={<PlusOutlined />} onClick={onOpenPublish}>
            发布第一个模板
          </Button>
        </Empty>
      </Col>
    ) : (
      templates.map((template) => (
        <Col xs={24} sm={12} lg={8} xl={6} key={template.id}>
          <TemplateCard template={template} onViewDetail={onViewDetail} onOpenApply={onOpenApply} />
        </Col>
      ))
    )}
  </Row>
);
