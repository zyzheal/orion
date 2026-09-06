/**
 * Header.tsx - PipelineEditor 顶部标题栏 + 操作按钮
 * 抽取自 pipeline-svc/PipelineEditor/index.tsx (P2-9 Phase 102)
 */
import React from 'react';
import { Typography, Button, Space, Segmented } from 'antd';
import {
  EditOutlined,
  SaveOutlined,
  UndoOutlined,
  CodeOutlined,
  ArrowLeftOutlined,
  AppstoreOutlined,
  LayoutOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import { colors } from '@/tokens';

const { Title, Text } = Typography;

interface HeaderProps {
  id?: string;
  viewMode: 'list' | 'canvas';
  dagPreviewVisible: boolean;
  saving: boolean;
  stagesCount: number;
  onViewModeChange: (mode: 'list' | 'canvas') => void;
  onToggleDag: () => void;
  onPreviewYaml: () => void;
  onReset: () => void;
  onSave: () => void;
  onBack: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  id,
  viewMode,
  dagPreviewVisible,
  saving,
  stagesCount,
  onViewModeChange,
  onToggleDag,
  onPreviewYaml,
  onReset,
  onSave,
  onBack,
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.lg,
    }}
  >
    <div>
      <div style={{ marginBottom: spacing.sm }} >
        <Space align="center">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
            size="small"
          >
            返回列表
          </Button>
          <Title level={2} style={{ marginBottom: 0, display: 'flex', alignItems: 'center' }}>
            <EditOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            {id ? '编辑 Pipeline' : '创建 Pipeline'}
          </Title>
        </Space>
      </div>
      <Text type="secondary">可视化编排您的 CI/CD 流水线</Text>
    </div>
    <Space>
      <Segmented
        value={viewMode}
        onChange={(value) => onViewModeChange(value as 'list' | 'canvas')}
        options={[
          { value: 'list', icon: <AppstoreOutlined />, label: '列表' },
          { value: 'canvas', icon: <LayoutOutlined />, label: '画布' },
        ]}
      />
      <Button
        icon={<ApartmentOutlined />}
        onClick={onToggleDag}
        disabled={stagesCount === 0}
      >
        {dagPreviewVisible ? '隐藏 DAG' : '查看 DAG'}
      </Button>
      <Button
        icon={<CodeOutlined />}
        onClick={onPreviewYaml}
        disabled={stagesCount === 0}
      >
        预览 YAML
      </Button>
      <Button
        icon={<UndoOutlined />}
        onClick={onReset}
      >
        重置
      </Button>
      <Button
        type="primary"
        icon={<SaveOutlined />}
        onClick={onSave}
        loading={saving}
        disabled={stagesCount === 0}
      >
        {saving ? '保存中...' : '保存'}
      </Button>
    </Space>
  </div>
);
