/**
 * StagePrTriggerSection - PR/MR 触发配置区块
 */
import React from 'react';
import { Divider, Space } from 'antd';
import { BranchesOutlined } from '@ant-design/icons';
import PRTriggerConfigComponent, {
  type PRTriggerConfig as PRTriggerConfigType,
} from '@/components/PRTriggerConfig';

interface StagePrTriggerSectionProps {
  value: Partial<PRTriggerConfigType>;
  onChange: (value: Partial<PRTriggerConfigType>) => void;
}

const StagePrTriggerSection: React.FC<StagePrTriggerSectionProps> = ({ value, onChange }) => (
  <>
    <Divider orientation="left" orientationMargin={0}>
      <Space>
        <BranchesOutlined />
        <span>PR/MR 触发配置</span>
      </Space>
    </Divider>

    <PRTriggerConfigComponent
      value={value}
      onChange={(config) => onChange(config as Partial<PRTriggerConfigType>)}
    />
  </>
);

export default StagePrTriggerSection;
