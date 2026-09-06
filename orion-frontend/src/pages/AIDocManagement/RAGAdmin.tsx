/**
 * RAG Admin - RAG 系统管理配置页
 * - Tab 1: 管道配置 (default_top_k, reranker_threshold, max_context_chars, max_retries, mmr_lambda, 各级别预算)
 * - Tab 2: Prompt 模板管理 (name, version, content)
 * - 触发索引重建按钮
 *
 * 主入口 (P2-9 Phase 98 refactor: 已抽取 RAGAdminConstants / useRAGAdminState /
 * RAGAdminConfigTab / RAGAdminTemplatesTab / RAGAdminColumns)
 */
import React from 'react';
import { Typography, Space, Card, Tabs } from 'antd';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import {
  SettingOutlined,
  FileTextOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useRAGAdminState } from './useRAGAdminState';
import { RAGAdminConfigTab } from './RAGAdminConfigTab';
import { RAGAdminTemplatesTab } from './RAGAdminTemplatesTab';

const { Title, Text } = Typography;

const RAGAdminPage: React.FC = () => {
  const state = useRAGAdminState();

  return (
    <div style={{ padding: 0 }}>
      {/* Page Header */}
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <SettingOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          管理配置
        </Title>
        <Text type="secondary">RAG 系统管理配置</Text>
      </div>

      {/* Action Bar */}
      <Card
        style={{
          marginBottom: spacing.md,
          boxShadow: shadows.card,
          borderRadius: componentRadius.card,
        }}
      >
        <Space>
          <ReloadOutlined style={{ color: colors.neutral[500] }} />
          <Text type="secondary">
            配置修改后请点击「保存配置」生效，索引重建可更新知识库检索数据
          </Text>
        </Space>
      </Card>

      {/* Main Tabs */}
      <Card
        style={{
          boxShadow: shadows.card,
          borderRadius: componentRadius.card,
          minHeight: 400,
        }}
      >
        <Tabs
          activeKey={state.activeTab}
          onChange={state.setActiveTab}
          items={[
            {
              key: 'config',
              label: (
                <span>
                  <SettingOutlined style={{ marginRight: 6 }} />
                  管道配置
                </span>
              ),
              children: (
                <RAGAdminConfigTab
                  configLoading={state.configLoading}
                  configSaving={state.configSaving}
                  config={state.config}
                  configForm={state.configForm}
                  indexRebuilding={state.indexRebuilding}
                  loadConfig={state.loadConfig}
                  handleSaveConfig={state.handleSaveConfig}
                  handleTriggerIndex={state.handleTriggerIndex}
                />
              ),
            },
            {
              key: 'templates',
              label: (
                <span>
                  <FileTextOutlined style={{ marginRight: 6 }} />
                  Prompt 模板管理
                </span>
              ),
              children: (
                <RAGAdminTemplatesTab
                  templates={state.templates}
                  templatesLoading={state.templatesLoading}
                  templateModalVisible={state.templateModalVisible}
                  setTemplateModalVisible={state.setTemplateModalVisible}
                  editingTemplate={state.editingTemplate}
                  templateForm={state.templateForm}
                  templateSaving={state.templateSaving}
                  openNewTemplate={state.openNewTemplate}
                  openEditTemplate={state.openEditTemplate}
                  handleSaveTemplate={state.handleSaveTemplate}
                  handleDeleteTemplate={state.handleDeleteTemplate}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default RAGAdminPage;
