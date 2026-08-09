/**
 * SBOM Supply Chain Security Page
 * P3-15: Software Bill of Materials - dependency tracking, vulnerability tracking, license compliance
 * Pure frontend Mock data.
 */

import React, { useState, useMemo } from 'react';
import {
  Card,
  Table,
  Typography,
  Row,
  Col,
  Tag,
  Button,
  Space,
  Select,
  Statistic,
  Descriptions,
  Divider,
  Tooltip,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SafetyCertificateOutlined,
  SafetyOutlined,
  EyeOutlined,
  CloudUploadOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title } = Typography;
const { Text } = Typography;
const { Option } = Select;

// ============ Design Token Aliases ============
const cPrimary = colors.primary[500];
const cSuccess = colors.success[500];
const cWarning = colors.warning[500];
const cError = colors.error[500];
const cInfo = colors.info[500];
const cPurple = colors.purple[500];
const cNeutral = colors.neutral[500];
const sMd = spacing.md;
const sLg = spacing.lg;

// ============ Types ============

type ComponentType = 'npm' | 'Go' | 'Python' | 'Maven' | 'Docker';
type ComponentStatus = 'safe' | 'vulnerable' | 'expired';
type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

interface SBOMComponent {
  key: string;
  name: string;
  version: string;
  type: ComponentType;
  vulnCount: number;
  license: string;
  lastScan: string;
  status: ComponentStatus;
}

interface CVEVuln {
  cveId: string;
  severity: Severity;
  cvss: number;
  fixedIn: string;
  description: string;
}

interface LicenseItem {
  name: string;
  count: number;
  compliant: boolean;
  percentage: number;
}

// ============ Mock Data ============

const mockComponents: SBOMComponent[] = [
  {
    key: '1',
    name: 'express',
    version: '4.18.2',
    type: 'npm',
    vulnCount: 2,
    license: 'MIT',
    lastScan: '2026-08-07 14:30:00',
    status: 'vulnerable',
  },
  {
    key: '2',
    name: 'lodash',
    version: '4.17.21',
    type: 'npm',
    vulnCount: 0,
    license: 'MIT',
    lastScan: '2026-08-07 14:30:00',
    status: 'safe',
  },
  {
    key: '3',
    name: 'openssl',
    version: '1.1.1k',
    type: 'Go',
    vulnCount: 5,
    license: 'Apache-2.0',
    lastScan: '2026-08-06 22:10:00',
    status: 'vulnerable',
  },
  {
    key: '4',
    name: 'pandas',
    version: '2.0.3',
    type: 'Python',
    vulnCount: 1,
    license: 'BSD-3-Clause',
    lastScan: '2026-08-07 09:00:00',
    status: 'vulnerable',
  },
  {
    key: '5',
    name: 'spring-boot',
    version: '3.1.4',
    type: 'Maven',
    vulnCount: 0,
    license: 'Apache-2.0',
    lastScan: '2026-08-07 09:00:00',
    status: 'safe',
  },
  {
    key: '6',
    name: 'nginx',
    version: '1.23.3',
    type: 'Docker',
    vulnCount: 3,
    license: 'BSD-3-Clause',
    lastScan: '2026-08-05 16:45:00',
    status: 'vulnerable',
  },
  {
    key: '7',
    name: 'react',
    version: '18.2.0',
    type: 'npm',
    vulnCount: 0,
    license: 'MIT',
    lastScan: '2026-08-07 14:30:00',
    status: 'safe',
  },
  {
    key: '8',
    name: 'guava',
    version: '31.1-jre',
    type: 'Maven',
    vulnCount: 0,
    license: 'Apache-2.0',
    lastScan: '2026-08-01 11:20:00',
    status: 'expired',
  },
  {
    key: '9',
    name: 'libcrypto',
    version: '3.0.7',
    type: 'Docker',
    vulnCount: 1,
    license: 'Apache-2.0',
    lastScan: '2026-08-06 22:10:00',
    status: 'vulnerable',
  },
  {
    key: '10',
    name: 'requests',
    version: '2.31.0',
    type: 'Python',
    vulnCount: 0,
    license: 'Apache-2.0',
    lastScan: '2026-08-07 09:00:00',
    status: 'safe',
  },
];

