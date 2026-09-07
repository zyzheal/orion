/**
 * TemplateDetailModal - 模板详情弹窗
 * 抽取自 index.tsx (P2-9 Phase 141)
 */
import React from 'react';
import { Modal, Space, Button, Descriptions, Tag } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';
import type { LowcodeTemplate } from '@/api/lowcode';

interface TemplateDetailModalProps {
  selectedTemplate: LowcodeTemplate | null;
  visible: boolean;
  onClose: () => void;
  onUseTemplate: (t: LowcodeTemplate) => void;
}

const preStyle = {
  maxHeight: 200,
  overflow: 'auto',
  background: colors.neutral[100],
  padding: spacing.sm,
  borderRadius: 8,
  fontSize: 12,
};

export const TemplateDetailModal: React.FC<TemplateDetailModalProps> = ({
  selectedTemplate,
  visible,
  onClose,
  onUseTemplate,
}) => (
  <Modal
    title={`模板详情: ${selectedTemplate?.name}`}
    open={visible}
    onCancel={onClose}
    width={700}
    footer={
      <Space>
        <Button onClick={onClose}>关闭</Button>
        {selectedTemplate && (
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={() => {
              onClose();
              onUseTemplate(selectedTemplate);
            }}
          >
            使用此模板
          </Button>
        )}
      </Space>
    }
  >
    {selectedTemplate && (
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="模板ID">{selectedTemplate.id}</Descriptions.Item>
        <Descriptions.Item label="名称">{selectedTemplate.name}</Descriptions.Item>
        <Descriptions.Item label="描述">
          {selectedTemplate.description || '无'}
        </Descriptions.Item>
        <Descriptions.Item label="分类">
          <Tag color="blue">{selectedTemplate.category || '未分类'}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="标签">
          <Space>
            {selectedTemplate.tags &&
              selectedTemplate.tags
                .split(',')
                .filter(Boolean)
                .map((tag) => <Tag key={tag}>{tag.trim()}</Tag>)}
            {!selectedTemplate.tags && '无'}
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="使用次数">
          {selectedTemplate.usageCount || 0}
        </Descriptions.Item>
        <Descriptions.Item label="创建人">{selectedTemplate.createdBy}</Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {dayjs(selectedTemplate.createdAt).format('YYYY-MM-DD HH:mm:ss')}
        </Descriptions.Item>
        <Descriptions.Item label="节点定义">
          <pre style={preStyle}>
            {selectedTemplate.definition
              ? JSON.stringify(JSON.parse(selectedTemplate.definition), null, 2)
              : '无'}
          </pre>
        </Descriptions.Item>
        <Descriptions.Item label="连线定义">
          <pre style={preStyle}>{'无'}</pre>
        </Descriptions.Item>
      </Descriptions>
    )}
  </Modal>
);
