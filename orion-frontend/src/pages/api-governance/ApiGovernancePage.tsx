/**
 * API Governance Page (Enhanced Phase 4)
 *
 * Contract management, version control, governance rules, compliance reports
 * Enhanced with contract verification, API versioning, and deprecation tracking.
 */

import React, { useState, useEffect } from 'react';
import {
  apiGovernanceApi, GovernanceContract, GovernanceRule,
  GovernanceViolation, GovernanceReport
} from '../../api/api-governance';
import {
  Card, Table, Button, Modal, Form, Select, Input, Tag,
  message, Space, Statistic, Row, Col, Badge, Tabs, Descriptions,
  Timeline, InputNumber, DatePicker, Tooltip
} from 'antd';
import {
  FileTextOutlined, SafetyCertificateOutlined,
  PlusOutlined, ReloadOutlined, CheckCircleOutlined,
  WarningOutlined, BranchesOutlined, StopOutlined,
  EyeOutlined, VerifyOutlined, HistoryOutlined
} from '@ant-design/icons';

const { TextArea } = Input;

interface ApiVersion {
  id: string;
  apiName: string;
  version: string;
  status: 'active' | 'deprecated' | 'retired';
  registeredAt: string;
  deprecationDate?: string;
  retirementDate?: string;
  replacementVersion?: string;
  changelog?: string;
}

interface VerificationResult {
  contractId: string;
  passed: boolean;
  violations: string[];
  endpoint: string;
  method: string;
  verifiedAt: string;
}

const MOCK_VERSIONS: ApiVersion[] = [
  { id: 'ver-1', apiName: 'user-service', version: 'v1.0.0', status: 'active', registeredAt: '2026-03-01' },
  { id: 'ver-2', apiName: 'user-service', version: 'v1.1.0', status: 'active', registeredAt: '2026-04-15' },
  { id: 'ver-3', apiName: 'order-service', version: 'v2.0.0', status: 'deprecated', registeredAt: '2026-02-01', deprecationDate: '2026-04-20', replacementVersion: 'v2.1.0' },
  { id: 'ver-4', apiName: 'order-service', version: 'v2.1.0', status: 'active', registeredAt: '2026-04-20' },
  { id: 'ver-5', apiName: 'payment-service', version: 'v1.0.0', status: 'retired', registeredAt: '2026-01-01', deprecationDate: '2026-03-01', retirementDate: '2026-05-01' },
];

