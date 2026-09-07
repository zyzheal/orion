/**
 * Impact Analysis Page - Visualize CI impact on upstream/downstream dependencies
 */
import React, { useState } from 'react';
import {
  Typography,
  Card,
  Table,
  type TableColumnsType,
  Tag,
  Space,
  Button,
  Select,
  message,
  Empty,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  ReloadOutlined,
  CloudServerOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import { useQuery } from '@/providers/QueryProvider';
import { getCIs, getImpactAnalysis, type CIItem, type ImpactData } from '@/api/cmdb';

const { Title, Text } = Typography;

const ImpactAnalysisPage: React.FC = () => {
  const [selectedCIId, setSelectedCIId] = useState<string | undefined>();

  const {
    data: cis = [],
    isLoading: cisLoading,
    isError: cisError,
    error: cisQueryError,
    refetch,
  } = useQuery<CIItem[]>({
    queryKey: ['cmdb-cis-list'],
    queryFn: () => getCIs({ pageSize: 200 }).then((res) => res.data ?? []),
    staleTime: 30_000,
  });

  const {
    data: impact = null,
    isLoading: loading,
    isError: impactError,
    error: impactQueryError,
  } = useQuery<ImpactData | null>({
    queryKey: ['cmdb-impact', selectedCIId],
    queryFn: () =>
      selectedCIId
        ? getImpactAnalysis(selectedCIId).then((res) => (res as any).impact ?? null)
        : Promise.resolve(null),
    enabled: !!selectedCIId,
    staleTime: 30_000,
  });

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  React.useEffect(() => {
    if (cisError) {
      message.error(
        cisQueryError instanceof Error ? `加载配置项失败：${cisQueryError.message}` : '加载配置项失败'
      );
    }
  }, [cisError, cisQueryError]);

  React.useEffect(() => {
    if (impactError) {
      message.error(
        impactQueryError instanceof Error
          ? `加载影响分析失败：${impactQueryError.message}`
          : '加载影响分析失败'
      );
    }
  }, [impactError, impactQueryError]);

  const handleCISelect = (ciId: string) => {
    setSelectedCIId(ciId);
  };

  const typeIconMap: Record<string, React.ReactNode> = {
    host: <CloudServerOutlined />,
    k8s: <DeploymentUnitOutlined />,
    service: <DeploymentUnitOutlined />,
    application: <DeploymentUnitOutlined />,
  };

  const statusColorMap: Record<string, string> = {
    active: 'green',
    inactive: 'default',
    maintenance: 'orange',
    deprecated: 'red',
  };

  const ciColumns: TableColumnsType<CIItem> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: unknown, record: CIItem) => (
        <Space>
          {typeIconMap[record.type] || <CloudServerOutlined />}
          <Text strong>{String(text)}</Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: unknown) => <Tag color={colors.info[500]}>{String(type)}</Tag>,
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      render: (env: unknown) =>
        env ? (
          <Tag color={String(env) === 'production' ? colors.error[500] : colors.info[700]}>
            {String(env)}
          </Tag>
        ) : (
          '-'
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: unknown) => (
        <Tag color={statusColorMap[String(status)] || 'default'}>{String(status)}</Tag>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'owner',
      key: 'owner',
      render: (owner: unknown) => (owner ? String(owner) : '-'),
    },
  ];

  const isInitialLoading = loading && !impact;

  return (
    <div>
      {isInitialLoading && <PageSkeleton cards={3} rows={6} />}
      {isInitialLoading ? null : (
        <>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}
          >
            <div>
              <Title level={4}>影响分析</Title>
              <Text type="secondary">分析配置项变更对上下游系统的影响</Text>
            </div>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={cisLoading}>
              刷新
            </Button>
          </div>

          <Card style={{ marginBottom: spacing.md }}>
            <Space>
              <Text>选择配置项：</Text>
              <Select
                style={{ width: 300 }}
                placeholder="搜索并选择配置项"
                value={selectedCIId}
                onChange={handleCISelect}
                showSearch
                optionFilterProp="label"
                allowClear
              >
                {cis.map((ci) => (
                  <Select.Option key={ci.id} value={ci.id} label={ci.name}>
                    {ci.name} ({ci.type})
                  </Select.Option>
                ))}
              </Select>
            </Space>
          </Card>

          {impact && (
            <>
              <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="上游依赖"
                      value={impact.upstream?.length || 0}
                      prefix={<ArrowUpOutlined />}
                      valueStyle={{ color: colors.info[500] }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="下游影响"
                      value={impact.downstream?.length || 0}
                      prefix={<ArrowDownOutlined />}
                      valueStyle={{ color: colors.warning[500] }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="总影响范围"
                      value={impact.total_affected || 0}
                      prefix={<DeploymentUnitOutlined />}
                      valueStyle={{ color: colors.purple[500] }}
                    />
                  </Card>
                </Col>
              </Row>

              <Card title="上游依赖（依赖此配置项的其他系统）" style={{ marginBottom: spacing.md }}>
                {impact.upstream && impact.upstream.length > 0 ? (
                  <Table
                    columns={ciColumns}
                    dataSource={impact.upstream}
                    rowKey="id"
                    pagination={{ pageSize: 5 }}
                    size="small"
                  />
                ) : (
                  <Empty description="暂无上游依赖" />
                )}
              </Card>

              <Card title="下游影响（此配置项依赖的系统）">
                {impact.downstream && impact.downstream.length > 0 ? (
                  <Table
                    columns={ciColumns}
                    dataSource={impact.downstream}
                    rowKey="id"
                    pagination={{ pageSize: 5 }}
                    size="small"
                  />
                ) : (
                  <Empty description="暂无下游影响" />
                )}
              </Card>
            </>
          )}

          {!impact && !loading && (
            <Empty description="请选择配置项进行影响分析" style={{ marginTop: spacing.md * 2 }} />
          )}
        </>
      )}
    </div>
  );
};

export default ImpactAnalysisPage;
