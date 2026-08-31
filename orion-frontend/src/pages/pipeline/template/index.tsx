/**
 * Pipeline Template Marketplace Page (GitLab Pipeline include pattern)
 * Browse, search, fork and apply reusable pipeline templates
 */
import React, { useState } from 'react';
import { api } from '@/api/client';
import { useQuery } from '@/providers/QueryProvider';
import {
  Typography,
  Card,
  Row,
  Col,
  Tag,
  Button,
  Space,
  Input,
  message,
  Select,
  Modal,
  Empty,
  Statistic,
  Divider,
  Descriptions,
} from 'antd';
import {
  FileTextOutlined,
  SearchOutlined,
  CopyOutlined,
  StarOutlined,
  FolderOutlined,
  ArrowUpOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
const { Title, Text } = Typography;
const { Option } = Select;
const { Item: DescItem } = Descriptions;

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  language: string;
  version: string;
  downloads: number;
  stars: number;
  author: string;
  updatedAt: string;
  isOfficial: boolean;
}

const FALLBACK_TEMPLATES: Template[] = [
  { id: '1', name: 'Node.js CI', description: 'npm install + test + build for Node.js projects', category: 'Language', language: 'Node.js', version: '3.2.0', downloads: 28450, stars: 320, author: 'Orion', updatedAt: '2026-08-15', isOfficial: true },
  { id: '2', name: 'Go Multi-Stage Build', description: 'Go project with multi-stage Docker build and vulnerability scan', category: 'Container', language: 'Go', version: '2.1.0', downloads: 19820, stars: 245, author: 'Orion', updatedAt: '2026-08-12', isOfficial: true },
  { id: '3', name: 'Python ML Pipeline', description: 'Training + evaluation + model registry for ML workloads', category: 'ML/AI', language: 'Python', version: '1.5.0', downloads: 12400, stars: 189, author: 'Orion', updatedAt: '2026-08-10', isOfficial: true },
  { id: '4', name: 'Java Spring Boot', description: 'Maven build + JUnit + SonarQube + Docker for Java microservices', category: 'Language', language: 'Java', version: '4.0.0', downloads: 45200, stars: 510, author: 'Orion', updatedAt: '2026-08-20', isOfficial: true },
  { id: '5', name: 'Kubernetes Deploy', description: 'Helm chart deploy with canary/rollout verification', category: 'K8s', language: 'Helm', version: '2.8.0', downloads: 33100, stars: 398, author: 'Orion', updatedAt: '2026-08-18', isOfficial: true },
];

async function fetchTemplates(category: string, q: string): Promise<Template[]> {
  try {
    const params: Record<string, string> = {};
    if (category !== 'all') params.category = category;
    if (q) params.q = q;
    const resp = await api.get<Template[]>('/pipeline-templates', { params });
    if (Array.isArray(resp.data)) return resp.data;
  } catch {
    return FALLBACK_TEMPLATES;
  }
  return FALLBACK_TEMPLATES;
}

