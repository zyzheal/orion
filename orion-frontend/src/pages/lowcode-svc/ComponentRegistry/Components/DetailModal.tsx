/**
 * ComponentRegistry DetailModal
 * 抽取自 index.tsx (P2-9 Phase 194)
 */
import { Button, Descriptions, Modal, Tag } from 'antd';
import { themeVars } from '@/tokens';
import type { ComponentRegistry } from '@/api/lowcode';
import { getCategoryLabel } from '../constants';
import type { CSSProperties } from 'react';

interface DetailModalProps {
  open: boolean;
  component: ComponentRegistry | null;
  onClose: () => void;
}

const preStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  overflow: 'auto',
  background: themeVars.bgSecondary,
  padding: 8,
  borderRadius: 4,
};

export const DetailModal = ({ open, component, onClose }: DetailModalProps) => (
  <Modal
    title="组件详情"
    open={open}
    onCancel={onClose}
    footer={<Button onClick={onClose}>关闭</Button>}
    width={600}
  >
    {component && (
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="组件标识">{component.name}</Descriptions.Item>
        <Descriptions.Item label="显示名称">{component.displayName}</Descriptions.Item>
        <Descriptions.Item label="分类">{getCategoryLabel(component.category)}</Descriptions.Item>
        <Descriptions.Item label="版本">
          <Tag color="blue">{component.version}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="图标">{component.icon || '-'}</Descriptions.Item>
        <Descriptions.Item label="内置">
          <Tag color={component.isBuiltin ? 'green' : 'default'}>
            {component.isBuiltin ? '是' : '否'}
          </Tag>
        </Descriptions.Item>
        {component.propsSchema && (
          <Descriptions.Item label="Props Schema">
            <pre style={{ ...preStyle, maxHeight: 200 }}>
              {JSON.stringify(component.propsSchema, null, 2)}
            </pre>
          </Descriptions.Item>
        )}
        {component.defaultConfig && (
          <Descriptions.Item label="默认配置">
            <pre style={{ ...preStyle, maxHeight: 150 }}>
              {JSON.stringify(component.defaultConfig, null, 2)}
            </pre>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="注册时间">
          {new Date(component.createdAt).toLocaleString()}
        </Descriptions.Item>
      </Descriptions>
    )}
  </Modal>
);
