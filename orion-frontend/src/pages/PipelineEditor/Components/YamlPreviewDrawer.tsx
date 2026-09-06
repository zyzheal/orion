/**
 * YamlPreviewDrawer - YAML 预览抽屉
 * 抽取自 index.tsx (P2-9 Phase 104)
 */
import React from 'react';
import { Drawer, Button, Space, Input, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';

const { TextArea } = Input;

interface YamlPreviewDrawerProps {
  open: boolean;
  generatedYaml: string;
  onClose: () => void;
}

export const YamlPreviewDrawer: React.FC<YamlPreviewDrawerProps> = ({
  open,
  generatedYaml,
  onClose,
}) => (
  <Drawer
    title="YAML 预览"
    placement="right"
    width={600}
    open={open}
    onClose={onClose}
    extra={
      <Space>
        <Button
          icon={<CopyOutlined />}
          onClick={() => {
            navigator.clipboard.writeText(generatedYaml);
            message.success('已复制到剪贴板');
          }}
        >
          复制
        </Button>
      </Space>
    }
    styles={{ body: { padding: 0 } }}
  >
    <TextArea
      value={generatedYaml}
      readOnly
      rows={30}
      style={{ fontFamily: 'monospace', fontSize: spacing[3], border: 'none' }}
    />
  </Drawer>
);