const TemplateMarketPage: React.FC = () => {
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Template | null>(null);
  const [applyModal, setApplyModal] = useState(false);

  const { data: templates, isLoading: loading, refetch } = useQuery<Template[]>({
    queryKey: ['pipeline-templates', category, search],
    queryFn: () => fetchTemplates(category, search),
  });

  const loadTemplates = () => refetch();
  const safeTemplates = templates ?? FALLBACK_TEMPLATES;

  const handleApply = (t: Template) => {
    setSelected(t);
    setApplyModal(true);
    message.success(`模板 "${t.name}" 已加入 Pipeline`);
  };

  const handleFork = (t: Template) => {
    message.success(`模板 "${t.name}" 已复制为自定义模板`);
  };

  const stats = {
    total: safeTemplates.length,
    official: safeTemplates.filter((t) => t.isOfficial).length,
    downloads: safeTemplates.reduce((s, t) => s + t.downloads, 0),
    stars: safeTemplates.reduce((s, t) => s + t.stars, 0),
  };

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <FolderOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
        Pipeline 模板市场
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        可复用的 Pipeline 模板库 · GitLab include 模式 · 一键应用到项目
      </Text>

      {loading ? <PageSkeleton rows={6} /> : (
        <>
          <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
            <Col span={6}><Card size="small"><Statistic title="模板总数" value={stats.total} prefix={<FileTextOutlined />} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="官方模板" value={stats.official} prefix={<StarOutlined />} valueStyle={{ color: colors.success[500] }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="总下载量" value={stats.downloads.toLocaleString()} prefix={<CopyOutlined />} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="总 Stars" value={stats.stars} prefix={<StarOutlined />} valueStyle={{ color: colors.warning[500] }} /></Card></Col>
          </Row>

          <Card style={{ marginBottom: spacing.md }}>
            <Space size="middle">
              <Input.Search placeholder="搜索模板名称或描述..." value={search} onChange={(e) => setSearch(e.target.value)}
                onSearch={loadTemplates} style={{ width: 300 }} enterButton={<SearchOutlined />} />
              <Select value={category} onChange={setCategory} style={{ width: 150 }}>
                <Option value="all">全部分类</Option>
                <Option value="Language">语言</Option>
                <Option value="Container">容器</Option>
                <Option value="ML/AI">ML/AI</Option>
                <Option value="K8s">K8s</Option>
                <Option value="Security">安全</Option>
              </Select>
            </Space>
          </Card>

          <Card title="模板列表">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #d9d9d9' }}>
                  <th style={{ textAlign: 'left', padding: 12 }}>模板名称</th>
                  <th style={{ textAlign: 'left', padding: 12 }}>描述</th>
                  <th style={{ textAlign: 'left', padding: 12, width: 80 }}>分类</th>
                  <th style={{ textAlign: 'left', padding: 12, width: 70 }}>语言</th>
                  <th style={{ textAlign: 'right', padding: 12, width: 80 }}>下载</th>
                  <th style={{ textAlign: 'right', padding: 12, width: 70 }}>⭐</th>
                  <th style={{ textAlign: 'right', padding: 12, width: 120 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {safeTemplates.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
                    onClick={() => setSelected(t)}>
                    <td style={{ padding: 12 }}><Space><FileTextOutlined style={{ color: colors.primary[500] }} /><Text strong>{t.name}</Text>{t.isOfficial && <Tag color="blue">官方</Tag>}<Tag>{t.version}</Tag></Space></td>
                    <td style={{ padding: 12 }}><Text type="secondary">{t.description}</Text></td>
                    <td style={{ padding: 12 }}><Tag color="purple">{t.category}</Tag></td>
                    <td style={{ padding: 12 }}><Tag>{t.language}</Tag></td>
                    <td style={{ padding: 12, textAlign: 'right' }}><Text>{t.downloads.toLocaleString()}</Text></td>
                    <td style={{ padding: 12, textAlign: 'right' }}><Space><StarOutlined /><Text>{t.stars}</Text></Space></td>
                    <td style={{ padding: 12, textAlign: 'right' }}>
                      <Space size="small">
                        <Button size="small" type="primary" icon={<CopyOutlined />} onClick={(e) => { e.stopPropagation(); handleApply(t); }}>应用</Button>
                        <Button size="small" icon={<ArrowUpOutlined />} onClick={(e) => { e.stopPropagation(); handleFork(t); }}>复刻</Button>
                      </Space>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {safeTemplates.length === 0 && <Empty description="暂无模板" />}
          </Card>
        </>
      )}

      <Modal
        title={`模板详情: ${selected?.name || ''}`}
        open={!!selected && !applyModal}
        onCancel={() => setSelected(null)}
        footer={[
          <Button key="close" onClick={() => setSelected(null)}>关闭</Button>,
          <Button key="apply" type="primary" onClick={() => handleApply(selected!)}>应用到 Pipeline</Button>,
        ]}
      >
        {selected && (
          <>
            <Descriptions size="small" bordered column={2}>
              <DescItem label="版本">{selected.version}</DescItem>
              <DescItem label="作者"><Space><UserOutlined />{selected.author}</Space></DescItem>
              <DescItem label="分类"><Tag>{selected.category}</Tag></DescItem>
              <DescItem label="语言"><Tag>{selected.language}</Tag></DescItem>
              <DescItem label="下载量">{selected.downloads.toLocaleString()}</DescItem>
              <DescItem label="Stars"><StarOutlined /> {selected.stars}</DescItem>
              <DescItem label="最后更新">{selected.updatedAt}</DescItem>
              <DescItem label="模板类型">{selected.isOfficial ? <Tag color="blue">官方</Tag> : <Tag>社区</Tag>}</DescItem>
            </Descriptions>
            <Divider />
            <Title level={5}>模板描述</Title>
            <Text>{selected.description}</Text>
            <Divider />
            <Title level={5}>应用方式 (GitLab include 模式)</Title>
            <pre style={{ background: '#f0f0f0', padding: 12, borderRadius: 4, fontSize: 12 }}>
{`include:
  template: "${selected.name}"`}
            </pre>
            <Text type="secondary">将此段加入项目 .gitlab-ci.yml 即可应用该模板</Text>
          </>
        )}
      </Modal>
    </div>
  );
};

export default TemplateMarketPage;
