/**
 * Artifact Detail Tabs - Detail drawer tab content (security, tests, deployments, tags, promotion)
 */
import React from 'react';
import { Typography, Tag, Space, Descriptions, Row, Col, Card, Statistic, Timeline, Button } from 'antd';
import { TagOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import type {
  Artifact, ArtifactStage, ArtifactStatus,
  PromotionRecord, Tag as TagType,
} from '@/api/artifacts';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// Reuse color maps
const stageColorMap: Record<ArtifactStage, string> = {
  snapshot: 'default',
  release_candidate: 'blue',
  stable: 'green',
  production: 'gold',
  archived: 'orange',
};
const stageLabelMap: Record<ArtifactStage, string> = {
  snapshot: 'Snapshot',
  release_candidate: 'RC',
  stable: 'Stable',
  production: 'Production',
  archived: 'Archived',
};
const statusColorMap: Record<ArtifactStatus, string> = {
  uploading: 'processing',
  available: 'success',
  deprecated: 'default',
  quarantined: 'error',
  deleted: 'default',
};
const typeLabelMap: Record<string, string> = {
  container_image: '容器镜像', base_image: '基础镜像', builder_image: '构建镜像',
  jar_artifact: 'JAR', war_artifact: 'WAR', npm_package: 'NPM', python_wheel: 'Python',
  go_module: 'Go', rust_crate: 'Rust', helm_chart: 'Helm Chart', terraform_module: 'Terraform',
  k8s_manifest: 'K8s Manifest', docker_compose: 'Docker Compose',
  test_report: '测试报告', coverage_report: '覆盖率报告', performance_report: '性能报告',
  sbom: 'SBOM', signature: '签名', security_scan_report: '安全扫描',
  api_doc: 'API 文档', changelog: '变更日志', release_notes: '发布说明',
};

const formatSize = (bytes: number): string => {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

// ---- Individual Tab Content Components ----

/** Basic Info Tab */
const InfoTab: React.FC<{ artifact: Artifact }> = ({ artifact }) => {
  const a = artifact;
  return (
    <Descriptions column={2} bordered size="small">
      <Descriptions.Item label="名称">{a.name}</Descriptions.Item>
      <Descriptions.Item label="版本">{a.version}</Descriptions.Item>
      <Descriptions.Item label="显示名称">{a.displayName || '-'}</Descriptions.Item>
      <Descriptions.Item label="命名空间">{a.namespace}</Descriptions.Item>
      <Descriptions.Item label="类型">{typeLabelMap[a.type] || a.type}</Descriptions.Item>
      <Descriptions.Item label="阶段"><Tag color={stageColorMap[a.stage]}>{stageLabelMap[a.stage]}</Tag></Descriptions.Item>
      <Descriptions.Item label="状态"><Tag color={statusColorMap[a.status]}>{a.status}</Tag></Descriptions.Item>
      <Descriptions.Item label="大小">{formatSize(a.sizeBytes)}</Descriptions.Item>
      <Descriptions.Item label="Digest"><Text code style={{ fontSize: 11 }}>{a.digest || '-'}</Text></Descriptions.Item>
      <Descriptions.Item label="存储后端">{a.storageBackend || '-'}</Descriptions.Item>
      <Descriptions.Item label="描述" span={2}>{a.description || '-'}</Descriptions.Item>
      {a.labels && (
        <Descriptions.Item label="标签" span={2}>
          <Space wrap>{Object.entries(a.labels).map(([k, v]) => <Tag key={k}>{k}: {String(v)}</Tag>)}</Space>
        </Descriptions.Item>
      )}
      <Descriptions.Item label="创建时间">{dayjs(a.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
      <Descriptions.Item label="更新时间">{dayjs(a.updatedAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
    </Descriptions>
  );
};

/** Security Scan Tab */
const SecurityTab: React.FC<{ artifact: Artifact }> = ({ artifact }) => {
  if (!artifact.security) return <Text type="secondary">暂无安全扫描数据</Text>;
  return (
    <div>
      <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="已签名">{artifact.security.signed ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag>}</Descriptions.Item>
        <Descriptions.Item label="签名者">{artifact.security.signer || '-'}</Descriptions.Item>
      </Descriptions>
      {artifact.security.scanResults && (
        <>
          <Title level={5}>漏洞统计</Title>
          <Row gutter={16}>
            <Col span={6}><Card size="small"><Statistic title="严重" value={artifact.security.scanResults.critical} valueStyle={{ color: artifact.security.scanResults.critical > 0 ? colors.error[600] : colors.success[600] }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="高危" value={artifact.security.scanResults.high} valueStyle={{ color: artifact.security.scanResults.high > 0 ? colors.error[500] : colors.success[600] }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="中危" value={artifact.security.scanResults.medium} valueStyle={{ color: artifact.security.scanResults.medium > 0 ? colors.warning[500] : colors.success[600] }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="低危" value={artifact.security.scanResults.low} valueStyle={{ color: colors.neutral[500] }} /></Card></Col>
          </Row>
        </>
      )}
    </div>
  );
};

/** Tests Tab */
const TestsTab: React.FC<{ artifact: Artifact }> = ({ artifact }) => {
  if (!artifact.tests) return <Text type="secondary">暂无测试数据</Text>;
  return (
    <div>
      {artifact.tests.unitTests && (
        <Descriptions column={2} bordered size="small" title="单元测试" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="通过">{artifact.tests.unitTests.passed}</Descriptions.Item>
          <Descriptions.Item label="失败">{artifact.tests.unitTests.failed}</Descriptions.Item>
          <Descriptions.Item label="覆盖率">{artifact.tests.unitTests.coverage ? `${artifact.tests.unitTests.coverage}%` : '-'}</Descriptions.Item>
        </Descriptions>
      )}
      {artifact.tests.integrationTests && (
        <Descriptions column={2} bordered size="small" title="集成测试" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="通过">{artifact.tests.integrationTests.passed}</Descriptions.Item>
          <Descriptions.Item label="失败">{artifact.tests.integrationTests.failed}</Descriptions.Item>
        </Descriptions>
      )}
    </div>
  );
};

/** Deployments Tab */
const DeploymentsTab: React.FC<{ artifact: Artifact }> = ({ artifact }) => {
  if (!artifact.deployments || artifact.deployments.length === 0) {
    return <Text type="secondary">暂无部署记录</Text>;
  }
  return (
    <Timeline items={artifact.deployments.map((d) => ({
      children: (
        <Space direction="vertical" size={0}>
          <Text strong>{d.environment}</Text>
          <Text type="secondary">
            <Tag color={d.status === 'success' ? 'green' : d.status === 'failed' ? 'red' : 'orange'}>{d.status}</Tag>
            {dayjs(d.deployedAt).format('YYYY-MM-DD HH:mm:ss')} by {d.deployedBy}
          </Text>
        </Space>
      ),
    }))} />
  );
};

/** Tags Tab */
const TagsTab: React.FC<{
  artifact: Artifact;
  tags: TagType[];
  onAddTags: (artifact: Artifact) => void;
}> = ({ artifact, tags, onAddTags }) => (
  <div>
    <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
      <Text type="secondary">管理制品标签</Text>
      <Button type="primary" size="small" icon={<TagOutlined />} onClick={() => onAddTags(artifact)}>添加标签</Button>
    </div>
    <Space wrap>
      {tags.length > 0 ? tags.map((t) => (
        <Tag key={t.id} closable>{t.name}</Tag>
      )) : <Text type="secondary">暂无标签</Text>}
    </Space>
  </div>
);

/** Promotion History Tab */
const PromotionTab: React.FC<{ history: PromotionRecord[] }> = ({ history }) => {
  if (history.length === 0) return <Text type="secondary">暂无晋升记录</Text>;
  return (
    <Timeline items={history.map((p) => ({
      color: stageColorMap[p.toStage] || 'blue',
      children: (
        <Space direction="vertical" size={0}>
          <Text strong>
            <Tag color={stageColorMap[p.fromStage]}>{stageLabelMap[p.fromStage]}</Tag>
            {' -> '}
            <Tag color={stageColorMap[p.toStage]}>{stageLabelMap[p.toStage]}</Tag>
          </Text>
          <Text type="secondary">
            {dayjs(p.promotedAt).format('YYYY-MM-DD HH:mm:ss')} by {p.promotedBy}
            {p.approvedBy && ` (审批: ${p.approvedBy})`}
          </Text>
          {p.reason && <Text type="secondary">{p.reason}</Text>}
        </Space>
      ),
    }))} />
  );
};

// ---- Tabs definition ----

export interface ArtifactTabItem {
  key: string;
  label: string;
  children: React.ReactNode;
}

export function getArtifactTabItems(
  selectedArtifact: Artifact | null,
  tags: TagType[],
  promotionHistory: PromotionRecord[],
  onAddTags: (artifact: Artifact) => void,
): ArtifactTabItem[] {
  if (!selectedArtifact) return [];
  const a = selectedArtifact;
  return [
    { key: 'info', label: '基本信息', children: <InfoTab artifact={a} /> },
    { key: 'security', label: '安全扫描', children: <SecurityTab artifact={a} /> },
    { key: 'tests', label: '测试结果', children: <TestsTab artifact={a} /> },
    { key: 'deployments', label: '部署历史', children: <DeploymentsTab artifact={a} /> },
    { key: 'tags', label: '标签', children: <TagsTab artifact={a} tags={tags} onAddTags={onAddTags} /> },
    { key: 'promotion', label: '晋升历史', children: <PromotionTab history={promotionHistory} /> },
  ];
}
