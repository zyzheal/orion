/**
 * Security Compliance Page
 * Phase 3 - Audit logs, compliance reports, and security policy management
 *
 * Features:
 * - Compliance policy management
 * - Compliance evaluation and scoring
 * - Audit log chain verification
 * - Integrity report generation
 * - Audit plan management
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  message,
  Typography,
  Tabs,
  Modal,
  Form,
  Input,
  Select,
} from 'antd';
import {
  SecurityScanOutlined,
  ReloadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,} from '@ant-design/icons';
import {
  getAuditLogs,
  verifyChain,
  getChainInfo,
  generateReport,
  getReports,
  type AuditLogEntry,
  type IntegrityReport,
} from '@/api/audit';
import {
  getSbomComplianceReport,
  type SbomComplianceReport,
} from '@/api/sbom';
import {
  complianceApi,
  type CompliancePolicy,
  type ComplianceEvaluation,
  type ComplianceScore,
  type AuditPlan,
} from '@/api/compliance';
import { colors } from '@/tokens';

// API 响应包装接口
interface AuditLogResponse { data?: { entries?: AuditLogEntry[] } }
interface ChainInfoResponse { data?: { totalEntries?: number } }
interface IntegrityReportResponse { data?: { reports?: IntegrityReport[] } }
interface ComplianceReportResponse { data?: SbomComplianceReport }

const { Title, Text } = Typography;

const statusColorMap: Record<string, string> = {
  compliant: 'green',
  non_compliant: 'red',
  partial: 'orange',
};

const statusLabelMap: Record<string, string> = {
  compliant: '合规',
  non_compliant: '不合规',
  partial: '部分合规',
};

const CompliancePage: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [_complianceReports, setComplianceReports] = useState<SbomComplianceReport | null>(null);
  const [integrityReports, setIntegrityReports] = useState<IntegrityReport[]>([]);
  const [policies, setPolicies] = useState<CompliancePolicy[]>([]);
  const [evaluations, setEvaluations] = useState<ComplianceEvaluation[]>([]);
  const [complianceScore, setComplianceScore] = useState<ComplianceScore | null>(null);
  const [auditPlans, setAuditPlans] = useState<AuditPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [chainInfo, setChainInfo] = useState<{ totalEntries: number; isValid: boolean } | null>(null);
  const [createPolicyModal, setCreatePolicyModal] = useState(false);
  const [createAuditPlanModal, setCreateAuditPlanModal] = useState(false);
  const [policyForm] = Form.useForm();
  const [auditPlanForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        logRes,
        chainInfoRes,
        reportRes,
        complianceRes,
        policiesRes,
        scoreRes,
        auditPlansRes,
      ] = await Promise.allSettled([
        getAuditLogs(),
        getChainInfo(),
        getReports(),
        getSbomComplianceReport(),
        complianceApi.listPolicies(),
        complianceApi.getComplianceScore(),
        complianceApi.listAuditPlans(),
      ]);

      // Audit logs
      if (logRes.status === 'fulfilled') {
        const logData = logRes.value.data as AuditLogResponse;
        setAuditLogs(logData?.data?.entries || []);
      }

      // Chain info
      if (chainInfoRes.status === 'fulfilled') {
        const chainData = chainInfoRes.value.data as ChainInfoResponse;
        setChainInfo({ totalEntries: chainData?.data?.totalEntries || 0, isValid: true });
      }

      // Integrity reports
      if (reportRes.status === 'fulfilled') {
        const reportData = reportRes.value.data as IntegrityReportResponse;
        setIntegrityReports(reportData?.data?.reports || []);
      }

      // SBOM compliance
      if (complianceRes.status === 'fulfilled') {
        const complianceData = complianceRes.value.data as ComplianceReportResponse;
        setComplianceReports(complianceData?.data || null);
      }

      // Policies
      if (policiesRes.status === 'fulfilled') {
        setPolicies(Array.isArray(policiesRes.value) ? policiesRes.value : []);
      }

      // Compliance score
      if (scoreRes.status === 'fulfilled') {
        setComplianceScore(scoreRes.value);
      }

      // Audit plans
      if (auditPlansRes.status === 'fulfilled') {
        setAuditPlans(Array.isArray(auditPlansRes.value) ? auditPlansRes.value : []);
      }
    } catch {
      message.error('加载合规数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      await generateReport();
      message.success('合规报告已生成');
      loadData();
    } catch {
      message.error('生成报告失败');
    }
  };

  const handleVerifyChain = async () => {
    try {
      await verifyChain();
      message.success('链验证完成');
      loadData();
    } catch {
      message.error('链验证失败');
    }
  };

  const handleEvaluate = async (policyId: string) => {
    try {
      const result = await complianceApi.evaluateCompliance({ policyId });
      message.success('合规评估完成');
      setEvaluations([...evaluations, result]);
      loadData();
    } catch (error: unknown) {
      message.error(`评估失败: ${(error as Error).message}`);
    }
  };

  const handleCreatePolicy = async (values: any) => {
    try {
      await complianceApi.definePolicy({
        name: values.name,
        framework: values.framework,
        description: values.description || '',
        rules: (values.rules || '').split('\n').filter(Boolean).map((line: string) => {
          const [name, condition, severity] = line.split('|').map((s: string) => s.trim());
          return { id: `rule-${Date.now()}`, name: name || '', condition: condition || '', severity: (severity as 'critical' | 'high' | 'medium' | 'low') || 'medium' };
        }),
      });
      message.success('合规策略创建成功');
      setCreatePolicyModal(false);
      policyForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`创建策略失败: ${(error as Error).message}`);
    }
  };

  const handleCreateAuditPlan = async (values: any) => {
    try {
      await complianceApi.createAuditPlan({
        name: values.name,
        scope: values.scope ? values.scope.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        schedule: values.schedule || '0 0 * * *',
      });
      message.success('审计计划创建成功');
      setCreateAuditPlanModal(false);
      auditPlanForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`创建审计计划失败: ${(error as Error).message}`);
    }
  };

  const handleExecuteAudit = async (auditId: string) => {
    try {
      await complianceApi.executeAudit(auditId);
      message.success('审计执行成功');
      loadData();
    } catch (error: unknown) {
      message.error(`执行审计失败: ${(error as Error).message}`);
    }
  };

  // Stats
  const nonCompliantCount = evaluations.filter((e) => e.status === 'non_compliant').length;
  const totalViolations = evaluations.reduce((sum, e) => sum + e.violations.length, 0);
  const overallScore = complianceScore?.overall ?? 0;

  // Policy columns
  const policyColumns = [
    {
      title: '策略名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: '框架',
      dataIndex: 'framework',
      key: 'framework',
      width: 120,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <Tag color={v === 'active' ? 'green' : 'default'}>{v === 'active' ? '活跃' : '未激活'}</Tag>,
    },
    {
      title: '规则数',
      key: 'ruleCount',
      width: 80,
      render: (_: unknown, record: CompliancePolicy) => record.rules?.length || 0,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: CompliancePolicy) => (
        <Button type="link" size="small" onClick={() => handleEvaluate(record.id)}>
          评估
        </Button>
      ),
    },
  ];

  // Audit plan columns
  const auditPlanColumns = [
    {
      title: '计划名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
    },
    {
      title: '范围',
      key: 'scope',
      width: 200,
      render: (_: unknown, record: AuditPlan) =>
        (record.scope || []).slice(0, 3).map((s: string) => <Tag key={s}>{s}</Tag>),
    },
    {
      title: '调度',
      dataIndex: 'schedule',
      key: 'schedule',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const colorMap: Record<string, string> = { pending: 'default', running: 'processing', completed: 'success', failed: 'error' };
        const labelMap: Record<string, string> = { pending: '待执行', running: '执行中', completed: '已完成', failed: '失败' };
        return <Tag color={colorMap[v] || 'default'}>{labelMap[v] || v}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: AuditPlan) =>
        record.status === 'pending' ? (
          <Button type="link" size="small" onClick={() => handleExecuteAudit(record.id)}>
            执行
          </Button>
        ) : null,
    },
  ];

  // Audit log columns
  const auditColumns = [
    { title: '操作', dataIndex: 'action', key: 'action', width: 160 },
    { title: '用户', dataIndex: 'userId', key: 'userId', width: 120 },
    { title: '资源类型', dataIndex: 'resourceType', key: 'resourceType', width: 120 },
    { title: '序列号', dataIndex: 'sequenceNumber', key: 'sequenceNumber', width: 100 },
    { title: 'IP 地址', dataIndex: 'ipAddress', key: 'ipAddress', width: 140 },
    { title: '时间戳', dataIndex: 'timestamp', key: 'timestamp', width: 180 },
  ];

  const tabItems = [
    {
      key: 'policies',
      label: '合规策略',
      children: (
        <Table
          columns={policyColumns}
          dataSource={policies}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      ),
    },
    {
      key: 'evaluations',
      label: '评估结果',
      children: evaluations.length > 0 ? (
        <Table
          columns={[
            {
              title: '策略',
              dataIndex: 'policyId',
              key: 'policyId',
              width: 140,
              render: (v: string) => v.slice(0, 12) + '...',
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              width: 120,
              render: (v: string) => <Tag color={statusColorMap[v]}>{statusLabelMap[v]}</Tag>,
            },
            {
              title: '分数',
              dataIndex: 'score',
              key: 'score',
              width: 80,
              render: (v: number) => `${v}%`,
            },
            {
              title: '违规数',
              key: 'violations',
              width: 80,
              render: (_: unknown, record: ComplianceEvaluation) => record.violations.length,
            },
            {
              title: '评估时间',
              dataIndex: 'evaluatedAt',
              key: 'evaluatedAt',
              width: 180,
              render: (v: string) => new Date(v).toLocaleString('zh-CN'),
            },
          ]}
          dataSource={evaluations}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      ) : (
        <Text type="secondary">暂无评估结果，点击策略的"评估"按钮开始评估</Text>
      ),
    },
    {
      key: 'audit',
      label: '审计日志',
      children: (
        <Table
          columns={auditColumns}
          dataSource={auditLogs.slice(0, 50)}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      ),
    },
    {
      key: 'audit-plans',
      label: '审计计划',
      children: (
        <Table
          columns={auditPlanColumns}
          dataSource={auditPlans}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      ),
    },
    {
      key: 'reports',
      label: '完整性报告',
      children: integrityReports.length > 0 ? (
        <Table
          columns={[
            { title: '生成时间', dataIndex: 'generatedAt', key: 'generatedAt', width: 180 },
            {
              title: '有效性',
              dataIndex: 'isValid',
              key: 'isValid',
              width: 100,
              render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '有效' : '无效'}</Tag>,
            },
            { title: '总条目', dataIndex: 'totalEntries', key: 'totalEntries', width: 100 },
            { title: '已验证', dataIndex: 'verifiedEntries', key: 'verifiedEntries', width: 100 },
            {
              title: '问题',
              key: 'issues',
              width: 80,
              render: (_: unknown, record: IntegrityReport) => record.issues?.length || 0,
            },
          ]}
          dataSource={integrityReports}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      ) : (
        <Text type="secondary">暂无完整性报告，点击"生成报告"按钮创建</Text>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <SafetyCertificateOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            <SecurityScanOutlined style={{ marginRight: 8 }} />
            安全与合规
          </Title>
          <Text type="secondary">合规策略管理、审计日志链验证和完整性报告</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => setCreatePolicyModal(true)}>
            新建策略
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => setCreateAuditPlanModal(true)}>
            审计计划
          </Button>
          <Button icon={<FileTextOutlined />} onClick={handleGenerateReport}>
            生成报告
          </Button>
          <Button icon={<CheckCircleOutlined />} onClick={handleVerifyChain}>
            验证链
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="合规分数"
              value={overallScore}
              suffix="/ 100"
              valueStyle={{ color: overallScore >= 80 ? colors.success[500] : colors.warning[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="合规策略" value={policies.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="不合规评估"
              value={nonCompliantCount}
              valueStyle={{ color: nonCompliantCount > 0 ? colors.error[400] : colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总违规数"
              value={totalViolations}
              valueStyle={{ color: totalViolations > 0 ? colors.error[400] : colors.success[500] }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabbed content */}
      <Card>
        <Tabs defaultActiveKey="policies" items={tabItems} />
      </Card>

      {/* Chain Info */}
      {chainInfo && (
        <Card title="审计日志链状态" style={{ marginTop: 16 }}>
          <Row gutter={24}>
            <Col span={8}>
              <Statistic title="总条目数" value={chainInfo.totalEntries} />
            </Col>
            <Col span={8}>
              <Statistic
                title="链完整性"
                value={chainInfo.isValid ? '有效' : '无效'}
                valueStyle={{ color: chainInfo.isValid ? colors.success[500] : colors.error[400] }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="合规趋势"
                value={complianceScore?.trend === 'improving' ? '改善中' : complianceScore?.trend === 'degrading' ? '恶化中' : '稳定'}
                valueStyle={{
                  color: complianceScore?.trend === 'improving' ? colors.success[500] : complianceScore?.trend === 'degrading' ? colors.error[400] : colors.warning[500],
                }}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* Create Policy Modal */}
      <Modal
        title="创建合规策略"
        open={createPolicyModal}
        onCancel={() => setCreatePolicyModal(false)}
        onOk={() => policyForm.submit()}
        width={600}
      >
        <Form form={policyForm} layout="vertical" onFinish={handleCreatePolicy}>
          <Form.Item label="策略名称" name="name" rules={[{ required: true, message: '请输入策略名称' }]}>
            <Input placeholder="如: SOC 2 Compliance" />
          </Form.Item>
          <Form.Item label="框架" name="framework" rules={[{ required: true, message: '请选择框架' }]}>
            <Select
              options={[
                { label: 'SOC 2', value: 'SOC 2' },
                { label: 'ISO 27001', value: 'ISO 27001' },
                { label: 'GDPR', value: 'GDPR' },
                { label: 'HIPAA', value: 'HIPAA' },
                { label: 'PCI DSS', value: 'PCI DSS' },
                { label: '自定义', value: 'custom' },
              ]}
            />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} placeholder="策略描述" />
          </Form.Item>
          <Form.Item label="规则 (每行一个: 名称|条件|严重级别)" name="rules">
            <Input.TextArea
              rows={4}
              placeholder={'命名规范|name matches ^[a-z]+$|medium\n版本控制|version is semver|low'}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Audit Plan Modal */}
      <Modal
        title="创建审计计划"
        open={createAuditPlanModal}
        onCancel={() => setCreateAuditPlanModal(false)}
        onOk={() => auditPlanForm.submit()}
        width={600}
      >
        <Form form={auditPlanForm} layout="vertical" onFinish={handleCreateAuditPlan}>
          <Form.Item label="计划名称" name="name" rules={[{ required: true, message: '请输入计划名称' }]}>
            <Input placeholder="如: Monthly Security Audit" />
          </Form.Item>
          <Form.Item label="审计范围 (逗号分隔)" name="scope">
            <Input placeholder="如: security, access-control, data-handling" />
          </Form.Item>
          <Form.Item label="调度 (Cron 表达式)" name="schedule" initialValue="0 0 * * *">
            <Input placeholder="0 0 * * *" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CompliancePage;