const mockVulnsByComponent: Record<string, CVEVuln[]> = {
  '1': [
    {
      cveId: 'CVE-2024-29041',
      severity: 'High',
      cvss: 7.5,
      fixedIn: '4.19.2',
      description: 'Open redirect vulnerability in express',
    },
    {
      cveId: 'CVE-2024-43799',
      severity: 'Medium',
      cvss: 5.3,
      fixedIn: '4.19.2',
      description: 'Path traversal via crafted URL',
    },
  ],
  '3': [
    {
      cveId: 'CVE-2023-5678',
      severity: 'Critical',
      cvss: 9.8,
      fixedIn: '1.1.1t',
      description: 'Remote code execution in TLS handshake',
    },
    {
      cveId: 'CVE-2023-5679',
      severity: 'High',
      cvss: 7.8,
      fixedIn: '1.1.1t',
      description: 'Memory disclosure via crafted certificate',
    },
    {
      cveId: 'CVE-2023-5680',
      severity: 'High',
      cvss: 7.1,
      fixedIn: '1.1.1s',
      description: 'Denial of service via malformed DH params',
    },
    {
      cveId: 'CVE-2023-5681',
      severity: 'Medium',
      cvss: 5.5,
      fixedIn: '1.1.1s',
      description: 'Information leak in error messages',
    },
    {
      cveId: 'CVE-2023-5682',
      severity: 'Low',
      cvss: 3.1,
      fixedIn: '1.1.1s',
      description: 'Minor timing side-channel in RSA',
    },
  ],
  '4': [
    {
      cveId: 'CVE-2024-0012',
      severity: 'Medium',
      cvss: 5.9,
      fixedIn: '2.1.0',
      description: 'Data leakage in Series.to_dict',
    },
  ],
  '6': [
    {
      cveId: 'CVE-2024-3400',
      severity: 'High',
      cvss: 8.2,
      fixedIn: '1.25.3',
      description: 'HTTP request smuggling vulnerability',
    },
    {
      cveId: 'CVE-2024-3401',
      severity: 'High',
      cvss: 7.5,
      fixedIn: '1.25.3',
      description: 'Path traversal in stub_status module',
    },
    {
      cveId: 'CVE-2024-3402',
      severity: 'Low',
      cvss: 2.5,
      fixedIn: '1.25.3',
      description: 'Information disclosure via headers',
    },
  ],
  '9': [
    {
      cveId: 'CVE-2024-10101',
      severity: 'Medium',
      cvss: 5.6,
      fixedIn: '3.0.12',
      description: 'NULL pointer dereference in X.509 parsing',
    },
  ],
};

const mockLicenses: LicenseItem[] = [
  { name: 'MIT', count: 5, compliant: true, percentage: 50 },
  { name: 'Apache-2.0', count: 4, compliant: true, percentage: 40 },
  { name: 'GPL-3.0', count: 1, compliant: false, percentage: 5 },
  { name: 'BSD-3-Clause', count: 2, compliant: true, percentage: 20 },
  { name: 'Proprietary', count: 1, compliant: false, percentage: 10 },
];

// ============ Helpers ============

const typeTagColor: Record<ComponentType, string> = {
  npm: cPrimary,
  Go: cInfo,
  Python: cPurple,
  Maven: colors.tier.bronze,
  Docker: colors.cloud.aws,
};

const typeTagIcon: Record<ComponentType, React.ReactNode> = {
  npm: '⬛',
  Go: '🐹',
  Python: '🐍',
  Maven: '🏗️',
  Docker: '🐳',
};

const statusTagProps: Record<ComponentStatus, { color: string; text: string; icon: React.ReactNode }> = {
  safe: { color: cSuccess, text: '安全', icon: <CheckCircleOutlined /> },
  vulnerable: { color: cWarning, text: '有漏洞', icon: <ExclamationCircleOutlined /> },
  expired: { color: cError, text: '过期', icon: <BellOutlined /> },
};

const vulnTagColor = (count: number): string => {
  if (count === 0) return cSuccess;
  if (count <= 2) return cInfo;
  if (count <= 4) return cWarning;
  return cError;
};

const severityColor: Record<Severity, string> = {
  Critical: cError,
  High: cWarning,
  Medium: colors.warning[300],
  Low: cInfo,
};

