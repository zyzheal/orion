/**
 * YamlPreviewDrawer.tsx - YAML 预览抽屉
 * 抽取自 pipeline-svc/PipelineEditor/index.tsx (P2-9 Phase 102)
 */
import React from 'react';
import { Drawer, Input, Button, Space, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';

const { TextArea } = Input;

interface YamlPreviewDrawerProps {
  open: boolean;
  yaml: string;
  onClose: () => void;
}

export const YamlPreviewDrawer: React.FC<YamlPreviewDrawerProps> = ({ open, yaml, onClose }) => (
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
            navigator.clipboard.writeText(yaml);
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
      value={yaml}
      readOnly
      rows={30}
      style={{ fontFamily: 'monospace', fontSize: spacing[3], border: 'none' }}
    />
  </Drawer>
);