const ApiGovernancePage: React.FC = () => {
  const [contracts, setContracts] = useState<GovernanceContract[]>([]);
  const [rules, setRules] = useState<GovernanceRule[]>([]);
  const [violations, setViolations] = useState<GovernanceViolation[]>([]);
  const [report, setReport] = useState<GovernanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [contractModal, setContractModal] = useState(false);
  const [ruleModal, setRuleModal] = useState(false);
  const [deprecateModal, setDeprecateModal] = useState(false);
  const [verifyModal, setVerifyModal] = useState(false);
  const [versionModal, setVersionModal] = useState(false);
  const [form] = Form.useForm();
  const [verifyForm] = Form.useForm();
  const [versionForm] = Form.useForm();
  const [deprecateForm] = Form.useForm();

  // Phase 4 state
  const [versions, setVersions] = useState<ApiVersion[]>(MOCK_VERSIONS);
  const [verificationResults, setVerificationResults] = useState<VerificationResult[]>([]);
  const [selectedContract, setSelectedContract] = useState<GovernanceContract | null>(null);
  const [activeTab, setActiveTab] = useState('contracts');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [contractRes, ruleRes, violationRes, reportRes] = await Promise.all([
        apiGovernanceApi.listContracts(),
        apiGovernanceApi.listRules(),
        apiGovernanceApi.listViolations(),
        apiGovernanceApi.getReport(),
      ]);
      setContracts(contractRes || []);
      setRules(ruleRes || []);
      setViolations(violationRes || []);
      setReport(reportRes as GovernanceReport);
    } catch {
      message.error('Failed to load data');
    }
    setLoading(false);
  };

  const handleCreateContract = async (values: any) => {
    try {
      await apiGovernanceApi.createContract(values);
      message.success('Contract created');
      setContractModal(false);
      loadData();
    } catch {
      message.error('Failed to create contract');
    }
  };

  const handleCreateRule = async (values: any) => {
    try {
      await apiGovernanceApi.createRule(values);
      message.success('Rule created');
      setRuleModal(false);
      loadData();
    } catch {
      message.error('Failed to create rule');
    }
  };

  const handleEvaluate = async (contractId: string) => {
    try {
      await apiGovernanceApi.evaluateContract(contractId);
      message.success('Evaluation completed');
      loadData();
    } catch {
      message.error('Failed to evaluate contract');
    }
  };

  // Phase 4: Contract verification
  const handleVerify = async (values: any) => {
    try {
      if (!selectedContract) {
        message.error('No contract selected');
        return;
      }
      const result = await apiGovernanceApi.verifyContract(selectedContract.id, {
        actualResponse: values.actualResponse ? JSON.parse(values.actualResponse) : {},
        endpoint: values.endpoint,
        method: values.method,
      });
      setVerificationResults([...verificationResults, result as VerificationResult]);
      if ((result as VerificationResult).passed) {
        message.success('Verification passed');
      } else {
        message.warning(`Verification failed: ${(result as VerificationResult).violations.length} violations`);
      }
      setVerifyModal(false);
      verifyForm.resetFields();
    } catch {
      message.error('Failed to verify contract');
    }
  };

  // Phase 4: Version management
  const handleRegisterVersion = async (values: any) => {
    try {
      await apiGovernanceApi.registerVersion(values);
      const newVersion: ApiVersion = {
        id: `ver-${Date.now()}`,
        apiName: values.apiName,
        version: values.version,
        status: values.status || 'active',
        registeredAt: new Date().toISOString(),
        changelog: values.changelog,
      };
      setVersions([...versions, newVersion]);
      message.success('Version registered');
      setVersionModal(false);
      versionForm.resetFields();
    } catch {
      message.error('Failed to register version');
    }
  };

  const handleDeprecateVersion = async (values: any) => {
    try {
      await apiGovernanceApi.deprecateVersion(values.versionId, {
        replacementVersion: values.replacementVersion,
        retirementDate: values.retirementDate,
      });
      setVersions(versions.map((v) =>
        v.id === values.versionId ? {
          ...v,
          status: 'deprecated' as const,
          deprecationDate: new Date().toISOString(),
          replacementVersion: values.replacementVersion,
          retirementDate: values.retirementDate,
        } : v,
      ));
      message.success('Version deprecated');
      setDeprecateModal(false);
      deprecateForm.resetFields();
    } catch {
      message.error('Failed to deprecate version');
    }
  };

  const handleRetireVersion = async (versionId: string) => {
    try {
      await apiGovernanceApi.retireVersion(versionId);
      setVersions(versions.map((v) =>
        v.id === versionId ? { ...v, status: 'retired' as const, retirementDate: new Date().toISOString() } : v,
      ));
      message.success('Version retired');
    } catch {
      message.error('Failed to retire version');
    }
  };

  const deprecatedCount = versions.filter((v) => v.status === 'deprecated').length;

  const contractColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Version', dataIndex: 'version', key: 'version', width: 80 },
    {
      title: 'Spec Type',
      dataIndex: 'spec_type',
      key: 'spec_type',
      render: (type: string) => <Tag>{type}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge
          status={status === 'active' ? 'success' : status === 'draft' ? 'default' : 'error'}
          text={status}
        />
      ),
    },
    {
      title: 'Compliance',
      dataIndex: 'compliance_score',
      key: 'compliance_score',
      render: (score: number) => (
        <Tag color={score >= 90 ? 'green' : score >= 70 ? 'orange' : 'red'}>
          {score}%
        </Tag>
      ),
    },
    { title: 'Violations', dataIndex: 'violation_count', key: 'violation_count', width: 100 },
    { title: 'Updated', dataIndex: 'updated_at', key: 'updated_at', render: (d: string) => new Date(d).toLocaleString() },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: GovernanceContract) => (
        <Space>
          <Button size="small" icon={<VerifyOutlined />} onClick={() => { setSelectedContract(record); setVerifyModal(true); }}>Verify</Button>
          <Button size="small" onClick={() => handleEvaluate(record.id)}>Evaluate</Button>
        </Space>
      ),
    },
  ];

  const ruleColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (cat: string) => <Tag>{cat}</Tag>,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      render: (sev: string) => (
        <Tag color={sev === 'error' ? 'red' : sev === 'warning' ? 'orange' : 'blue'}>
          {sev}
        </Tag>
      ),
    },
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (enabled ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <WarningOutlined style={{ color: '#faad14' }} />),
    },
    { title: 'Created', dataIndex: 'created_at', key: 'created_at', render: (d: string) => new Date(d).toLocaleString() },
  ];

  const violationColumns = [
    { title: 'Rule', dataIndex: 'rule_name', key: 'rule_name' },
    { title: 'Contract', dataIndex: 'contract_id', key: 'contract_id', width: 100, render: (id: string) => id.slice(0, 8) },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      render: (sev: string) => (
        <Tag color={sev === 'error' ? 'red' : sev === 'warning' ? 'orange' : 'blue'}>
          {sev}
        </Tag>
      ),
    },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: 'Location', dataIndex: 'location', key: 'location', width: 150 },
    {
      title: 'Resolved',
      dataIndex: 'resolved',
      key: 'resolved',
      render: (resolved: boolean) => (resolved ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <WarningOutlined style={{ color: '#faad14' }} />),
    },
    { title: 'Created', dataIndex: 'created_at', key: 'created_at', render: (d: string) => new Date(d).toLocaleString() },
  ];

  const versionColumns = [
    { title: 'API Name', dataIndex: 'apiName', key: 'apiName' },
    { title: 'Version', dataIndex: 'version', key: 'version' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : status === 'deprecated' ? 'orange' : 'default'}>
          {status}
        </Tag>
      ),
    },
    { title: 'Registered', dataIndex: 'registeredAt', key: 'registeredAt', render: (d: string) => new Date(d).toLocaleString() },
    { title: 'Deprecation', dataIndex: 'deprecationDate', key: 'deprecationDate', render: (d?: string) => d ? new Date(d).toLocaleString() : '-' },
    { title: 'Replacement', dataIndex: 'replacementVersion', key: 'replacementVersion', render: (v?: string) => v || '-' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: ApiVersion) => (
        <Space>
          {record.status === 'active' && (
            <Button size="small" icon={<StopOutlined />} onClick={() => { deprecateForm.setFieldsValue({ versionId: record.id }); setDeprecateModal(true); }}>
              Deprecate
            </Button>
          )}
          {record.status === 'deprecated' && (
            <Button size="small" danger onClick={() => handleRetireVersion(record.id)}>Retire</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Governance Report */}
      <Card loading={loading} style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="Overall Score"
              value={report?.overall_score ?? 0}
              suffix="/ 100"
              valueStyle={{ color: (report?.overall_score ?? 0) >= 80 ? '#52c41a' : '#faad14' }}
            />
          </Col>
          <Col span={4}>
            <Statistic title="Total Contracts" value={contracts.length} />
          </Col>
          <Col span={4}>
            <Statistic title="Total Versions" value={versions.length} />
          </Col>
          <Col span={4}>
            <Statistic
              title="Violations"
              value={violations.length}
              valueStyle={{ color: violations.length > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="Deprecated"
              value={deprecatedCount}
              valueStyle={{ color: deprecatedCount > 0 ? '#faad14' : '#52c41a' }}
            />
          </Col>
          <Col span={2}>
            <Statistic
              title="Compliance"
              value={(report?.compliance_rate ?? 0).toFixed(1)}
              suffix="%"
            />
          </Col>
        </Row>
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'contracts',
            label: <><FileTextOutlined /> Contracts</>,
            children: (
              <Card
                title="API Contracts"
                extra={
                  <Space>
                    <Button icon={<PlusOutlined />} onClick={() => setContractModal(true)}>
                      New Contract
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
                  </Space>
                }
              >
                <Table
                  columns={contractColumns}
                  dataSource={contracts}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            ),
          },
          {
            key: 'rules',
            label: <><SafetyCertificateOutlined /> Governance Rules</>,
            children: (
              <Card
                title="Governance Rules"
                extra={
                  <Space>
                    <Button icon={<PlusOutlined />} onClick={() => setRuleModal(true)}>
                      New Rule
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
                  </Space>
                }
              >
                <Table
                  columns={ruleColumns}
                  dataSource={rules}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            ),
          },
          {
            key: 'violations',
            label: <><WarningOutlined /> Violations</>,
            children: (
              <Card title="Governance Violations" extra={<Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>}>
                <Table
                  columns={violationColumns}
                  dataSource={violations}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            ),
          },
          {
            key: 'versions',
            label: <><BranchesOutlined /> Version Management</>,
            children: (
              <Card
                title="API Version Management & Deprecation Tracking"
                extra={
                  <Space>
                    <Button icon={<PlusOutlined />} onClick={() => setVersionModal(true)}>
                      Register Version
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
                  </Space>
                }
              >
                <Table
                  columns={versionColumns}
                  dataSource={versions}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            ),
          },
          {
            key: 'verification',
            label: <><VerifyOutlined /> Verification History</>,
            children: (
              <Card title="Contract Verification History">
                {verificationResults.length === 0 ? (
                  <p style={{ color: '#888' }}>No verification results yet. Use the Verify button on a contract to start.</p>
                ) : (
                  verificationResults.map((result, idx) => (
                    <Card key={idx} size="small" style={{ marginBottom: 8 }}>
                      <Descriptions column={2} size="small">
                        <Descriptions.Item label="Contract">{result.contractId.slice(0, 16)}...</Descriptions.Item>
                        <Descriptions.Item label="Result">
                          <Tag color={result.passed ? 'green' : 'red'}>{result.passed ? 'Passed' : 'Failed'}</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Endpoint">{result.method} {result.endpoint}</Descriptions.Item>
                        <Descriptions.Item label="Verified At">{new Date(result.verifiedAt).toLocaleString()}</Descriptions.Item>
                      </Descriptions>
                      {result.violations.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <strong>Violations:</strong>
                          <ul>
                            {result.violations.map((v, i) => <li key={i}>{v}</li>)}
                          </ul>
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </Card>
            ),
          },
        ]}
      />

      {/* Create Contract Modal */}
      <Modal
        title="Create API Contract"
        open={contractModal}
        onCancel={() => setContractModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateContract}>
          <Form.Item label="Contract Name" name="name" required>
            <Input placeholder="user-service-api" />
          </Form.Item>
          <Form.Item label="Version" name="version" required>
            <Input placeholder="1.0.0" />
          </Form.Item>
          <Form.Item label="Spec Type" name="spec_type" required>
            <Select options={[
              { value: 'openapi', label: 'OpenAPI / Swagger' },
              { value: 'graphql', label: 'GraphQL' },
              { value: 'grpc', label: 'gRPC' },
              { value: 'custom', label: 'Custom' },
            ]} />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Rule Modal */}
      <Modal
        title="Create Governance Rule"
        open={ruleModal}
        onCancel={() => setRuleModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateRule}>
          <Form.Item label="Rule Name" name="name" required>
            <Input placeholder="naming-convention" />
          </Form.Item>
          <Form.Item label="Category" name="category" required>
            <Select options={[
              { value: 'naming', label: 'Naming Convention' },
              { value: 'versioning', label: 'Versioning' },
              { value: 'security', label: 'Security' },
              { value: 'performance', label: 'Performance' },
              { value: 'documentation', label: 'Documentation' },
            ]} />
          </Form.Item>
          <Form.Item label="Severity" name="severity" required>
            <Select options={[
              { value: 'error', label: 'Error' },
              { value: 'warning', label: 'Warning' },
              { value: 'info', label: 'Info' },
            ]} />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Verify Contract Modal */}
      <Modal
        title="Verify Contract"
        open={verifyModal}
        onCancel={() => setVerifyModal(false)}
        onOk={() => verifyForm.submit()}
      >
        <Form form={verifyForm} layout="vertical" onFinish={handleVerify}>
          <Form.Item label="Contract">
            <Input value={selectedContract?.name} disabled />
          </Form.Item>
          <Form.Item label="Endpoint" name="endpoint">
            <Input placeholder={selectedContract?.path || '/api/v1/...'} />
          </Form.Item>
          <Form.Item label="Method" name="method" initialValue="GET">
            <Select options={[
              { value: 'GET', label: 'GET' },
              { value: 'POST', label: 'POST' },
              { value: 'PUT', label: 'PUT' },
              { value: 'DELETE', label: 'DELETE' },
            ]} />
          </Form.Item>
          <Form.Item label="Actual Response (JSON)" name="actualResponse">
            <TextArea rows={4} placeholder='{"id": "123", "name": "example"}' />
          </Form.Item>
        </Form>
      </Modal>

      {/* Register Version Modal */}
      <Modal
        title="Register API Version"
        open={versionModal}
        onCancel={() => setVersionModal(false)}
        onOk={() => versionForm.submit()}
      >
        <Form form={versionForm} layout="vertical" onFinish={handleRegisterVersion}>
          <Form.Item label="API Name" name="apiName" required>
            <Input placeholder="user-service" />
          </Form.Item>
          <Form.Item label="Version" name="version" required>
            <Input placeholder="v1.2.0" />
          </Form.Item>
          <Form.Item label="Status" name="status" initialValue="active">
            <Select options={[
              { value: 'active', label: 'Active' },
              { value: 'deprecated', label: 'Deprecated' },
            ]} />
          </Form.Item>
          <Form.Item label="Changelog" name="changelog">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Deprecate Version Modal */}
      <Modal
        title="Deprecate API Version"
        open={deprecateModal}
        onCancel={() => setDeprecateModal(false)}
        onOk={() => deprecateForm.submit()}
      >
        <Form form={deprecateForm} layout="vertical" onFinish={handleDeprecateVersion}>
          <Form.Item label="Version ID" name="versionId" required>
            <Input disabled />
          </Form.Item>
          <Form.Item label="Replacement Version" name="replacementVersion">
            <Input placeholder="v2.1.0" />
          </Form.Item>
          <Form.Item label="Retirement Date" name="retirementDate">
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ApiGovernancePage;
