/**
 * StageMatrixSection - 矩阵构建 (Matrix Build) 配置区块
 */
import React from 'react';
import { Card, Divider, Space, Switch } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import MatrixConfigurator from '@/components/MatrixConfigurator';
import { colors, spacing } from '@/tokens';
import type { MatrixBuildConfig } from '../types';

interface StageMatrixSectionProps {
  value: MatrixBuildConfig;
  onChange: (value: MatrixBuildConfig) => void;
}

const StageMatrixSection: React.FC<StageMatrixSectionProps> = ({ value, onChange }) => (
  <>
    <Divider orientation="left" orientationMargin={0}>
      <Space>
        <ThunderboltOutlined style={{ color: colors.warning[500] }} />
        <span>矩阵构建 (Matrix Build)</span>
      </Space>
    </Divider>

    <Card
      size="small"
      style={{ marginBottom: spacing.md }}
      extra={
        <Space>
          <span>启用矩阵构建</span>
          <Switch
            checked={value.enabled}
            onChange={(checked) =>
              onChange({
                ...value,
                enabled: checked,
                dimensions: checked ? value.dimensions : [],
                exclusions: checked ? value.exclusions : [],
              })
            }
          />
        </Space>
      }
    >
      {value.enabled ? (
        <MatrixConfigurator value={value} onChange={onChange} />
      ) : (
        <div style={{ padding: '8px 0', color: colors.neutral[500] }}>
          启用后可在多个维度上并行构建，例如同时测试多个 Node.js 版本和操作系统
        </div>
      )}
    </Card>
  </>
);

export default StageMatrixSection;
