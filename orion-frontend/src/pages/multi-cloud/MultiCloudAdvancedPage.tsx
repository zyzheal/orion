/**
 * Multi-Cloud Advanced Page
 * 多云进阶管理 - 合规检查、资源调度、跨区容灾、成本优化、网络编排
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  multiCloudApi,
  type CloudAccount,
  type CloudResource,
  type ComplianceReport,
  type ComplianceCheckResult,
  type SchedulingPolicy,
  type SchedulingDecision,
} from '@/api/multi-cloud';
import {
  Card, Table, Button, Modal, Form, Select, Input, Tag,
  message, Space, Statistic, Row, Col, Tabs,
  Badge as AntBadge, Descriptions, Timeline, Collapse, Progress, Typography,
} from 'antd';
import {
  CloudOutlined, GlobalOutlined, SafetyOutlined,
  PlusOutlined, ReloadOutlined, DollarOutlined,
  SwapOutlined, ThunderboltOutlined, AuditOutlined,
  ScheduleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  WarningOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';

const { Panel } = Collapse;
const { Title, Text } = Typography;

const MultiCloudAdvancedPage: React.FC = () => {
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [resources, setResources] = useState<CloudResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [accountModal, setAccountModal] = useState(false);
  const [drModal, setDrModal] = useState(false);
  const [_scheduleModal, setScheduleModal] = useState(false);
  const [complianceReport, setComplianceReport] = useState<ComplianceReport | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [schedulingPolicies, setSchedulingPolicies] = useState<SchedulingPolicy[]>([]);
  const [scheduleResult, setScheduleResult] = useState<SchedulingDecision | null>(null);
  const [scheduleResultLoading, setScheduleResultLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
    loadSchedulingPolicies();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accountRes, resourceRes] = await Promise.all([
        multiCloudApi.listCloudAccounts(),
        multiCloudApi.listCloudResources(),
      ]);
      const accountData = (accountRes as any)?.data ?? accountRes;
      const resourceData = (resourceRes as any)?.data ?? resourceRes;
      setAccounts(Array.isArray(accountData) ? accountData : []);
      setResources(Array.isArray(resourceData) ? resourceData : []);
    } catch {
      message.error('加载数据失败');
    }
    setLoading(false);
  };

  const loadSchedulingPolicies = async () => {
    try {
      const res = await multiCloudApi.listSchedulingPolicies();
      const data = (res as any)?.data ?? res;
      setSchedulingPolicies(Array.isArray(data) ? data : []);
    } catch {
      // Silent fail for scheduling policies
    }
  };

  const handleRunComplianceCheck = useCallback(async (categories?: string[]) => {
    setComplianceLoading(true);
    try {
      const res = await multiCloudApi.runComplianceCheck(categories);
      const data = (res as any)?.data ?? res;
      setComplianceReport(data);
      message.success('合规检查完成');
    } catch (error: unknown) {
      message.error(`合规检查失败: ${(error as Error).message}`);
    } finally {
      setComplianceLoading(false);
    }
  }, []);

  const handleScheduleResource = async (values: any) => {
    setScheduleResultLoading(true);
    try {
      const res = await multiCloudApi.scheduleResource({
        resourceType: values.resourceType,
        spec: {
          cpu: values.cpu,
          memoryMb: values.memoryMb,
          storageGb: values.storageGb,
        },
        policyId: values.policyId,
        preferredProvider: values.preferredProvider,
        preferredRegion: values.preferredRegion,
      });
      const data = (res as any)?.data ?? res;
      setScheduleResult(data);
      message.success('资源调度决策生成成功');
    } catch (error: unknown) {
      message.error(`调度失败: ${(error as Error).message}`);
    } finally {
      setScheduleResultLoading(false);
    }
  };

  const handleRegisterAccount = async (values: any) => {
    try {
      await multiCloudApi.registerCloudAccount({
        name: values.name,
        provider: values.provider,
        region: values.region,
        credentials_ref: `${values.credentials?.accessKeyId ?? ''}`,
        metadata: {},
      });
      message.success('云账号注册成功');
      setAccountModal(false);
      loadData();
    } catch {
      message.error('注册失败');
    }
  };

  const accountColumns = [
    { title: 'Name', dataIndex: 'account_name', key: 'account_name', render: (v: string, r: any) => v || r.name || '-' },
    {
      title: 'Provider',
      key: 'provider',
      render: (_: unknown, r: any) => {
        const p = r.provider_id || r.credential_type || r.provider || 'unknown';
        const colorMap: Record<string, string> = { aws: 'orange', azure: 'blue', gcp: 'red', alicloud: 'green', aliyun: 'green', tencent: 'cyan' };
        return <Tag color={colorMap[p] || 'default'}>{p.toUpperCase()}</Tag>;
      },
    },
    { title: 'Region', dataIndex: 'region', key: 'region' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <AntBadge
          status={status === 'active' ? 'success' : status === 'error' ? 'error' : 'default'}
          text={status}
        />
      ),
    },
    { title: 'Created', dataIndex: 'created_at', key: 'created_at', render: (d: string) => d ? new Date(d).toLocaleString() : '-' },
  ];

  const resourceColumns = [
    { title: 'Name', dataIndex: 'resource_name', key: 'resource_name', render: (v: string, r: any) => v || r.name || '-' },
    {
      title: 'Type',
      dataIndex: 'resource_type',
      key: 'resource_type',
      render: (t: string) => <Tag color="blue">{t}</Tag>,
    },
    { title: 'Region', dataIndex: 'region', key: 'region' },
    {
      title: 'Status',
      dataIndex: 'state',
      key: 'state',
      render: (s: string) => <Tag color={s === 'running' || s === 'active' ? 'green' : 'default'}>{s}</Tag>,
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: Record<string, string>) => tags ? Object.entries(tags).slice(0, 3).map(([k, v]) => <Tag key={k}>{k}={v}</Tag>) : '-',
    },
  ];

  // Severity color map
  const severityColorMap: Record<string, string> = {
    critical: 'red',
    high: 'orange',
    medium: 'blue',
    low: 'green',
  };

  const severityIconMap: Record<string, React.ReactNode> = {
    critical: <CloseCircleOutlined style={{ color: colors.error[500] }} />,
    high: <ExclamationCircleOutlined style={{ color: colors.warning[500] }} />,
    medium: <WarningOutlined style={{ color: colors.info[500] }} />,
    low: <CheckCircleOutlined style={{ color: colors.success[500] }} />,
  };

  const categoryLabelMap: Record<string, string> = {
    security: '安全',
    cost: '成本',
    governance: '治理',
    availability: '可用性',
    'data-residency': '数据驻留',
  };

  // Compliance check results table columns
  const complianceColumns = [
    {
      title: '状态',
      key: 'status',
      width: 60,
      render: (_: unknown, record: ComplianceCheckResult) =>
        record.passed
          ? <CheckCircleOutlined style={{ color: colors.success[500], fontSize: 18 }} />
          : <CloseCircleOutlined style={{ color: colors.error[500], fontSize: 18 }} />,
    },
    {
      title: '规则',
      dataIndex: 'ruleName',
      key: 'ruleName',
      render: (v: string, record: ComplianceCheckResult) => (
        <div>
          <Text strong>{v}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{record.ruleId}</Text>
        </div>
      ),
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 80,
      render: (v: string) => <Tag>{categoryLabelMap[v] || v}</Tag>,
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (v: string) => (
        <Space>
          {severityIconMap[v]}
          <Tag color={severityColorMap[v]}>{v}</Tag>
        </Space>
      ),
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
    },
    {
      title: '修复建议',
      dataIndex: 'remediation',
      key: 'remediation',
      ellipsis: true,
      render: (v: string) => v || '-',
    },
  ];

  return (
    <div style={{ padding: 24, background: colors.light.bg.secondary, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <CloudOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            多云进阶管理
          </Title>
          <Text type="secondary">合规检查、资源调度、跨区容灾、成本优化、网络编排</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAccountModal(true)}>
            注册账号
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 12, borderTop: `3px solid ${colors.primary[500]}` }}>
            <Statistic title="云账号" value={accounts.length} prefix={<CloudOutlined style={{ color: colors.primary[500] }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 12, borderTop: `3px solid ${colors.success[500]}` }}>
            <Statistic title="活跃厂商" value={Array.from(new Set(accounts.map(a => a.provider_id || a.credential_type || (a as any).provider))).length} prefix={<GlobalOutlined style={{ color: colors.success[500] }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 12, borderTop: `3px solid ${colors.info[500]}` }}>
            <Statistic title="总资源" value={resources.length} prefix={<SafetyOutlined style={{ color: colors.info[500] }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 12, borderTop: `3px solid ${colors.warning[500]}` }}>
            <Statistic title="覆盖区域" value={Array.from(new Set(accounts.map(a => a.region))).length} prefix={<SwapOutlined style={{ color: colors.warning[500] }} />} />
          </Card>
        </Col>
      </Row>

      <Tabs
        items={[
          {
            key: 'compliance',
            label: <><AuditOutlined /> 合规检查</>,
            children: (
              <Card
                title="合规检查报告"
                style={{ borderRadius: 12 }}
                extra={
                  <Space>
                    <Button
                      icon={<AuditOutlined />}
                      onClick={() => handleRunComplianceCheck()}
                      loading={complianceLoading}
                      type="primary"
                    >
                      执行合规检查
                    </Button>
                    <Select
                      placeholder="按类别筛选"
                      style={{ width: 140 }}
                      allowClear
                      onChange={(value) => value && handleRunComplianceCheck([value])}
                      options={[
                        { value: 'security', label: '安全' },
                        { value: 'cost', label: '成本' },
                        { value: 'governance', label: '治理' },
                        { value: 'availability', label: '可用性' },
                        { value: 'data-residency', label: '数据驻留' },
                      ]}
                    />
                  </Space>
                }
              >
                {complianceReport ? (
                  <>
                    <Row gutter={16} style={{ marginBottom: 24 }}>
                      <Col span={6}>
                        <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                          <Progress
                            type="dashboard"
                            percent={complianceReport.score}
                            strokeColor={complianceReport.score >= 80 ? colors.success[500] : complianceReport.score >= 60 ? colors.warning[500] : colors.error[500]}
                            format={(percent) => `${percent}%`}
                          />
                          <div style={{ marginTop: 8 }}>
                            <Text strong>合规评分</Text>
                          </div>
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                          <Statistic
                            title="总规则"
                            value={complianceReport.totalRules}
                            valueStyle={{ fontSize: 32 }}
                          />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small" style={{ textAlign: 'center', borderRadius: 8, borderTop: `2px solid ${colors.success[500]}` }}>
                          <Statistic
                            title="通过"
                            value={complianceReport.passedRules}
                            valueStyle={{ color: colors.success[500], fontSize: 32 }}
                            prefix={<CheckCircleOutlined />}
                          />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small" style={{ textAlign: 'center', borderRadius: 8, borderTop: `2px solid ${colors.error[500]}` }}>
                          <Statistic
                            title="未通过"
                            value={complianceReport.failedRules}
                            valueStyle={{ color: colors.error[500], fontSize: 32 }}
                            prefix={<CloseCircleOutlined />}
                          />
                        </Card>
                      </Col>
                    </Row>

                    <Table
                      columns={complianceColumns}
                      dataSource={complianceReport.results}
                      rowKey="ruleId"
                      size="small"
                      pagination={false}
                    />
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '48px 0' }}>
                    <AuditOutlined style={{ fontSize: 48, color: colors.neutral[300], marginBottom: 16 }} />
                    <div>
                      <Text type="secondary">点击"执行合规检查"按钮开始检查云资源合规性</Text>
                    </div>
                  </div>
                )}
              </Card>
            ),
          },
          {
            key: 'scheduling',
            label: <><ScheduleOutlined /> 资源调度</>,
            children: (
              <Row gutter={16}>
                <Col span={12}>
                  <Card
                    title="资源调度面板"
                    style={{ borderRadius: 12 }}
                    extra={
                      <Button type="primary" icon={<ScheduleOutlined />} onClick={() => setScheduleModal(true)}>
                        新建调度
                      </Button>
                    }
                  >
                    <Form layout="vertical" onFinish={handleScheduleResource}>
                      <Form.Item label="资源类型" name="resourceType" rules={[{ required: true }]}>
                        <Select
                          options={[
                            { value: 'compute', label: '计算资源' },
                            { value: 'storage', label: '存储资源' },
                            { value: 'database', label: '数据库' },
                            { value: 'container', label: '容器服务' },
                            { value: 'network', label: '网络资源' },
                          ]}
                        />
                      </Form.Item>
                      <Row gutter={16}>
                        <Col span={8}>
                          <Form.Item label="CPU (核)" name="cpu" initialValue={2}>
                            <Input type="number" />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label="内存 (MB)" name="memoryMb" initialValue={4096}>
                            <Input type="number" />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label="存储 (GB)" name="storageGb" initialValue={100}>
                            <Input type="number" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item label="调度策略" name="policyId">
                        <Select
                          placeholder="选择调度策略（可选）"
                          allowClear
                          options={schedulingPolicies.map(p => ({
                            value: p.id,
                            label: `${p.name} (${p.strategy})`,
                          }))}
                        />
                      </Form.Item>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item label="首选厂商" name="preferredProvider">
                            <Select
                              placeholder="不限"
                              allowClear
                              options={[
                                { value: 'aws', label: 'AWS' },
                                { value: 'azure', label: 'Azure' },
                                { value: 'gcp', label: 'GCP' },
                                { value: 'alicloud', label: '阿里云' },
                              ]}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item label="首选区域" name="preferredRegion">
                            <Input placeholder="如: us-east-1" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" loading={scheduleResultLoading} icon={<ScheduleOutlined />}>
                          生成调度决策
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="调度决策结果" style={{ borderRadius: 12 }}>
                    {scheduleResult ? (
                      <>
                        <Descriptions bordered column={1} size="small">
                          <Descriptions.Item label="推荐厂商">
                            <Tag color="green" style={{ fontSize: 14, padding: '4px 12px' }}>
                              {scheduleResult.selectedProvider.toUpperCase()}
                            </Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="推荐区域">
                            <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
                              {scheduleResult.selectedRegion}
                            </Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="预估月费">
                            <Text strong style={{ color: colors.primary[500], fontSize: 18 }}>
                              ${scheduleResult.estimatedCost.toFixed(2)}
                            </Text>
                          </Descriptions.Item>
                          <Descriptions.Item label="决策原因">
                            {scheduleResult.reason}
                          </Descriptions.Item>
                        </Descriptions>

                        {scheduleResult.alternatives.length > 0 && (
                          <div style={{ marginTop: 16 }}>
                            <Text strong>备选方案</Text>
                            <Table
                              dataSource={scheduleResult.alternatives}
                              rowKey={(r) => `${r.provider}-${r.region}`}
                              size="small"
                              pagination={false}
                              style={{ marginTop: 8 }}
                              columns={[
                                { title: '厂商', dataIndex: 'provider', render: (v: string) => <Tag>{v.toUpperCase()}</Tag> },
                                { title: '区域', dataIndex: 'region' },
                                { title: '预估费用', dataIndex: 'cost', render: (v: number) => `$${v.toFixed(2)}` },
                              ]}
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '48px 0' }}>
                        <ScheduleOutlined style={{ fontSize: 48, color: colors.neutral[300], marginBottom: 16 }} />
                        <div><Text type="secondary">填写左侧参数并提交，生成资源调度决策</Text></div>
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'accounts',
            label: <><CloudOutlined /> Cloud Accounts</>,
            children: (
              <Card
                title="Cloud Account Management"
                style={{ borderRadius: 12 }}
                extra={
                  <Space>
                    <Button icon={<PlusOutlined />} onClick={() => setAccountModal(true)}>
                      Register Account
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
                  </Space>
                }
              >
                <Table columns={accountColumns} dataSource={accounts} rowKey={(r: any) => r.id || r.account_id} loading={loading} />
              </Card>
            ),
          },
          {
            key: 'resources',
            label: <><SafetyOutlined /> Cloud Resources</>,
            children: (
              <Card title="Cloud Resources" style={{ borderRadius: 12 }} extra={<Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>}>
                <Table columns={resourceColumns} dataSource={resources} rowKey={(r: any) => r.id || r.resource_id} loading={loading} />
              </Card>
            ),
          },
          {
            key: 'disaster-recovery',
            label: <><GlobalOutlined /> Cross-Region DR</>,
            children: (
              <Card
                title="Cross-Region Disaster Recovery"
                style={{ borderRadius: 12 }}
                extra={<Button icon={<PlusOutlined />} onClick={() => setDrModal(true)}>Create DR Plan</Button>}
              >
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={8}>
                    <Card title="RPO (Recovery Point Objective)" size="small" style={{ borderRadius: 8 }}>
                      <Progress type="dashboard" percent={95} format={() => '5 min'} />
                      <p style={{ textAlign: 'center', marginTop: 8, color: colors.neutral[500] }}>Target: {'<'} 10 min</p>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card title="RTO (Recovery Time Objective)" size="small" style={{ borderRadius: 8 }}>
                      <Progress type="dashboard" percent={90} format={() => '15 min'} strokeColor={colors.warning[500]} />
                      <p style={{ textAlign: 'center', marginTop: 8, color: colors.neutral[500] }}>Target: {'<'} 30 min</p>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card title="DR Readiness" size="small" style={{ borderRadius: 8 }}>
                      <Progress type="dashboard" percent={88} strokeColor={colors.success[500]} />
                      <p style={{ textAlign: 'center', marginTop: 8, color: colors.neutral[500] }}>Status: Ready</p>
                    </Card>
                  </Col>
                </Row>
                <Descriptions bordered column={1}>
                  <Descriptions.Item label="Primary Region">
                    <Tag color="green">us-east-1 (AWS)</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Failover Region">
                    <Tag color="blue">ap-northeast-1 (AWS)</Tag>
                    <Tag color="orange">eastasia (Azure)</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Replication">
                    Async - Multi-region data replication enabled
                  </Descriptions.Item>
                  <Descriptions.Item label="Last DR Test">
                    2026-05-01 - Passed
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
          {
            key: 'cost-optimization',
            label: <><DollarOutlined /> Cost Optimization</>,
            children: (
              <Card title="Multi-Cloud Cost Optimization" style={{ borderRadius: 12 }}>
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={8}>
                    <Card size="small" style={{ borderRadius: 8, borderTop: `2px solid #FF9900` }}>
                      <Statistic title="Monthly Cost (AWS)" value={12500} prefix="$" valueStyle={{ color: colors.primary[500] }} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ borderRadius: 8, borderTop: `2px solid #0078D4` }}>
                      <Statistic title="Monthly Cost (Azure)" value={8200} prefix="$" valueStyle={{ color: colors.purple[500] }} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ borderRadius: 8, borderTop: `2px solid #4285F4` }}>
                      <Statistic title="Monthly Cost (GCP)" value={6300} prefix="$" valueStyle={{ color: colors.error[600] }} />
                    </Card>
                  </Col>
                </Row>
                <Collapse defaultActiveKey={['recommendations']}>
                  <Panel header="Cost Optimization Recommendations" key="recommendations">
                    <Timeline>
                      <Timeline.Item color="green">
                        <strong>Reserved Instances:</strong> Switch to 1-year reserved instances for stable workloads - estimated savings: $3,200/month
                      </Timeline.Item>
                      <Timeline.Item color="blue">
                        <strong>Spot Instances:</strong> Use spot instances for batch processing - estimated savings: $1,800/month
                      </Timeline.Item>
                      <Timeline.Item color="orange">
                        <strong>Right-sizing:</strong> 12 instances are over-provisioned - estimated savings: $900/month
                      </Timeline.Item>
                      <Timeline.Item color="red">
                        <strong>Idle Resources:</strong> 3 unused load balancers detected - estimated savings: $150/month
                      </Timeline.Item>
                    </Timeline>
                  </Panel>
                  <Panel header="Cost Allocation by Service" key="allocation">
                    <Descriptions bordered column={2}>
                      <Descriptions.Item label="Compute">45%</Descriptions.Item>
                      <Descriptions.Item label="Storage">25%</Descriptions.Item>
                      <Descriptions.Item label="Network">15%</Descriptions.Item>
                      <Descriptions.Item label="Database">10%</Descriptions.Item>
                      <Descriptions.Item label="Other">5%</Descriptions.Item>
                    </Descriptions>
                  </Panel>
                </Collapse>
              </Card>
            ),
          },
          {
            key: 'network-orchestration',
            label: <><ThunderboltOutlined /> Network Orchestration</>,
            children: (
              <Card title="Cloud Network Orchestration" style={{ borderRadius: 12 }}>
                <Descriptions bordered column={1}>
                  <Descriptions.Item label="VPC Peering">
                    <Tag color="green">Active</Tag> - 3 peering connections established
                  </Descriptions.Item>
                  <Descriptions.Item label="Cross-Cloud Connectivity">
                    <Tag color="green">Active</Tag> - AWS Direct Connect + Azure ExpressRoute
                  </Descriptions.Item>
                  <Descriptions.Item label="DNS Management">
                    Multi-cloud DNS routing enabled with latency-based failover
                  </Descriptions.Item>
                  <Descriptions.Item label="Security Groups">
                    Unified policy across 5 cloud accounts
                  </Descriptions.Item>
                </Descriptions>
                <Card size="small" title="Network Topology" style={{ marginTop: 16, borderRadius: 8 }}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Card size="small" title="AWS VPC" style={{ borderRadius: 8 }}>
                        <Tag>us-east-1</Tag> <Tag>us-west-2</Tag>
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small" title="Azure VNet" style={{ borderRadius: 8 }}>
                        <Tag>eastus</Tag> <Tag>westeurope</Tag>
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small" title="GCP VPC" style={{ borderRadius: 8 }}>
                        <Tag>us-central1</Tag>
                      </Card>
                    </Col>
                  </Row>
                </Card>
              </Card>
            ),
          },
        ]}
      />

      {/* Register Cloud Account Modal */}
      <Modal
        title="Register Cloud Account"
        open={accountModal}
        onCancel={() => setAccountModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleRegisterAccount}>
          <Form.Item label="Provider" name="provider" rules={[{ required: true }]}>
            <Select options={[
              { value: 'aws', label: 'AWS' },
              { value: 'azure', label: 'Azure' },
              { value: 'gcp', label: 'GCP' },
              { value: 'alicloud', label: '阿里云' },
              { value: 'tencent', label: '腾讯云' },
            ]} />
          </Form.Item>
          <Form.Item label="Account Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="aws-production" />
          </Form.Item>
          <Form.Item label="Region" name="region" rules={[{ required: true }]}>
            <Input placeholder="us-east-1" />
          </Form.Item>
          <Form.Item label="Access Key ID" name={['credentials', 'accessKeyId']}>
            <Input.Password />
          </Form.Item>
          <Form.Item label="Secret Access Key" name={['credentials', 'secretAccessKey']}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create DR Plan Modal */}
      <Modal
        title="Create DR Plan"
        open={drModal}
        onCancel={() => setDrModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Plan Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="primary-dr-plan" />
          </Form.Item>
          <Form.Item label="Primary Region" name="primary_region" rules={[{ required: true }]}>
            <Input placeholder="us-east-1" />
          </Form.Item>
          <Form.Item label="Failover Region" name="failover_region" rules={[{ required: true }]}>
            <Input placeholder="ap-northeast-1" />
          </Form.Item>
          <Form.Item label="RPO Target (minutes)" name="rpo_target">
            <Input type="number" defaultValue={10} />
          </Form.Item>
          <Form.Item label="RTO Target (minutes)" name="rto_target">
            <Input type="number" defaultValue={30} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MultiCloudAdvancedPage;
