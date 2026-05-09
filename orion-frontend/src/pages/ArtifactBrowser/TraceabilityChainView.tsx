/**
 * Traceability Chain View - Visualizes the full chain from artifact to deployment
 * Shows: Artifact Version -> Pipeline Run -> Source Commit -> Deployment
 */
import React from 'react';
import {
  Timeline,
  Tag,
  Space,
  Descriptions,
  Typography,
  Card,
  Tooltip,
} from 'antd';
import {
  GithubOutlined,
  BranchesOutlined,
  RocketOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  CodeOutlined,
  BuildOutlined,
  DeploymentUnitOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import type { TraceabilityChain } from '@/api/artifactVersions';
import dayjs from 'dayjs';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

// Status icon mapping
const statusIconMap: Record<string, React.ReactNode> = {
  success: <CheckCircleOutlined style={{ color: colors.success[600] }} />,
  failed: <CloseCircleOutlined style={{ color: colors.error[600] }} />,
  running: <SyncOutlined spin style={{ color: colors.primary[600] }} />,
  pending: <ClockCircleOutlined style={{ color: colors.neutral[500] }} />,
};

interface TraceabilityChainViewProps {
  chain: TraceabilityChain | null;
  loading: boolean;
}

const TraceabilityChainView: React.FC<TraceabilityChainViewProps> = ({ chain, loading }) => {
  if (loading) {
    return (
      <Card loading title="追溯链加载中...">
        <div style={{ height: 200 }} />
      </Card>
    );
  }

  if (!chain) {
    return (
      <Card>
        <Text type="secondary">暂无追溯数据</Text>
      </Card>
    );
  }

  const { version, pipelineRun, deployments } = chain;

  return (
    <div>
      {/* Version Info Header */}
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        title={
          <Space>
            <BuildOutlined />
            <span>制品版本: {version.version}</span>
            <Tag color="blue">{version.stageName}</Tag>
          </Space>
        }
      >
        <Descriptions column={2} size="small">
          <Descriptions.Item label="制品名称">{version.artifactName}</Descriptions.Item>
          <Descriptions.Item label="存储路径">
            <Text code style={{ fontSize: 11 }}>{version.storagePath}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(version.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="Run ID">
            <Text code style={{ fontSize: 11 }}>{version.runId}</Text>
          </Descriptions.Item>
          {version.commitSha && (
            <Descriptions.Item label="Commit SHA">
              <Tooltip title="查看代码提交">
                <Text code style={{ fontSize: 11, cursor: 'pointer' }}>
                  <GithubOutlined /> {version.commitSha.slice(0, 7)}
                </Text>
              </Tooltip>
            </Descriptions.Item>
          )}
          {version.branch && (
            <Descriptions.Item label="分支">
              <Tag color="geekblue"><BranchesOutlined /> {version.branch}</Tag>
            </Descriptions.Item>
          )}
          {Object.keys(version.metadata).length > 0 && (
            <Descriptions.Item label="元数据" span={2}>
              <Space wrap>
                {Object.entries(version.metadata).map(([k, v]) => (
                  <Tag key={k}>
                    {k}: {v}
                  </Tag>
                ))}
              </Space>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Traceability Chain Timeline */}
      <Card
        size="small"
        title={
          <Space>
            <LinkOutlined />
            <span>追溯链</span>
          </Space>
        }
      >
        <Timeline
          items={[
            // 1. Source Commit (earliest)
            {
              color: version.commitSha ? 'blue' : 'gray',
              dot: version.commitSha ? <GithubOutlined /> : undefined,
              children: (
                <Card size="small" type="inner">
                  <Title level={5} style={{ margin: '0 0 8px' }}>
                    源代码提交
                  </Title>
                  {version.commitSha ? (
                    <Space direction="vertical" size={4}>
                      <Text>
                        Commit: <Text code>{version.commitSha.slice(0, 7)}</Text>
                      </Text>
                      {version.branch && (
                        <Text>
                          分支: <Tag color="geekblue">{version.branch}</Tag>
                        </Text>
                      )}
                    </Space>
                  ) : (
                    <Text type="secondary">无关联的代码提交</Text>
                  )}
                </Card>
              ),
            },
            // 2. Pipeline Run
            {
              color: pipelineRun ? (pipelineRun.status === 'success' ? 'green' : 'red') : 'gray',
              dot: pipelineRun ? (
                statusIconMap[pipelineRun.status] || <SyncOutlined />
              ) : undefined,
              children: (
                <Card size="small" type="inner">
                  <Title level={5} style={{ margin: '0 0 8px' }}>
                    <RocketOutlined /> Pipeline 运行
                  </Title>
                  {pipelineRun ? (
                    <Space direction="vertical" size={4}>
                      <Space>
                        <Text>Run ID:</Text>
                        <Text code style={{ fontSize: 11 }}>{pipelineRun.id}</Text>
                      </Space>
                      <Space>
                        <Text>触发方式:</Text>
                        <Tag>{pipelineRun.triggerType}</Tag>
                        <Text>状态:</Text>
                        <Tag
                          color={
                            pipelineRun.status === 'success'
                              ? 'green'
                              : pipelineRun.status === 'failed'
                              ? 'red'
                              : 'orange'
                          }
                        >
                          {pipelineRun.status}
                        </Tag>
                      </Space>
                      {pipelineRun.startedAt && (
                        <Text type="secondary">
                          开始: {dayjs(pipelineRun.startedAt).format('YYYY-MM-DD HH:mm:ss')}
                        </Text>
                      )}
                      {pipelineRun.completedAt && (
                        <Text type="secondary">
                          完成: {dayjs(pipelineRun.completedAt).format('YYYY-MM-DD HH:mm:ss')}
                          {pipelineRun.startedAt && (
                            <Text type="secondary">
                              {' '}
                              (耗时{' '}
                              {dayjs(pipelineRun.completedAt).diff(dayjs(pipelineRun.startedAt), 'second')}
                              秒)
                            </Text>
                          )}
                        </Text>
                      )}
                    </Space>
                  ) : (
                    <Text type="secondary">Pipeline 运行记录不可用</Text>
                  )}
                </Card>
              ),
            },
            // 3. Artifact Version
            {
              color: 'blue',
              dot: <BuildOutlined />,
              children: (
                <Card size="small" type="inner">
                  <Title level={5} style={{ margin: '0 0 8px' }}>
                    <CodeOutlined /> 制品产出
                  </Title>
                  <Space direction="vertical" size={4}>
                    <Text>
                      版本: <Text strong>{version.version}</Text>
                    </Text>
                    <Text>
                      名称: {version.artifactName}
                    </Text>
                    <Text type="secondary">
                      {dayjs(version.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                    </Text>
                  </Space>
                </Card>
              ),
            },
            // 4. Deployments (latest)
            {
              color: deployments && deployments.length > 0 ? 'green' : 'gray',
              dot: <DeploymentUnitOutlined />,
              children: (
                <Card size="small" type="inner">
                  <Title level={5} style={{ margin: '0 0 8px' }}>
                    <DeploymentUnitOutlined /> 部署记录
                  </Title>
                  {deployments && deployments.length > 0 ? (
                    <Timeline
                      items={deployments.map((d) => ({
                        color:
                          d.status === 'success'
                            ? 'green'
                            : d.status === 'failed'
                            ? 'red'
                            : 'orange',
                        dot: statusIconMap[d.status] || undefined,
                        children: (
                          <Space direction="vertical" size={0}>
                            <Space>
                              <Tag
                                color={
                                  d.status === 'success'
                                    ? 'green'
                                    : d.status === 'failed'
                                    ? 'red'
                                    : 'orange'
                                }
                              >
                                {d.environment}
                              </Tag>
                              <Text strong>{d.status}</Text>
                            </Space>
                            <Text type="secondary">
                              {dayjs(d.deployedAt).format('YYYY-MM-DD HH:mm:ss')}
                              {d.deployedBy && ` by ${d.deployedBy}`}
                            </Text>
                          </Space>
                        ),
                      }))}
                    />
                  ) : (
                    <Text type="secondary">暂无部署记录</Text>
                  )}
                </Card>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default TraceabilityChainView;
