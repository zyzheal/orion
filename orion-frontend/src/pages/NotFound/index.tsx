/**
 * 404 - 页面未找到
 *
 * 增强功能：
 * - 搜索建议
 * - 常用导航链接
 * - 设计规范样式
 */
import React, { useState } from 'react';
import { Result, Button, Input, Space, Card, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  SearchOutlined,
  HomeOutlined,
  DashboardOutlined,
  ProjectOutlined,
  AlertOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

const QUICK_LINKS = [
  { path: '/', label: '工作台', icon: <DashboardOutlined /> },
  { path: '/pipelines', label: 'Pipeline', icon: <ProjectOutlined /> },
  { path: '/alerts', label: '告警中心', icon: <AlertOutlined /> },
  { path: '/tickets', label: '工单系统', icon: <SettingOutlined /> },
];

const SEARCH_SUGGESTIONS = [
  'Pipeline 配置',
  '告警规则',
  '工单查询',
  '部署管理',
  'CMDB 配置项',
];

const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');

  const handleSearch = () => {
    if (searchValue.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.light.bg.secondary,
        padding: spacing[6],
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 560,
          textAlign: 'center',
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 404 状态 */}
          <Result
            status="404"
            title={
              <Title level={1} style={{ color: colors.neutral[900], fontSize: 72, lineHeight: 1 }}>
                404
              </Title>
            }
            subTitle={
              <Text type="secondary" style={{ fontSize: 16 }}>
                抱歉，您访问的页面不存在或已被移除
              </Text>
            }
            extra={
              <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: spacing.lg }}>
                {/* 搜索框 */}
                <div>
                  <Text type="secondary" style={{ display: 'block', marginBottom: spacing.sm, textAlign: 'left' }}>
                    尝试搜索：
                  </Text>
                  <Input
                    size="large"
                    placeholder="搜索功能、页面或资源..."
                    prefix={<SearchOutlined style={{ color: colors.neutral[400] }} />}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onPressEnter={handleSearch}
                    style={{ borderRadius: 6 }}
                  />
                </div>

                {/* 搜索建议 */}
                <div style={{ textAlign: 'left' }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                    热门搜索：
                  </Text>
                  <Space wrap>
                    {SEARCH_SUGGESTIONS.map((suggestion) => (
                      <Button
                        key={suggestion}
                        type="default"
                        size="small"
                        onClick={() => {
                          setSearchValue(suggestion);
                          navigate(`/search?q=${encodeURIComponent(suggestion)}`);
                        }}
                        style={{ borderRadius: 6 }}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </Space>
                </div>

                {/* 操作按钮 */}
                <Space>
                  <Button
                    type="primary"
                    icon={<HomeOutlined />}
                    onClick={() => navigate('/')}
                    size="large"
                    style={{ borderRadius: 6, minWidth: 140 }}
                  >
                    返回首页
                  </Button>
                  <Button
                    size="large"
                    onClick={() => navigate(-1)}
                    style={{ borderRadius: 6, minWidth: 140 }}
                  >
                    返回上页
                  </Button>
                </Space>
              </Space>
            }
          />

          {/* 快捷导航 */}
          <div style={{ borderTop: `1px solid ${colors.light.border.light}`, paddingTop: spacing.lg }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
              或者访问常用页面：
            </Text>
            <Space wrap style={{ justifyContent: 'center' }}>
              {QUICK_LINKS.map((link) => (
                <Card
                  key={link.path}
                  size="small"
                  hoverable
                  onClick={() => navigate(link.path)}
                  style={{
                    minWidth: 120,
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: `1px solid ${colors.light.border.light}`,
                  }}
                >
                  <Space direction="vertical" align="center" size={4}>
                    <span style={{ color: colors.primary[500], fontSize: 20 }}>{link.icon}</span>
                    <Text style={{ fontSize: 13 }}>{link.label}</Text>
                  </Space>
                </Card>
              ))}
            </Space>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default NotFound;