const severityTag: Record<Severity, string> = {
  Critical: '严重',
  High: '高危',
  Medium: '中危',
  Low: '低危',
};

// ============ Component ============

const SBOMPage: React.FC = () => {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedComponent, setSelectedComponent] = useState<SBOMComponent | null>(null);

  const filteredComponents = useMemo(() => {
    return mockComponents.filter((comp) => {
      const matchType = filterType === 'all' || comp.type === filterType;
      const matchStatus = filterStatus === 'all' || comp.status === filterStatus;
      return matchType && matchStatus;
    });
  }, [filterType, filterStatus]);

  const stats = useMemo(() => {
    const totalVulns = mockComponents.reduce((sum, c) => sum + c.vulnCount, 0);
    const safeCount = mockComponents.filter((c) => c.status === 'safe').length;
    const complianceRate = Math.round((safeCount / mockComponents.length) * 100);
    return {
      totalComponents: mockComponents.length,
      totalVulns,
      licenseViolations: mockLicenses.filter((l) => !l.compliant).length,
      complianceRate,
    };
  }, []);

  const selectedVulns = useMemo(() => {
    if (!selectedComponent) return [];
    return mockVulnsByComponent[selectedComponent.key] || [];
  }, [selectedComponent]);

  const handleSelectComponent = (record: SBOMComponent) => {
    setSelectedComponent(record);
  };

  const handleViewSBOM = (record: SBOMComponent) => {
    message.info(`正在生成 ${record.name} 的 SBOM 报告...`);
  };

  const handleUpdateVersion = (record: SBOMComponent) => {
    message.success(`${record.name} 版本更新请求已提交`);
  };

  const handleViewVulnDetails = (record: SBOMComponent) => {
    handleSelectComponent(record);
  };

  const columns: ColumnsType<SBOMComponent> = [
    {
      title: '组件名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Text style={{ fontWeight: 600, color: colors.neutral[900] }}>{name}</Text>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: ComponentType) => (
        <Tag color={typeTagColor[type] || cNeutral}>{typeTagIcon[type]} {type}</Tag>
      ),
    },
    {
      title: '漏洞数',
      dataIndex: 'vulnCount',
      key: 'vulnCount',
      render: (count: number) => (
        <Tag color={vulnTagColor(count)} style={{ fontWeight: 600 }}>
          {count} 个
        </Tag>
      ),
    },
    {
      title: '许可证',
      dataIndex: 'license',
      key: 'license',
      render: (license: string) => {
        const isViolated = ['GPL-3.0', 'Proprietary'].includes(license);
        return (
          <Tag color={isViolated ? cError : cNeutral}>
            {isViolated ? <WarningOutlined style={{ marginRight: 4 }} /> : null}
            {license}
          </Tag>
        );
      },
    },
    {
      title: '最后扫描时间',
      dataIndex: 'lastScan',
      key: 'lastScan',
      render: (scan: string) => <Text type="secondary">{scan}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: ComponentStatus) => {
        const props = statusTagProps[status];
        return (
          <Tag color={props.color}>
            <Space size={4}>
              {props.icon}
              <span>{props.text}</span>
            </Space>
          </Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: SBOMComponent) => (
        <Space size={sMd}>
          <Tooltip title="查看 SBOM 报告">
            <Button
              size="small"
              type="primary"
              style={{ borderColor: cPrimary }}
              onClick={() => handleViewSBOM(record)}
            >
              <EyeOutlined style={{ marginRight: 4 }} /> SBOM
            </Button>
          </Tooltip>
          <Tooltip title="更新版本">
            <Button
              size="small"
              style={{ borderColor: cInfo }}
              onClick={() => handleUpdateVersion(record)}
            >
              <CloudUploadOutlined style={{ marginRight: 4 }} /> 更新
            </Button>
          </Tooltip>
          <Tooltip title="漏洞详情">
            <Button
              size="small"
              style={{ borderColor: cWarning }}
              onClick={() => handleViewVulnDetails(record)}
              disabled={record.vulnCount === 0}
            >
              <ExclamationCircleOutlined style={{ marginRight: 4 }} /> 漏洞
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div
      style={{
        padding: sLg,
        backgroundColor: colors.light.bg.secondary,
        minHeight: '100vh',
      }}
    >
      {/* ====== Header ====== */}
      <Title level={2} style={{ marginBottom: 8 }}>
        <SafetyCertificateOutlined
          style={{ marginRight: 12, color: cPrimary }}
        />
        SBOM 供应链安全
      </Title>
      <Text type="secondary" style={{ marginBottom: sLg, display: 'block' }}>
        软件物料清单 · 漏洞追踪 · 许可证合规
      </Text>

      {/* ====== Stats Cards ====== */}
      <Row gutter={[sMd, sMd]}>
        <Col span={6}>
          <Card
            style={{
              borderRadius: 12,
              borderLeft: `3px solid ${cPrimary}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <Statistic
              title="受管理组件数"
              value={stats.totalComponents}
              suffix="个"
              valueStyle={{ color: cPrimary }}
            />
            <SafetyOutlined style={{ color: cPrimary, marginLeft: sMd, fontSize: 16 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: 12,
              borderLeft: `3px solid ${cError}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <Statistic
              title="已知漏洞数"
              value={stats.totalVulns}
              suffix="个"
              valueStyle={{ color: cError }}
            />
            <ExclamationCircleOutlined
              style={{ color: cError, marginLeft: sMd, fontSize: 16 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: 12,
              borderLeft: `3px solid ${cWarning}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <Statistic
              title="许可证违规"
              value={stats.licenseViolations}
              suffix="个"
              valueStyle={{ color: cWarning }}
            />
            <WarningOutlined
              style={{ color: cWarning, marginLeft: sMd, fontSize: 16 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: 12,
              borderLeft: `3px solid ${cSuccess}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <Statistic
              title="合规率"
              value={stats.complianceRate}
              suffix="%"
              valueStyle={{ color: cSuccess }}
            />
            <CheckCircleOutlined
              style={{ color: cSuccess, marginLeft: sMd, fontSize: 16 }}
            />
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: `${sMd}px 0` }} />

      {/* ====== Main Content ====== */}
      <Row gutter={[sMd, sMd]}>
        {/* Left: Component Table */}
        <Col span={14}>
          <Card
            title="依赖组件列表"
            style={{ borderRadius: 12 }}
            extra={
              <Space size={sMd}>
                <Select
                  placeholder="按类型筛选"
                  defaultValue="all"
                  style={{ width: 140 }}
                  onChange={(v) => setFilterType(v)}
                >
                  <Option value="all">全部类型</Option>
                  <Option value="npm">npm</Option>
                  <Option value="Go">Go</Option>
                  <Option value="Python">Python</Option>
                  <Option value="Maven">Maven</Option>
                  <Option value="Docker">Docker</Option>
                </Select>
                <Select
                  placeholder="按状态筛选"
                  defaultValue="all"
                  style={{ width: 140 }}
                  onChange={(v) => setFilterStatus(v)}
                >
                  <Option value="all">全部状态</Option>
                  <Option value="safe">安全</Option>
                  <Option value="vulnerable">有漏洞</Option>
                  <Option value="expired">过期</Option>
                </Select>
              </Space>
            }
          >
            <Table
              columns={columns}
              dataSource={filteredComponents}
              rowKey="key"
              rowHoverable
              pagination={{ pageSize: 10, showSizeChanger: false }}
              style={{ fontSize: 13 }}
            />
          </Card>
        </Col>

        {/* Right: Vulnerability Details */}
        <Col span={10}>
          <Card
            title="漏洞详情"
            style={{ borderRadius: 12 }}
          >
            {selectedComponent ? (
              <div>
                <Text strong>
                  组件：{selectedComponent.name}@{selectedComponent.version}
                </Text>
                <Text
                  type="secondary"
                  style={{ marginLeft: 8 }}
                >
                  ({selectedVulns.length} 个漏洞)
                </Text>
                <Divider style={{ margin: `${spacing.sm}px 0` }} />
                {selectedVulns.length > 0 ? (
                  selectedVulns.map((vuln, idx) => (
                    <div key={idx} style={{ marginBottom: spacing.md }}>
                      <Descriptions
                        size="small"
                        column={2}
                        bordered
                        style={{
                          marginBottom: spacing.sm,
                          borderColor: severityColor[vuln.severity],
                        }}
                      >
                        <Descriptions.Item label="CVE ID">
                          <Text code strong>{vuln.cveId}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="严重程度">
                          <Tag color={severityColor[vuln.severity]}>
                            <Space size={4}>
                              {vuln.severity === 'Critical' && <ExclamationCircleOutlined />}
                              {vuln.severity === 'High' && <WarningOutlined />}
                              {vuln.severity === 'Medium' && <InfoCircleOutlined />}
                              {vuln.severity === 'Low' && <InfoCircleOutlined />}
                              <span>{severityTag[vuln.severity]}</span>
                            </Space>
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="CVSS 分数">
                          <Text style={{ color: severityColor[vuln.severity], fontWeight: 600 }}>
                            {vuln.cvss.toFixed(1)}
                          </Text>
                          /10
                        </Descriptions.Item>
                        <Descriptions.Item label="修复版本">
                          <Text code>{vuln.fixedIn}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="描述" span={2}>
                          <Text type="secondary">{vuln.description}</Text>
                        </Descriptions.Item>
                      </Descriptions>
                    </div>
                  ))
                ) : (
                  <Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
                    该组件暂无已知漏洞
                  </Text>
                )}
                <Divider style={{ margin: `${spacing.sm}px 0` }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  提示：点击左侧表格中的"漏洞"按钮或"查看 SBOM"可切换不同组件的漏洞详情
                </Text>
              </div>
            ) : (
              <Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
                <SafetyOutlined
                  style={{ fontSize: 32, color: cNeutral, marginBottom: spacing.sm }}
                />
                <br />
                请选择左侧组件查看漏洞详情
              </Text>
            )}
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: `${sMd}px 0` }} />

      {/* ====== License Compliance ====== */}
      <Row gutter={[sMd, sMd]}>
        <Col span={24}>
          <Card
            title="许可证合规"
            style={{ borderRadius: 12 }}
            extra={
              <Space size={sMd}>
                <Tag color={cSuccess}>
                  <CheckCircleOutlined /> 合规
                </Tag>
                <Tag color={cError}>
                  <WarningOutlined /> 违规
                </Tag>
              </Space>
            }
          >
            <Descriptions
              bordered
              column={4}
              size="middle"
              style={{ fontSize: 13 }}
            >
              {mockLicenses.map((lic, idx) => (
                <Descriptions.Item
                  key={idx}
                  label={
                    <Text style={{ fontWeight: 600 }}>{lic.name}</Text>
                  }
                  style={{
                    backgroundColor: lic.compliant ? 'transparent' : `${cError}08`,
                  }}
                >
                  <div>
                    <div style={{ marginBottom: 4 }}>
                      <Text strong style={{ fontSize: 18, color: lic.compliant ? cNeutral : cError }}>
                        {lic.count}
                      </Text>
                      <Text type="secondary" style={{ marginLeft: 4 }}>
                        个组件
                      </Text>
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        ({lic.percentage}%)
                      </Text>
                    </div>
                    <div>
                      <Tag color={lic.compliant ? cSuccess : cError}>
                        <Space size={4}>
                          {lic.compliant ? <CheckCircleOutlined /> : <WarningOutlined />}
                          <span>{lic.compliant ? '合规' : '违规'}</span>
                        </Space>
                      </Tag>
                    </div>
                  </div>
                </Descriptions.Item>
              ))}
            </Descriptions>
            <Divider style={{ margin: `${spacing.sm}px 0` }} />
            <Row gutter={[sMd, sMd]}>
              {mockLicenses.filter((l) => !l.compliant).map((lic) => (
                <Col span={24} key={lic.name}>
                  <Card
                    size="small"
                    style={{
                      borderRadius: 8,
                      borderColor: cError,
                      backgroundColor: `${cError}05`,
                      border: `1px solid ${cError}30`,
                    }}
                  >
                    <Space size={spacing.sm}>
                      <WarningOutlined style={{ color: cError, fontSize: 18 }} />
                      <Text strong style={{ color: cError }}>
                        许可证违规：{lic.name}
                      </Text>
                      <Text type="secondary">
                        — 该许可证存在合规风险，需人工审核后方可引入，涉及 {lic.count} 个组件
                      </Text>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SBOMPage;
