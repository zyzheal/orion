/**
 * TemplateSelector - Pipeline 模板选择器
 * 弹窗展示预定义模板，用户点击即可基于模板创建 Pipeline
 */
import React from 'react';
import { Modal, Card, Typography, Space, Tag } from 'antd';
import { spacing } from '@/tokens';
import { pipelineTemplates, type FrontendPipelineTemplate } from '@/api/pipeline-templates';

const { Title, Text } = Typography;

interface TemplateSelectorProps {
  visible: boolean;
  onSelect: (template: FrontendPipelineTemplate) => void;
  onClose: () => void;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({ visible, onSelect, onClose }) => {
  return (
    <Modal
      title="从模板创建 Pipeline"
      open={visible}
      onCancel={onClose}
      width={900}
      footer={null}
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        选择一个模板快速开始，可在此基础上自定义
      </Text>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing.md }}>
        {pipelineTemplates.map((tpl) => (
          <Card
            key={tpl.id}
            hoverable
            size="small"
            onClick={() => onSelect(tpl)}
            style={{ cursor: 'pointer' }}
            title={
              <Space>
                <span style={{ fontSize: 20 }}>{tpl.icon}</span>
                {tpl.name}
              </Space>
            }
          >
            <Text type="secondary">{tpl.description}</Text>
            <div style={{ marginTop: spacing.sm }}>
              {tpl.stages.map((s) => (
                <Tag key={s.name} color="default" style={{ marginRight: 4 }}>
                  {s.name}
                </Tag>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </Modal>
  );
};

export default TemplateSelector;
