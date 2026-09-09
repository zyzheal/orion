/**
 * 预发布门禁 (Pre-Deploy Gate)
 * 后端: /api/v1/branch-policy/pre-deploy-gate/check — 部署前规则检查、风险阻断评估
 *
 * 功能:
 * - 部署前检查表单：选择分支 + 目标环境（可选 imageTag/审批单/制品/Pipeline/源提交）
 * - 规则状态面板：展示 6 条规则的通过/失败状态
 * - 阻断规则高亮：红色 + 详情 tooltip
 * - 警告规则高亮：黄色 + 详情 tooltip
 * - 一键复制 GateResult JSON（便于调试）
 * - 历史记录：最近一次检查结果（响应不持久化，仅保留会话内最近一次）
 *
 * 规则 ID（对应后端 gate rules）:
 * R1_BranchEnvMatch / R2_DigestSignature / R3_Approval
 * R4_Branch_Archived / R5_Pipeline_NotAllowed / R6_Migration_Downgrade
 *
 * 设计文档: docs/multi-branch-strategy-design-v2-impl-2026-09-08.md §5.7
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  ExperimentOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import {
  checkPreDeployGate,
  getBranchProfiles,
  type BranchProfile,
  type EnvName,
  type GateRuleResult,
  type GateSeverity,
  type PreDeployGateResult,
} from '@/api/branch-policy';

const { Title, Text } = Typography;

const ENV_ORDER: EnvName[] = ['dev', 'staging', 'prod'];
const ENV_LABELS: Record<EnvName, string> = { dev: '开发', staging: '预发', prod: '生产' };
const ENV_COLORS: Record<string, string> = { dev: 'green', staging: 'orange', prod: 'red' };

const SEVERITY_META: Record<GateSeverity, { color: string; label: string }> = {
  blocking: { color: 'red', label: '阻断' },
  warning: { color: 'gold', label: '警告' },
};

/** 规则 ID → 展示名称（与后端 runGate* 规则一一对应） */
const RULE_NAMES: Record<string, string> = {
  R1_BranchEnvMatch: '分支-环境匹配',
  R2_DigestSignature: '制品签名校验',
  R3_Approval: '变更审批',
  R4_Branch_Archived: '分支状态',
  R5_Pipeline_NotAllowed: 'Pipeline 白名单',
  R6_Migration_Downgrade: 'Schema 兼容性',
};

