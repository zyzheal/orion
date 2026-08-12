import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography, Spin } from 'antd';
import { colors, spacing } from '@/tokens';
import {
  BookOutlined,
  FileOutlined,
  QuestionCircleOutlined,
  ApartmentOutlined,
  BarChartOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
} from '@ant-design/icons';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const menuItems = [
  { key: '/console/ai-docs/spaces', icon: <BookOutlined />, label: '知识库' },
  { key: '/console/ai-docs/documents', icon: <FileOutlined />, label: '文档管理' },
  { key: '/console/ai-docs/rag', icon: <QuestionCircleOutlined />, label: 'RAG 查询' },
  { key: '/console/ai-docs/graph', icon: <ApartmentOutlined />, label: '知识图谱' },
  { key: '/console/ai-docs/eval', icon: <BarChartOutlined />, label: '评估指标' },
  { key: '/console/ai-docs/audit', icon: <SafetyCertificateOutlined />, label: '审计日志' },
  { key: '/console/ai-docs/rag-admin', icon: <SettingOutlined />, label: 'RAG 管理' },
];

const pageTitleMap: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
  '/console/ai-docs/spaces': { icon: <BookOutlined />, title: '知识库', subtitle: '管理 AI 知识库空间' },
  '/console/ai-docs/documents': { icon: <FileOutlined />, title: '文档管理', subtitle: '上传和管理文档' },
  '/console/ai-docs/rag': { icon: <QuestionCircleOutlined />, title: 'RAG 查询', subtitle: '检索增强生成查询' },
  '/console/ai-docs/graph': { icon: <ApartmentOutlined />, title: '知识图谱', subtitle: '可视化知识关系图谱' },
  '/console/ai-docs/eval': { icon: <BarChartOutlined />, title: '评估指标', subtitle: 'RAG 系统评估数据' },
  '/console/ai-docs/audit': { icon: <SafetyCertificateOutlined />, title: '审计日志', subtitle: 'RAG 查询安全审计' },
  '/console/ai-docs/rag-admin': { icon: <SettingOutlined />, title: 'RAG 管理', subtitle: '管道配置与提示词模板' },
};

const AIDocManagementLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, _setLoading] = useState(false);

  const selectedKey = location.pathname;
  const pageInfo = pageTitleMap[selectedKey] || { icon: null, title: 'AI 文档管理', subtitle: '' };

  return (
    <Layout style={{ minHeight: '100%' }}>
      <Sider
        width={200}
        theme="light"
        style={{ borderRight: `1px solid ${colors.light.border.light}` }}
      >
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Content style={{ padding: spacing.lg, background: colors.light.bg.primary }}>
        {pageInfo.title && (
          <div style={{ marginBottom: spacing.md }}>
            <Title level={2} style={{ marginBottom: spacing.sm }}>
              {pageInfo.icon && <span style={{ marginRight: spacing[3], color: colors.primary[500] }}>{pageInfo.icon}</span>}
              {pageInfo.title}
            </Title>
            {pageInfo.subtitle && (
              <Text type="secondary">{pageInfo.subtitle}</Text>
            )}
          </div>
        )}
        <Spin spinning={loading}>
          <Outlet />
        </Spin>
      </Content>
    </Layout>
  );
};

export default AIDocManagementLayout;