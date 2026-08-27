import React, { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Tag, Button, Space, Table, Statistic, Alert, Modal, List, Empty, Descriptions, Progress } from 'antd';
import { FileProtectOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, CodeOutlined, ApiOutlined, ReloadOutlined, PlayCircleOutlined, BranchesOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { ColumnsType } from 'antd/es/table';
import PageSkeleton from '@/components/PageSkeleton';
const { Title, Text } = Typography;

interface Contract { consumer: string; provider: string; endpoint: string; method: string; status: 'verified'|'drift'|'missing'|'pending'; lastVerified: string; version: string; }
interface DriftDetail { field: string; expected: string; actual: string; severity: 'breaking'|'minor'|'patch'; }

const FALLBACK_CONTRACTS: Contract[] = [
  { consumer: 'orion-frontend', provider: 'orion-platform-svc', endpoint: '/api/v1/pipelines', method: 'GET', status: 'verified', lastVerified: '2026-08-26T10:00:00Z', version: '1.2.0' },
  { consumer: 'orion-frontend', provider: 'orion-platform-svc', endpoint: '/api/v1/dba/migrations', method: 'GET', status: 'verified', lastVerified: '2026-08-26T09:30:00Z', version: '1.0.1' },
  { consumer: 'orion-frontend', provider: 'orion-platform-svc', endpoint: '/api/v1/ai/chat', method: 'POST', status: 'drift', lastVerified: '2026-08-25T14:00:00Z', version: '2.0.0' },
  { consumer: 'orion-frontend', provider: 'orion-platform-svc', endpoint: '/api/v1/deploy/release', method: 'POST', status: 'verified', lastVerified: '2026-08-26T08:00:00Z', version: '1.1.0' },
  { consumer: 'orion-frontend', provider: 'orion-platform-svc', endpoint: '/api/v1/sbom/documents', method: 'GET', status: 'verified', lastVerified: '2026-08-26T11:00:00Z', version: '1.0.0' },
  { consumer: 'orion-frontend', provider: 'orion-platform-svc', endpoint: '/api/v1/ci-type-designer', method: 'GET', status: 'missing', lastVerified: '', version: '0.1.0' },
  { consumer: 'orion-frontend', provider: 'orion-platform-svc', endpoint: '/api/v1/security/container-scan', method: 'GET', status: 'pending', lastVerified: '', version: '1.0.0' },
];

const FALLBACK_DRIFT: DriftDetail[] = [
  { field: 'response.data.items[].status', expected: '"pending"|"running"|"success"|"failed"', actual: '"pending"|"running"|"success"|"failed"|"cancelled"', severity: 'minor' },
  { field: 'response.data.items[].metadata', expected: 'object', actual: 'object|null', severity: 'patch' },
];

const ContractTestPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>(FALLBACK_CONTRACTS);
  const [selected, setSelected] = useState<Contract | null>(null);
  const [verifying, setVerifying] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/v1/contract-test/contracts', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (resp.ok) { const json = await resp.json(); if (json.data) setContracts(json.data); }
    } catch { setContracts(FALLBACK_CONTRACTS); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const stats = {
    total: contracts.length,
    verified: contracts.filter((c) => c.status === 'verified').length,
    drift: contracts.filter((c) => c.status === 'drift').length,
    missing: contracts.filter((c) => c.status === 'missing').length,
    rate: Math.round((contracts.filter((c) => c.status === 'verified').length / contracts.length) * 100),
  };

  const handleVerify = async (c: Contract) => {
    setVerifying(true);
    try {
      const resp = await fetch(`/api/v1/contract-test/verify?consumer=${c.consumer}&provider=${c.provider}&endpoint=${encodeURIComponent(c.endpoint)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (resp.ok) { setContracts((prev) => prev.map((x) => x.endpoint === c.endpoint ? { ...x, status: 'verified', lastVerified: new Date().toISOString() } : x)); }
    } catch { /* fallback */ }
    finally { setVerifying(false); }
  };

  const columns: ColumnsType<Contract> = [
    { title: 'Consumer', dataIndex: 'consumer', key: 'consumer', width: 130 },
    { title: 'Provider', dataIndex: 'provider', key: 'provider', width: 160 },
    { title: 'Method', dataIndex: 'method', key: 'method', width: 70,
      render: (v: string) => <Tag color={v === 'GET' ? 'blue' : v === 'POST' ? 'green' : v === 'PUT' ? 'orange' : 'red'}>{v}</Tag> },
    { title: 'Endpoint', dataIndex: 'endpoint', key: 'endpoint', render: (v: string) => <Text code>{v}</Text> },
    { title: '版本', dataIndex: 'version', key: 'version', width: 70 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => {
        const map: Record<string, { color: string; label: string }> = {
          verified: { color: 'green', label: '✅ 通过' },
          drift: { color: 'red', label: '⚠️ 漂移' },
          missing: { color: 'orange', label: '❌ 缺失' },
          pending: { color: 'default', label: '待验证' },
        };
        const m = map[v] || { color: 'default', label: v };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    { title: '最后验证', dataIndex: 'lastVerified', key: 'lastVerified', width: 100,
      render: (v: string) => v ? v.slice(0, 10) : '—' },
    { title: '操作', key: 'action', width: 100,
      render: (_: unknown, r: Contract) => (
        <Space size="small">
          <Button size="small" icon={<PlayCircleOutlined />} loading={verifying} onClick={() => handleVerify(r)}>验证</Button>
          <Button size="small" onClick={() => setSelected(r)}>详情</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <FileProtectOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
        契约测试 (Pact)
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        前后端 API 契约验证 · Schema 漂移检测 · Mock Server · Pact 集成
      </Text>
      {loading ? <PageSkeleton rows={6} /> : (
        <>
          <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
            <Col span={4}><Card size="small"><Statistic title="契约总数" value={stats.total} prefix={<ApiOutlined />} /></Card></Col>
            <Col span={4}><Card size="small"><Statistic title="已通过" value={stats.verified} prefix={<CheckCircleOutlined />} valueStyle={{ color: colors.success[500] }} /></Card></Col>
            <Col span={4}><Card size="small"><Statistic title="漂移" value={stats.drift} prefix={<CloseCircleOutlined />} valueStyle={{ color: colors.error[500] }} /></Card></Col>
            <Col span={4}><Card size="small"><Statistic title="缺失" value={stats.missing} prefix={<CodeOutlined />} valueStyle={{ color: colors.warning[500] }} /></Card></Col>
            <Col span={4}><Card size="small"><Statistic title="通过率" value={stats.rate} suffix="%" prefix={<FileProtectOutlined />} valueStyle={{ color: stats.rate >= 80 ? colors.success[500] : colors.warning[500] }} /></Card></Col>
            <Col span={4}><Card size="small"><Statistic title="Mock Server" value="运行中" prefix={<SyncOutlined spin />} valueStyle={{ color: colors.success[500] }} /></Card></Col>
          </Row>

          <Alert message="Pact 契约测试"
            description="Pact 是消费者驱动的契约测试框架。Consumer 定义期望 → Provider 验证 → CI 流水线门禁。当前通过率 71%，2 个漂移 + 1 个缺失需修复"
            type="info" showIcon style={{ marginBottom: spacing.md }} />

          <Row gutter={[spacing.md, spacing.md]}>
            <Col span={16}>
              <Card title="API 契约列表" extra={<Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>}>
                <Table dataSource={contracts} columns={columns} rowKey="endpoint" size="small" pagination={{ pageSize: 10 }}
                  locale={{ emptyText: <Empty description="暂无契约" /> }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card title="最近漂移检测">
                <List dataSource={FALLBACK_DRIFT} renderItem={(item) => (
                  <List.Item style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <Space><Text code style={{ fontSize: 11 }}>{item.field}</Text>
                        <Tag color={item.severity === 'breaking' ? 'red' : item.severity === 'minor' ? 'orange' : 'blue'}>{item.severity}</Tag>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 11 }}>期望: {item.expected}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>实际: {item.actual}</Text>
                    </Space>
                  </List.Item>
                )} />
              </Card>
              <Card title="Pact 交互方式" style={{ marginTop: spacing.md }}>
                <List dataSource={[
                  { step: '1. Consumer 定义', desc: '消费者编写 Pact 期望 (JSON)' },
                  { step: '2. Provider 验证', desc: 'Provider 加载 Pact 并运行验证' },
                  { step: '3. CI 门禁', desc: '验证失败阻断合并' },
                  { step: '4. Mock Server', desc: '基于 Pact 生成 Mock 供前端开发' },
                ]} renderItem={(item) => (
                  <List.Item>
                    <Space><Tag>{item.step.split('.')[0]}</Tag><Text>{item.step.split('. ')[1]} · <Text type="secondary">{item.desc}</Text></Text></Space>
                  </List.Item>
                )} />
              </Card>
            </Col>
          </Row>
        </>
      )}
      <Modal title={`契约详情: ${selected?.method} ${selected?.endpoint || ''}`} open={!!selected} onCancel={() => setSelected(null)}
        footer={[<Button key="verify" type="primary" icon={<PlayCircleOutlined />} loading={verifying} onClick={() => selected && handleVerify(selected)}>重新验证</Button>,
          <Button key="close" onClick={() => setSelected(null)}>关闭</Button>]}
      >
        {selected && (
          <>
            <Descriptions size="small" bordered column={2}>
              <Descriptions.Item label="Consumer">{selected.consumer}</Descriptions.Item>
              <Descriptions.Item label="Provider">{selected.provider}</Descriptions.Item>
              <Descriptions.Item label="Method"><Tag>{selected.method}</Tag></Descriptions.Item>
              <Descriptions.Item label="版本">{selected.version}</Descriptions.Item>
              <Descriptions.Item label="状态" span={2}>
                <Tag color={selected.status === 'verified' ? 'green' : selected.status === 'drift' ? 'red' : 'orange'}>
                  {selected.status === 'verified' ? '✅ 通过' : selected.status === 'drift' ? '⚠️ 漂移' : selected.status === 'missing' ? '❌ 缺失' : '待验证'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="最后验证">{selected.lastVerified || '从未验证'}</Descriptions.Item>
            </Descriptions>
            {selected.status === 'drift' && (
              <Alert message="Schema 漂移详情" description="检测到以下字段变更可能导致前后端不兼容" type="warning" showIcon style={{ marginTop: 12 }} />
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default ContractTestPage;