export default function PreDeployGate() {
  const [profiles, setProfiles] = useState<BranchProfile[]>([]);
  const [result, setResult] = useState<PreDeployGateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [form] = Form.useForm();

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBranchProfiles({ status: 'active' });
      setProfiles((res.data ?? []) as unknown as BranchProfile[]);
    } catch (err) {
      message.error(`加载分支画像失败：${(err as Error).message ?? err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  const branchOptions = useMemo(
    () =>
      profiles
        .map((p) => ({ label: `${p.name}（${p.semantic}）`, value: p.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [profiles],
  );

  const handleCheck = async () => {
    try {
      const values = await form.validateFields();
      setChecking(true);
      const res = await checkPreDeployGate({
        branch: values.branch,
        targetEnv: values.targetEnv,
        imageTag: values.imageTag,
        approvalId: values.approvalId,
        artifactId: values.artifactId,
        pipelineName: values.pipelineName,
        sourceCommit: values.sourceCommit,
      });
      setResult(res.data as unknown as PreDeployGateResult);
      message.success(
        (res.data as unknown as PreDeployGateResult).passed ? '门禁检查通过' : '门禁检查完成，存在阻断项',
      );
    } catch (err) {
      if ((err as { errorFields?: unknown }).errorFields) return;
      message.error(`门禁检查失败：${(err as Error).message ?? err}`);
    } finally {
      setChecking(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      message.success('GateResult JSON 已复制到剪贴板');
    } catch {
      message.error('复制失败，请手动选择复制');
    }
  };

  const passedCount = useMemo(
    () => result?.rules.filter((r) => r.passed).length ?? 0,
    [result],
  );

  const ruleColumns = useMemo(
    () => [
      {
        title: '规则',
        dataIndex: 'ruleId',
        key: 'ruleId',
        width: 220,
        render: (id: string, row: GateRuleResult) => (
          <Space direction="vertical" size={2}>
            <Text strong>{RULE_NAMES[id] ?? row.name ?? id}</Text>
            <Text code style={{ fontSize: 12 }}>
              {id}
            </Text>
          </Space>
        ),
      },
      {
        title: '类型',
        dataIndex: 'severity',
        key: 'severity',
        width: 90,
        render: (v: GateSeverity) => (
          <Tag color={SEVERITY_META[v].color}>{SEVERITY_META[v].label}</Tag>
        ),
      },
      {
        title: '状态',
        dataIndex: 'passed',
        key: 'passed',
        width: 110,
        render: (v: boolean) =>
          v ? (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              通过
            </Tag>
          ) : (
            <Tag color="red" icon={<CloseCircleOutlined />}>
              未通过
            </Tag>
          ),
      },
      {
        title: '详情',
        dataIndex: 'detail',
        key: 'detail',
        render: (v: string, row: GateRuleResult) => (
          <Tooltip title={v}>
            <Text
              style={{
                color: !row.passed
                  ? row.severity === 'blocking'
                    ? '#cf1322'
                    : '#d48806'
                  : undefined,
              }}
            >
              {v || (row.passed ? '规则检查通过' : '规则检查未通过')}
            </Text>
          </Tooltip>
        ),
      },
    ],
    [],
  );

  const renderResult = () => {
    if (!result) return null;
    const hasBlocked = result.blocked.length > 0;
    return (
      <>
        <Card title="门禁结果" size="small" style={{ marginBottom: spacing.md }}>
          <Row gutter={[16, 16]}>
            <Col flex="auto">
              <Statistic
                title="整体状态"
                value={result.passed ? '通过' : '阻断'}
                valueStyle={{ color: result.passed ? '#52c41a' : '#f5222d' }}
              />
            </Col>
            <Col flex="auto">
              <Statistic title="规则总数" value={result.rules.length} />
            </Col>
            <Col flex="auto">
              <Statistic title="通过" value={passedCount} valueStyle={{ color: '#52c41a' }} />
            </Col>
            <Col flex="auto">
              <Statistic
                title="未通过"
                value={result.rules.length - passedCount}
                valueStyle={{ color: '#f5222d' }}
              />
            </Col>
          </Row>
          <div style={{ marginTop: spacing.md }}>
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="分支">
                <Tag color="blue">{result.branch}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="环境">
                <Tag color={ENV_COLORS[result.env]}>{ENV_LABELS[result.env as EnvName] ?? result.env}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="请求 ID">
                <Text code>{result.requestId}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="检查时间">
                {new Date(result.checkedAt).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
          </div>
          {hasBlocked ? (
            <Alert
              style={{ marginTop: spacing.md }}
              type="error"
              showIcon
              icon={<WarningOutlined />}
              message={`存在 ${result.blocked.length} 个阻断规则，禁止部署`}
              description={
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  {result.blocked.map((b) => (
                    <Text key={b} code>
                      {b}
                    </Text>
                  ))}
                </Space>
              }
            />
          ) : (
            <Alert
              style={{ marginTop: spacing.md }}
              type="success"
              showIcon
              message="全部规则通过，可以部署"
            />
          )}
          <div style={{ marginTop: spacing.md }}>
            <Space>
              <Button icon={<CopyOutlined />} onClick={() => void handleCopy()}>
                复制 GateResult JSON
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => void handleCheck()}>
                重新检查
              </Button>
            </Space>
          </div>
        </Card>

        <Card title="规则明细" size="small" style={{ marginBottom: spacing.md }}>
          {result.rules.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无规则执行记录" />
          ) : (
            <Table
              rowKey="ruleId"
              columns={ruleColumns}
              dataSource={result.rules}
              pagination={false}
              size="small"
            />
          )}
          <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
            提示：门禁检查结果不持久化，每次部署前需重新执行检查
          </Text>
        </Card>
      </>
    );
  };

  if (loading && profiles.length === 0) {
    return <PageSkeleton rows={8} searchBar={false} />;
  }

  return (
    <div>
      <Title level={2} style={{ marginBottom: 8 }}>
        <SafetyCertificateOutlined style={{ marginRight: 12, color: '#3370E6' }} />
        预发布门禁
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        部署前规则检查：选择分支与目标环境，评估阻断/警告规则，保障发布安全
      </Text>

      <Card title="发起门禁检查" size="small" style={{ marginBottom: spacing.md }}>
        <Form form={form} layout="vertical" style={{ maxWidth: 700 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="branch"
                label="分支"
                rules={[{ required: true, message: '请选择分支' }]}
              >
                <Select
                  showSearch
                  placeholder="选择分支"
                  options={branchOptions}
                  filterOption={(input, option) =>
                    ((option?.label ?? '') as string).toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="targetEnv"
                label="目标环境"
                rules={[{ required: true, message: '请选择目标环境' }]}
              >
                <Select
                  placeholder="选择环境"
                  options={ENV_ORDER.map((e) => ({ label: ENV_LABELS[e], value: e }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="imageTag" label="镜像 Tag（可选）">
                <Input placeholder="例如 main-prod-20260910-001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="approvalId" label="变更单号（可选）">
                <Input placeholder="例如 AP-20260910-001" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="artifactId" label="制品 ID（可选）">
                <Input placeholder="留空自动匹配最新制品" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="pipelineName" label="Pipeline（可选）">
                <Input placeholder="例如 deploy-main-prod" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sourceCommit" label="源提交（可选）">
                <Input placeholder="留空使用分支最新提交" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Space>
              <Button
                type="primary"
                icon={<ExperimentOutlined />}
                loading={checking}
                onClick={() => void handleCheck()}
              >
                执行门禁检查
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => void fetchProfiles()}>
                刷新分支
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {renderResult()}
    </div>
  );
}
