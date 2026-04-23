/**
 * 子系统导航页面
 * 展示所有可用的子系统入口
 */
import React from 'react';
import { Typography, Card, Row, Col, Tag, Button } from 'antd';
import { colors, spacing } from '@/tokens';
import {
  DatabaseOutlined,
  BookOutlined,
  DashboardOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph } = Typography;

interface SubAppCard {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  path: string;
  tags: string[];
}

const subApps: SubAppCard[] = [
  {
    key: 'dba',
    name: '数据库管理',
    description: '提供数据库连接管理、SQL 执行、数据建模、性能监控等功能',
    icon: <DatabaseOutlined />,
    color: colors.primary[500],
    path: '/dba',
    tags: ['数据库', 'SQL', '管理工具'],
  },
  {
    key: 'knowledge',
    name: '知识库',
    description: '团队知识沉淀、文档管理、经验分享、最佳实践收集',
    icon: <BookOutlined />,
    color: colors.success[500],
    path: '/knowledge',
    tags: ['文档', '知识管理', '协作'],
  },
  {
    key: 'visor',
    name: '监控中心',
    description: '系统监控、告警管理、性能分析、日志查询一体化平台',
    icon: <DashboardOutlined />,
    color: colors.purple[500],
    path: '/visor',
    tags: ['监控', '告警', '分析'],
  },
];

const SubApps: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 32 }}>
        <Title level={2}>子系统导航</Title>
        <Paragraph type="secondary" style={{ fontSize: spacing[4] }}>
          Orion 平台采用微前端架构，以下为集成的子系统应用。点击卡片进入相应子系统。
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        {subApps.map((app) => (
          <Col xs={24} sm={12} md={8} key={app.key}>
            <Card
              hoverable
              style={{
                height: '100%',
                minHeight: 280,
                borderRadius: 12,
                border: `1px solid ${colors.light.border.light}`,
                transition: 'all 0.3s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
              onClick={() => navigate(app.path)}
              bodyStyle={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 12,
                  background: `${app.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: spacing[8], color: app.color }}>
                  {app.icon}
                </div>
              </div>

              <Title level={4} style={{ marginBottom: 8 }}>
                {app.name}
              </Title>

              <div style={{ marginBottom: 12 }}>
                {app.tags.map((tag) => (
                  <Tag key={tag} color={app.color} style={{ marginRight: 4 }}>
                    {tag}
                  </Tag>
                ))}
              </div>

              <Paragraph
                type="secondary"
                style={{
                  flex: 1,
                  fontSize: spacing[4],
                  lineHeight: 1.6,
                  marginBottom: 24,
                }}
              >
                {app.description}
              </Paragraph>

              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                style={{
                  background: app.color,
                  borderColor: app.color,
                  alignSelf: 'flex-start',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(app.path);
                }}
              >
                进入系统
              </Button>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 架构说明 */}
      <Card
        style={{
          marginTop: 32,
          background: colors.neutral[50],
          border: 'none',
        }}
      >
        <Title level={5}>🏗️ 微前端架构说明</Title>
        <Paragraph style={{ fontSize: spacing[4], color: colors.neutral[500] }}>
          <ul style={{ paddingLeft: 20 }}>
            <li>采用 <strong>Wujie（无界）</strong> 微前端框架，实现子系统间完全隔离</li>
            <li>支持子系统独立开发、独立部署、技术栈无关</li>
            <li>通过 <strong>eventBus</strong> 实现主子应用通信</li>
            <li>共享用户认证状态、主题配置等全局状态</li>
            <li>支持子应用预加载和保活模式，提升切换体验</li>
          </ul>
        </Paragraph>
      </Card>
    </div>
  );
};

export default SubApps;
