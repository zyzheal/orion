/**
 * Header - 页面头部 (返回列表 + 标题 + DAG/YAML/重置/保存)
 * 抽取自 index.tsx (P2-9 Phase 104)
 */
import React from 'react';
import { Typography, Button, Space } from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  UndoOutlined,
  CodeOutlined,
  EditOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { PipelineEditorState } from '../usePipelineEditorState';

const { Title, Text } = Typography;

interface HeaderProps {
  state: PipelineEditorState;
}

export const Header: React.FC<HeaderProps> = ({ state }) => {
  const {
    id,
    navigate,
    dagPreviewVisible,
    setDagPreviewVisible,
    stages,
    handlePreviewYaml,
    handleReset,
    handleSavePipeline,
    saving,
  } = state;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.lg,
      }}
    >
      <div>
        <Title
          level={2}
          style={{ marginBottom: spacing.sm, display: 'flex', alignItems: 'center' }}
        >
          <EditOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          {id ? '编辑 Pipeline' : '创建 Pipeline'}
        </Title>
        <Text type="secondary">可视化编排您的 CI/CD 流水线</Text>
      </div>
      <Space>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/pipelines')}>
          返回列表
        </Button>
        <Button
          icon={<ApartmentOutlined />}
          onClick={() => setDagPreviewVisible(!dagPreviewVisible)}
          disabled={stages.length === 0}
        >
          {dagPreviewVisible ? '隐藏 DAG' : '查看 DAG'}
        </Button>
        <Button
          icon={<CodeOutlined />}
          onClick={handlePreviewYaml}
          disabled={stages.length === 0}
        >
          预览 YAML
        </Button>
        <Button icon={<UndoOutlined />} onClick={handleReset}>
          重置
        </Button>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSavePipeline}
          loading={saving}
          disabled={stages.length === 0}
        >
          {saving ? '保存中...' : '保存'}
        </Button>
      </Space>
    </div>
  );
};
