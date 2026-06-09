import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Spin } from 'antd';
import { colors, spacing } from '@/tokens';
import {
  BookOutlined,
  FileOutlined,
  QuestionCircleOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';

const { Sider, Content } = Layout;

const menuItems = [
  { key: '/console/ai-docs/spaces', icon: <BookOutlined />, label: '知识库' },
  { key: '/console/ai-docs/documents', icon: <FileOutlined />, label: '文档管理' },
  { key: '/console/ai-docs/rag', icon: <QuestionCircleOutlined />, label: 'RAG 查询' },
  { key: '/console/ai-docs/graph', icon: <ApartmentOutlined />, label: '知识图谱' },
];

const AIDocManagementLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, _setLoading] = useState(false);

  return (
    <Layout style={{ minHeight: '100%' }}>
      <Sider
        width={200}
        theme="light"
        style={{ borderRight: `1px solid ${colors.light.border.light}` }}
      >
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Content style={{ padding: spacing.lg, background: colors.light.bg.primary }}>
        <Spin spinning={loading}>
          <Outlet />
        </Spin>
      </Content>
    </Layout>
  );
};

export default AIDocManagementLayout;
