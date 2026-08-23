/**
 * Container Image Security Scan Integration Page
 * 容器镜像安全扫描集成页面 - P4-12
 * 纯前端 Mock 数据：Trivy/Clair 漏洞扫描、镜像合规、修复建议
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Table,
  Typography,
  Row,
  Col,
  Tag,
  Button,
  Space,
  Input,
  Select,
  Form,
  Switch,
  Divider,
  Progress,
  message,
  Statistic,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SafetyOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  SettingOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { colors, spacing, themeVars } from '@/tokens';
import { listContainerScans, runContainerScan } from '@/api/containerScan';

const { Title } = Typography;
const { Text } = Typography;
const { Search } = Input;
const { Option } = Select;

const commonStyle = {
  primary: colors.primary[500],
  success: colors.success[500],
  warning: colors.warning[500],
  error: colors.error[500],
  info: colors.info[500],
  neutral: colors.neutral[500],
};

/**
 * 扫描状态类型
 */
type ScanStatus = 'passed' | 'vulnerable' | 'failed';

/**
 * 镜像扫描记录
 */
interface ImageScanRecord {
  key: string;
  image: string;
  tag: string;
  scanTime: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  status: ScanStatus;
  engine: string;
}

/**
 * 漏洞严重度分布
 */
interface VulnDistribution {
  severity: string;
  count: number;
  color: string;
  percentage: number;
}

/**
 * 扫描策略配置
 */
interface ScanPolicy {
  engine: string;
  frequency: string;
  threshold: string;
  autoBlock: boolean;
}

/**
 * 漏洞分布计算
 */
const calcVulnDistribution = (records: ImageScanRecord[]): VulnDistribution[] => {
  const total = records.reduce((sum, r) => sum + r.total, 0);
  const critical = records.reduce((sum, r) => sum + r.critical, 0);
  const high = records.reduce((sum, r) => sum + r.high, 0);
  const medium = records.reduce((sum, r) => sum + r.medium, 0);
  const low = records.reduce((sum, r) => sum + r.low, 0);

  return [
    { severity: 'Critical', count: critical, color: colors.error[500] },
    { severity: 'High', count: high, color: colors.warning[500] },
    { severity: 'Medium', count: medium, color: colors.info[500] },
    { severity: 'Low', count: low, color: colors.neutral[500] },
  ].map((v) => ({
    ...v,
    percentage: total > 0 ? Math.round((v.count / total) * 100) : 0,
  }));
};

/**
 * 状态渲染器
 */
const renderStatus = (status: ScanStatus) => {
  if (status === 'passed') return <Tag color={commonStyle.success}>通过</Tag>;
  if (status === 'vulnerable') return <Tag color={commonStyle.warning}>有漏洞</Tag>;
  return <Tag color={commonStyle.error}>扫描失败</Tag>;
};

/**
 * 漏洞总数列渲染（按严重度分Tag）
 */
const renderVulnTotal = (record: ImageScanRecord) => {
  const tags: React.ReactNode[] = [];
  if (record.critical > 0)
    tags.push(
      <Tag key="critical" color={commonStyle.error}>
        {record.critical}
      </Tag>
    );
  if (record.high > 0)
    tags.push(
      <Tag key="high" color={commonStyle.warning}>
        {record.high}
      </Tag>
    );
  if (record.medium > 0)
    tags.push(
      <Tag key="medium" color={commonStyle.info}>
        {record.medium}
      </Tag>
    );
  if (record.low > 0)
    tags.push(
      <Tag key="low" color={commonStyle.neutral}>
        {record.low}
      </Tag>
    );
  if (tags.length === 0) return <Text type="secondary">0</Text>;
  return <Space size={2}>{tags}</Space>;
};

const ContainerScanPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<ScanStatus | 'all'>('all');
  const [scanningKey, setScanningKey] = useState<string | null>(null);
  const [policyForm] = Form.useForm();
  const [policySaving, setPolicySaving] = useState(false);
  const [policy, setPolicy] = useState<ScanPolicy>({
    engine: 'Trivy',
    frequency: '每次推送',
    threshold: 'Critical+High',
    autoBlock: true,
  });
  const [scanData, setScanData] = useState<ImageScanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadScans = async () => {
    setLoading(true);
    try {
      const res = await listContainerScans({ page: 1, page_size: 100 });
      const raw = res.data as { data?: ImageScanRecord[] } | ImageScanRecord[];
      setScanData(Array.isArray(raw) ? raw : raw.data || []);
    } catch (err: any) {
      message.error(`加载扫描数据失败: ${err.message}`);
      setScanData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScans();
  }, []);

  const handleScan = async (record: ImageScanRecord) => {
    setScanningKey(record.key);
    try {
      await runContainerScan({ image: record.image, tag: record.tag, engine: policy.engine });
      message.success('扫描已发起');
      loadScans();
    } catch (err: any) {
      message.error(`发起扫描失败: ${err.message}`);
    } finally {
      setScanningKey(null);
    }
  };

  /**
   * 过滤扫描数据
   */
  const filteredData = useMemo(() => {
    let data = scanData;
    if (searchText) {
      const keyword = searchText.toLowerCase();
      data = data.filter(
        (r) => r.image.toLowerCase().includes(keyword) || r.tag.toLowerCase().includes(keyword)
      );
    }
    if (statusFilter !== 'all') {
      data = data.filter((r) => r.status === statusFilter);
    }
    return data;
  }, [searchText, statusFilter, scanData]);

  const vulnDist = calcVulnDistribution(scanData);

  /**
   * 统计指标
   */
  const totalImages = scanData.length;
  const highVulns = scanData.reduce((s, r) => s + r.critical + r.high, 0);
  const passedCount = scanData.filter((r) => r.status === 'passed').length;
  const fixRate = totalImages > 0 ? Math.round((passedCount / totalImages) * 100) : 0;
  const pendingScan = scanData.filter((r) => r.status === 'failed').length;

  /**
   * 表格列定义
   */
  const columns: ColumnsType<ImageScanRecord> = [
    {
      title: '镜像名称',
      dataIndex: 'image',
      key: 'image',
      render: (text: string) => (
        <Text strong style={{ fontFamily: 'monospace', fontSize: 13 }}>
          {text}
        </Text>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tag',
      key: 'tag',
      render: (text: string) => <Tag style={{ borderRadius: 6 }}>{text}</Tag>,
    },
    {
      title: '扫描时间',
      dataIndex: 'scanTime',
      key: 'scanTime',
      render: (text: string) => <Text type="secondary">{text}</Text>,
    },
    {
      title: '漏洞总数',
      key: 'total',
      render: (_, record) => renderVulnTotal(record),
    },
    {
      title: '高危',
      dataIndex: 'critical',
      key: 'critical',
      render: (val: number) =>
        val > 0 ? <Tag color={commonStyle.error}>{val}</Tag> : <Text>-</Text>,
    },
    {
      title: '中危',
      dataIndex: 'medium',
      key: 'medium',
      render: (val: number) =>
        val > 0 ? <Tag color={commonStyle.warning}>{val}</Tag> : <Text>-</Text>,
    },
    {
      title: '低危',
      dataIndex: 'low',
      key: 'low',
      render: (val: number) =>
        val > 0 ? <Tag color={commonStyle.info}>{val}</Tag> : <Text>-</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (val: ScanStatus) => renderStatus(val),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record: ImageScanRecord) => (
        <Space size={8}>
          <Tooltip title="查看详情">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              style={{ color: commonStyle.primary }}
              onClick={() => message.info(`查看 ${record.image}:${record.tag} 的扫描详情`)}
            />
          </Tooltip>
          <Tooltip title="重新扫描">
            <Button
              type="text"
              size="small"
              icon={scanningKey === record.key ? <ReloadOutlined spin /> : <PlayCircleOutlined />}
              loading={scanningKey === record.key}
              style={{ color: commonStyle.info }}
              disabled={scanningKey === record.key}
              onClick={() => handleScan(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  /**
   * 保存扫描策略
   */
  const handleSavePolicy = async () => {
    try {
      setPolicySaving(true);
      await new Promise((resolve) => setTimeout(resolve, 800));
      message.success('扫描策略保存成功');
    } catch {
      message.error('保存策略失败');
    } finally {
      setPolicySaving(false);
    }
  };

  /**
   * 漏洞分布卡片数据
   */
  const vulnCards = vulnDist.map((v) => ({
    ...v,
    icon:
      v.severity === 'Critical' ? (
        <ExclamationCircleOutlined style={{ color: v.color }} />
      ) : v.severity === 'High' ? (
        <WarningOutlined style={{ color: v.color }} />
      ) : v.severity === 'Medium' ? (
        <InfoCircleOutlined style={{ color: v.color }} />
      ) : (
        <CheckCircleOutlined style={{ color: v.color }} />
      ),
  }));

  return (
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <SafetyOutlined style={{ marginRight: 12, color: commonStyle.primary }} />
        容器镜像安全扫描
      </Title>
      <Text type="secondary">Trivy/Clair 漏洞扫描 · 镜像合规 · 修复建议</Text>

      <Divider />

      {/* 顶部统计卡片 */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              borderLeft: `3px solid ${commonStyle.primary}`,
            }}
          >
            <Statistic
              title="扫描镜像总数"
              value={totalImages}
              valueStyle={{ color: commonStyle.primary }}
              suffix={
                <Text type="secondary" style={{ fontSize: 14 }}>
                  个镜像
                </Text>
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              borderLeft: `3px solid ${commonStyle.error}`,
            }}
          >
            <Statistic
              title="高危漏洞数"
              value={highVulns}
              valueStyle={{ color: commonStyle.error }}
              suffix={
                <Text type="secondary" style={{ fontSize: 14 }}>
                  个漏洞
                </Text>
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              borderLeft: `3px solid ${commonStyle.success}`,
            }}
          >
            <Statistic
              title="已修复率"
              value={fixRate}
              valueStyle={{ color: commonStyle.success }}
              suffix={
                <Text type="secondary" style={{ fontSize: 14 }}>
                  %
                </Text>
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              borderLeft: `3px solid ${commonStyle.warning}`,
            }}
          >
            <Statistic
              title="待扫描镜像"
              value={pendingScan}
              valueStyle={{ color: commonStyle.warning }}
              suffix={
                <Text type="secondary" style={{ fontSize: 14 }}>
                  个镜像
                </Text>
              }
            />
          </Card>
        </Col>
      </Row>

      {/* 中间主体：扫描结果 + 漏洞分布 */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.lg }}>
        <Col span={14}>
          <Card
            title={
              <Space>
                <SearchOutlined />
                <span>扫描结果</span>
              </Space>
            }
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ marginBottom: spacing.md, display: 'flex', gap: spacing.sm }}>
              <Search
                placeholder="搜索镜像名称或标签"
                allowClear
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 280 }}
              />
              <Select
                placeholder="筛选状态"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 160 }}
              >
                <Option value="all">全部</Option>
                <Option value="passed">通过</Option>
                <Option value="vulnerable">有漏洞</Option>
                <Option value="failed">扫描失败</Option>
              </Select>
            </div>

            <Table
              loading={loading}
              columns={columns}
              dataSource={filteredData}
              rowKey="key"
              size="small"
              pagination={{ pageSize: 8, showSizeChanger: false, showQuickJumper: true }}
              scroll={{ x: 800 }}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        </Col>

        <Col span={10}>
          <Card
            title={
              <Space>
                <WarningOutlined />
                <span>漏洞分布</span>
              </Space>
            }
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
              {vulnCards.map((v) => (
                <div
                  key={v.severity}
                  style={{
                    padding: spacing.sm,
                    borderRadius: 8,
                    backgroundColor: themeVars.bgSecondary,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}
                  >
                    <Space size={8}>
                      {v.icon}
                      <Text strong>{v.severity}</Text>
                    </Space>
                    <Text strong style={{ color: v.color }}>
                      {v.count} ({v.percentage}%)
                    </Text>
                  </div>
                  <Progress
                    percent={v.percentage}
                    strokeColor={v.color}
                    trailColor={colors.neutral[100]}
                    showInfo={false}
                    style={{ marginTop: 4 }}
                  />
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 底部：扫描策略 */}
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>扫描策略</span>
          </Space>
        }
        style={{
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <Form
          form={policyForm}
          layout="horizontal"
          initialValues={policy}
          style={{ maxWidth: 700, margin: '0 auto' }}
        >
          <Row gutter={[spacing.lg, spacing.md]}>
            <Col span={12}>
              <Form.Item label="扫描引擎" name="engine">
                <Select placeholder="选择扫描引擎">
                  <Option value="Trivy">Trivy</Option>
                  <Option value="Clair">Clair</Option>
                  <Option value="Aqua">Aqua</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="扫描频率" name="frequency">
                <Select placeholder="选择扫描频率">
                  <Option value="每次推送">每次推送</Option>
                  <Option value="每日">每日</Option>
                  <Option value="每周">每周</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="漏洞阈值" name="threshold">
                <Select placeholder="选择漏洞阈值">
                  <Option value="Critical only">Critical only</Option>
                  <Option value="Critical+High">Critical+High</Option>
                  <Option value="All">All</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="自动阻止部署" name="autoBlock" valuePropName="checked">
                <Switch
                  checkedChildren="开启"
                  unCheckedChildren="关闭"
                  onChange={(checked: boolean) => {
                    setPolicy((prev) => ({ ...prev, autoBlock: checked }));
                    message.info(checked ? '自动阻止部署已开启' : '自动阻止部署已关闭');
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ textAlign: 'right', marginTop: spacing.sm }}>
            <Button
              type="primary"
              icon={<StopOutlined />}
              loading={policySaving}
              onClick={handleSavePolicy}
              style={{
                backgroundColor: commonStyle.primary,
                borderColor: commonStyle.primary,
                minWidth: 120,
              }}
            >
              保存策略
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ContainerScanPage;
