/**
 * DocumentTemplates — Predefined document templates for quick creation
 *
 * Templates mirror Confluence's template system:
 *  - Project Plan
 *  - Meeting Notes
 *  - Technical Spec
 *  - API Reference
 *  - Bug Report
 *  - Onboarding Guide
 *  - Blank (default)
 */

import React from 'react';
import { Modal, Card, Space, Typography, Row, Col, Button } from 'antd';
import {
  FileTextOutlined,
  ProjectOutlined,
  TeamOutlined,
  CodeOutlined,
  ApiOutlined,
  BugOutlined,
  BookOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';

const { Text } = Typography;

export interface DocumentTemplate {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  content: string; // HTML content for TipTap
}

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    key: 'blank',
    name: '空白文档',
    description: '从头开始，自由编写',
    icon: <FileTextOutlined />,
    color: '#8c8c8c',
    content: '<p></p>',
  },
  {
    key: 'project-plan',
    name: '项目计划',
    description: '项目目标、里程碑、任务分解',
    icon: <ProjectOutlined />,
    color: colors.primary[500],
    content: `<h2>项目概览</h2>
<p><strong>项目名称:</strong> </p>
<p><strong>负责人:</strong> </p>
<p><strong>开始日期:</strong> </p>
<p><strong>截止日期:</strong> </p>

<h3>项目目标</h3>
<ul>
  <li>目标 1</li>
  <li>目标 2</li>
  <li>目标 3</li>
</ul>

<h3>里程碑</h3>
<table>
  <thead><tr><th>里程碑</th><th>截止日期</th><th>状态</th></tr></thead>
  <tbody>
    <tr><td>里程碑 1</td><td></td><td>进行中</td></tr>
    <tr><td>里程碑 2</td><td></td><td>待开始</td></tr>
  </tbody>
</table>

<h3>任务分解</h3>
<ul data-type="taskList">
  <li data-type="taskItem"><input type="checkbox" /><span>任务 1</span></li>
  <li data-type="taskItem"><input type="checkbox" /><span>任务 2</span></li>
  <li data-type="taskItem"><input type="checkbox" /><span>任务 3</span></li>
</ul>

<h3>风险与对策</h3>
<table>
  <thead><tr><th>风险</th><th>影响</th><th>应对措施</th></tr></thead>
  <tbody>
    <tr><td></td><td></td><td></td></tr>
  </tbody>
</table>`,
  },
  {
    key: 'meeting-notes',
    name: '会议纪要',
    description: '会议主题、参会人、讨论记录、行动项',
    icon: <TeamOutlined />,
    color: '#2db7f5',
    content: `<h2>会议纪要</h2>
<p><strong>会议主题:</strong> </p>
<p><strong>日期:</strong> </p>
<p><strong>地点:</strong> </p>
<p><strong>主持人:</strong> </p>
<p><strong>记录人:</strong> </p>

<h3>参会人</h3>
<ul>
  <li>参会人 1</li>
  <li>参会人 2</li>
</ul>

<h3>议程</h3>
<ol>
  <li>议程 1</li>
  <li>议程 2</li>
</ol>

<h3>讨论记录</h3>
<h4>议题 1</h4>
<p>讨论内容...</p>
<h4>议题 2</h4>
<p>讨论内容...</p>

<h3>决议</h3>
<ul>
  <li>决议 1</li>
  <li>决议 2</li>
</ul>

<h3>行动项</h3>
<table>
  <thead><tr><th>行动项</th><th>负责人</th><th>截止日期</th><th>状态</th></tr></thead>
  <tbody>
    <tr><td>行动 1</td><td></td><td></td><td>待开始</td></tr>
    <tr><td>行动 2</td><td></td><td></td><td>待开始</td></tr>
  </tbody>
</table>`,
  },
  {
    key: 'tech-spec',
    name: '技术规格',
    description: '技术设计方案、架构说明、接口定义',
    icon: <CodeOutlined />,
    color: '#52c41a',
    content: `<h2>技术规格文档</h2>
<p><strong>版本:</strong> v1.0</p>
<p><strong>作者:</strong> </p>
<p><strong>评审人:</strong> </p>
<p><strong>日期:</strong> </p>

<h3>概述</h3>
<p>本技术方案的目标和背景...</p>

<h3>设计目标</h3>
<ul>
  <li>目标 1</li>
  <li>目标 2</li>
</ul>

<h3>非功能需求</h3>
<table>
  <thead><tr><th>需求</th><th>指标</th><th>备注</th></tr></thead>
  <tbody>
    <tr><td>性能</td><td></td><td></td></tr>
    <tr><td>可用性</td><td></td><td></td></tr>
    <tr><td>安全性</td><td></td><td></td></tr>
  </tbody>
</table>

<h3>系统架构</h3>
<p>架构说明...</p>

<h3>接口定义</h3>
<pre><code class="language-typescript">
interface ExampleAPI {
  getData(params: Request): Promise&lt;Response&gt;;
}
</code></pre>

<h3>数据模型</h3>
<pre><code class="language-typescript">
interface DataModel {
  id: string;
  name: string;
  createdAt: Date;
}
</code></pre>

<h3>风险评估</h3>
<ul>
  <li>风险 1: 描述 + 应对方案</li>
  <li>风险 2: 描述 + 应对方案</li>
</ul>`,
  },
  {
    key: 'api-reference',
    name: 'API 文档',
    description: 'API 端点、请求/响应格式、错误码',
    icon: <ApiOutlined />,
    color: '#faad14',
    content: `<h2>API 接口文档</h2>
<p><strong>Base URL:</strong> https://api.example.com/v1</p>
<p><strong>认证方式:</strong> Bearer Token</p>

<h3>接口列表</h3>
<table>
  <thead><tr><th>方法</th><th>端点</th><th>描述</th></tr></thead>
  <tbody>
    <tr><td>GET</td><td>/api/resource</td><td>获取资源列表</td></tr>
    <tr><td>POST</td><td>/api/resource</td><td>创建资源</td></tr>
    <tr><td>GET</td><td>/api/resource/:id</td><td>获取资源详情</td></tr>
    <tr><td>PATCH</td><td>/api/resource/:id</td><td>更新资源</td></tr>
    <tr><td>DELETE</td><td>/api/resource/:id</td><td>删除资源</td></tr>
  </tbody>
</table>

<h3>请求示例</h3>
<pre><code class="language-bash">
curl -X GET https://api.example.com/v1/api/resource \\
  -H "Authorization: Bearer &lt;token&gt;" \\
  -H "Content-Type: application/json"
</code></pre>

<h3>响应示例</h3>
<pre><code class="language-json">
{
  "success": true,
  "data": [
    {
      "id": "string",
      "name": "string",
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ]
}
</code></pre>

<h3>错误码</h3>
<table>
  <thead><tr><th>错误码</th><th>描述</th><th>HTTP 状态</th></tr></thead>
  <tbody>
    <tr><td>400</td><td>请求参数错误</td><td>Bad Request</td></tr>
    <tr><td>401</td><td>未认证</td><td>Unauthorized</td></tr>
    <tr><td>403</td><td>无权限</td><td>Forbidden</td></tr>
    <tr><td>404</td><td>资源不存在</td><td>Not Found</td></tr>
    <tr><td>500</td><td>服务器错误</td><td>Internal Server Error</td></tr>
  </tbody>
</table>`,
  },
  {
    key: 'bug-report',
    name: 'Bug 报告',
    description: '问题描述、复现步骤、环境信息',
    icon: <BugOutlined />,
    color: '#f5222d',
    content: `<h2>Bug 报告</h2>
<p><strong>Bug ID:</strong> </p>
<p><strong>报告人:</strong> </p>
<p><strong>报告日期:</strong> </p>
<p><strong>严重程度:</strong> <strong>高</strong> | 中 | 低</p>
<p><strong>状态:</strong> 待确认 | 已确认 | 修复中 | 已修复 | 已关闭</p>

<h3>问题描述</h3>
<p>详细描述遇到的问题...</p>

<h3>复现步骤</h3>
<ol>
  <li>步骤 1</li>
  <li>步骤 2</li>
  <li>步骤 3</li>
</ol>

<h3>实际结果</h3>
<p>实际发生的行为...</p>

<h3>预期结果</h3>
<p>预期的行为...</p>

<h3>环境信息</h3>
<table>
  <thead><tr><th>项目</th><th>值</th></tr></thead>
  <tbody>
    <tr><td>浏览器</td><td></td></tr>
    <tr><td>操作系统</td><td></td></tr>
    <tr><td>应用版本</td><td></td></tr>
  </tbody>
</table>

<h3>截图 / 日志</h3>
<p>附上相关截图或日志...</p>`,
  },
  {
    key: 'onboarding',
    name: '新人入职指南',
    description: '团队介绍、开发环境、工作流程',
    icon: <BookOutlined />,
    color: '#722ed1',
    content: `<h2>新人入职指南</h2>
<p>欢迎加入团队！以下是快速上手指南。</p>

<h3>团队介绍</h3>
<table>
  <thead><tr><th>成员</th><th>角色</th><th>职责</th></tr></thead>
  <tbody>
    <tr><td></td><td></td><td></td></tr>
  </tbody>
</table>

<h3>开发环境搭建</h3>
<ol>
  <li>安装 Node.js 18+</li>
  <li>克隆代码仓库</li>
  <li>安装依赖: <code>npm install</code></li>
  <li>配置环境变量</li>
  <li>启动开发服务: <code>npm run dev</code></li>
</ol>

<h3>技术栈</h3>
<ul>
  <li>前端: React + TypeScript + Ant Design</li>
  <li>后端: Node.js + Express</li>
  <li>数据库: PostgreSQL</li>
  <li>部署: Docker + Kubernetes</li>
</ul>

<h3>工作流程</h3>
<ol>
  <li>从 JIRA 领取任务</li>
  <li>创建功能分支</li>
  <li>开发 + 自测</li>
  <li>提交 PR + Code Review</li>
  <li>Merge 到主干</li>
</ol>

<h3>常用链接</h3>
<ul>
  <li>JIRA: <a href="#">jira.example.com</a></li>
  <li>文档: <a href="#">docs.example.com</a></li>
  <li>监控: <a href="#">grafana.example.com</a></li>
</ul>`,
  },
];

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: DocumentTemplate) => void;
}

