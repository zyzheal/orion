/**
 * PolicyDetailDrawer.tsx - 策略详情 Drawer
 * 抽取自 quality-gate/QualityGatePage.tsx (P2-9 Phase 77)
 */
import React from 'react';
import { Drawer, Descriptions, Tag } from 'antd';
import dayjs from 'dayjs';
import type { PolicyDefinition } from '@/api/policies';
import { categoryColorMap, severityColorMap, severityLabelMap } from './constants';

interface PolicyDetailDrawerProps {
  visible: boolean;
  selectedPolicy: PolicyDefinition | null;
  onClose: () => void;
}

export const PolicyDetailDrawer: React.FC<PolicyDetailDrawerProps> = ({
  visible,
  selectedPolicy,
  onClose,
}) => {
  return (
    <Drawer
      title={selectedPolicy ? selectedPolicy.name : '策略详情'}
      open={visible}
      onClose={onClose}
      width={600}
      destroyOnClose
    >
      {selectedPolicy && (
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="策略名称">{selectedPolicy.name}</Descriptions.Item>
          <Descriptions.Item label="分类">
            <Tag color={categoryColorMap[selectedPolicy.category]}>{selectedPolicy.category}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="严重级别">
            <Tag color={severityColorMap[selectedPolicy.severity]}>
              {severityLabelMap[selectedPolicy.severity]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={selectedPolicy.enabled ? 'green' : 'default'}>
              {selectedPolicy.enabled ? '启用' : '禁用'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Rego 路径">{selectedPolicy.regoPath}</Descriptions.Item>
          {selectedPolicy.description && (
            <Descriptions.Item label="描述">{selectedPolicy.description}</Descriptions.Item>
          )}
          <Descriptions.Item label="创建时间">
            {dayjs(selectedPolicy.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {dayjs(selectedPolicy.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Drawer>
  );
};