export const TemplatePicker: React.FC<TemplatePickerProps> = ({ open, onClose, onSelect }) => {
  return (
    <Modal
      title={
        <Space>
          <BookOutlined style={{ color: colors.primary[500] }} />
          选择模板
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
    >
      <Text style={{ marginBottom: 12, display: 'block', color: '#8c8c8c' }}>
        选择一个模板快速创建文档，或选择「空白文档」从头开始。
      </Text>

      <Row gutter={[12, 12]}>
        {DOCUMENT_TEMPLATES.map((template) => (
          <Col span={8} key={template.key}>
            <Card
              hoverable
              size="small"
              style={{
                textAlign: 'center',
                cursor: 'pointer',
                borderColor: template.color,
                borderWidth: 1,
              }}
              onClick={() => onSelect(template)}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: `${template.color}15`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}
              >
                <span style={{ color: template.color, fontSize: 20 }}>{template.icon}</span>
              </div>
              <Text strong>{template.name}</Text>
              <Text style={{ display: 'block', fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                {template.description}
              </Text>
              <Button
                type="link"
                size="small"
                icon={<ArrowRightOutlined />}
                style={{ color: template.color, marginTop: 4 }}
              >
                使用此模板
              </Button>
            </Card>
          </Col>
        ))}
      </Row>
    </Modal>
  );
};
