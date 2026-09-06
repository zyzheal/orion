/**
 * DiffTab — 差异对比 Tab
 * 包含环境对比、版本对比、综合差异报告三个子区块
 */
import React from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Select,
  Space,
  Statistic,
  Tag,
  Alert,
  List,
  Empty,
  Typography,
} from 'antd';
import {
  DiffOutlined,
  FileTextOutlined,
  RocketOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import {
  ENVIRONMENTS,
  VERSION_OPTIONS,
  CHANGE_COLOR_MAP,
  CHANGE_LABEL_MAP,
} from './config';
import type {
  ConfigDiff,
  ConfigChange,
  EnvDiffResult,
} from '@/api/config';

const { Text } = Typography;

/** 差异变更项渲染器 */
export const renderChangeItem = (change: ConfigChange) => (
  <div
    key={change.path}
    style={{
      padding: '8px 12px',
      marginBottom: spacing.sm,
      borderRadius: 4,
      background: colors.neutral[50],
      borderLeft: `3px solid ${CHANGE_COLOR_MAP[change.operation] || colors.neutral[400]}`,
    }}
  >
    <Space style={{ marginBottom: 4 }}>
      <Tag color={CHANGE_COLOR_MAP[change.operation]}>{CHANGE_LABEL_MAP[change.operation]}</Tag>
      <Text strong>{change.path}</Text>
    </Space>
    {change.oldValue !== undefined && change.operation !== 'add' && (
      <div style={{ marginBottom: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          旧值:{' '}
        </Text>
        <Text delete style={{ fontSize: 12, color: colors.error[500] }}>
          {typeof change.oldValue === 'string'
            ? change.oldValue
            : JSON.stringify(change.oldValue)}
        </Text>
      </div>
    )}
    {change.newValue !== undefined && change.operation !== 'remove' && (
      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          新值:{' '}
        </Text>
        <Text style={{ fontSize: 12, color: colors.success[600] }}>
          {typeof change.newValue === 'string'
            ? change.newValue
            : JSON.stringify(change.newValue)}
        </Text>
      </div>
    )}
  </div>
);

export interface DiffReportData {
  totalConfigs: number;
  totalDifferences: number;
  items: {
    key: string;
    environment: string;
    changes: {
      path: string;
      operation: string;
      oldValue?: unknown;
      newValue?: unknown;
    }[];
  }[];
}

export interface DiffTabProps {
  sourceEnv: string;
  targetEnv: string;
  onSourceEnvChange: (value: string) => void;
  onTargetEnvChange: (value: string) => void;
  envDiffLoading: boolean;
  envDiffResult: EnvDiffResult | null;
  onEnvCompare: () => void;
  versionDiffConfigId: string;
  versionA: number;
  versionB: number;
  onVersionDiffConfigIdChange: (value: string) => void;
  onVersionAChange: (value: number) => void;
  onVersionBChange: (value: number) => void;
  versionDiffLoading: boolean;
  versionDiffResult: ConfigDiff | null;
  onVersionCompare: () => void;
  configSelectOptions: { label: string; value: string }[];
  reportLoading: boolean;
  diffReport: DiffReportData | null;
  onGenerateReport: () => void;
}

export const DiffTab: React.FC<DiffTabProps> = ({
  sourceEnv,
  targetEnv,
  onSourceEnvChange,
  onTargetEnvChange,
  envDiffLoading,
  envDiffResult,
  onEnvCompare,
  versionDiffConfigId,
  versionA,
  versionB,
  onVersionDiffConfigIdChange,
  onVersionAChange,
  onVersionBChange,
  versionDiffLoading,
  versionDiffResult,
  onVersionCompare,
  configSelectOptions,
  reportLoading,
  diffReport,
  onGenerateReport,
}) => (
  <Space direction="vertical" size="large" style={{ width: '100%' }}>
    <Card
      title="环境差异对比"
      extra={
        <Button
          type="primary"
          icon={<DiffOutlined />}
          onClick={onEnvCompare}
          loading={envDiffLoading}
        >
          对比
        </Button>
      }
    >
      <Row gutter={24} align="middle">
        <Col span={6}>
          <Text strong>源环境:</Text>
          <Select
            value={sourceEnv}
            onChange={onSourceEnvChange}
            style={{ width: '100%', marginTop: spacing.sm }}
            options={ENVIRONMENTS.map((e) => ({ label: e, value: e }))}
          />
        </Col>
        <Col span={2} style={{ textAlign: 'center' }}>
          <ArrowRightOutlined style={{ fontSize: 20, color: colors.primary[500] }} />
        </Col>
        <Col span={6}>
          <Text strong>目标环境:</Text>
          <Select
            value={targetEnv}
            onChange={onTargetEnvChange}
            style={{ width: '100%', marginTop: spacing.sm }}
            options={ENVIRONMENTS.map((e) => ({ label: e, value: e }))}
          />
        </Col>
      </Row>

      {envDiffResult && (
        <div style={{ marginTop: spacing.md }}>
          <Row gutter={16} style={{ marginBottom: spacing.md }}>
            <Col span={6}>
              <Statistic
                title="配置总数"
                value={envDiffResult.totalConfigs}
                valueStyle={{ fontSize: 20 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="完全一致"
                value={envDiffResult.identical}
                valueStyle={{ color: colors.success[500], fontSize: 20 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="有差异"
                value={envDiffResult.differences.length}
                valueStyle={{ color: colors.warning[500], fontSize: 20 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="仅在一侧"
                value={
                  (envDiffResult.onlyInSource?.length || 0) +
                  (envDiffResult.onlyInTarget?.length || 0)
                }
                valueStyle={{ color: colors.error[500], fontSize: 20 }}
              />
            </Col>
          </Row>

          {envDiffResult.differences.length > 0 && (
            <>
              <Text strong style={{ display: 'block', marginBottom: spacing.sm }}>
                差异详情 ({envDiffResult.differences.length} 项)
              </Text>
              {envDiffResult.differences.map((change) => renderChangeItem(change))}
            </>
          )}

          {(envDiffResult.onlyInSource?.length > 0 ||
            envDiffResult.onlyInTarget?.length > 0) && (
            <>
              <Text
                strong
                style={{ display: 'block', marginTop: spacing.md, marginBottom: spacing.sm }}
              >
                仅存在于一侧的配置项
              </Text>
              {envDiffResult.onlyInSource?.map((key) => (
                <Tag
                  key={`src-${key}`}
                  color={colors.warning[100]}
                  style={{ marginBottom: 4 }}
                >
                  仅在 {sourceEnv}: {key}
                </Tag>
              ))}
              {envDiffResult.onlyInTarget?.map((key) => (
                <Tag key={`tgt-${key}`} color={colors.info[100]} style={{ marginBottom: 4 }}>
                  仅在 {targetEnv}: {key}
                </Tag>
              ))}
            </>
          )}

          {envDiffResult.differences.length === 0 &&
            (envDiffResult.onlyInSource?.length || 0) +
              (envDiffResult.onlyInTarget?.length || 0) ===
              0 && (
              <Alert
                message="两个环境的配置完全一致"
                type="success"
                showIcon
                style={{ marginTop: spacing.sm }}
              />
            )}
        </div>
      )}

      {!envDiffResult && (
        <Empty description="请选择环境并点击对比" style={{ marginTop: spacing.md }} />
      )}
    </Card>

    <Card
      title="版本差异对比"
      extra={
        <Button
          type="primary"
          icon={<DiffOutlined />}
          onClick={onVersionCompare}
          loading={versionDiffLoading}
        >
          对比
        </Button>
      }
    >
      <Row gutter={16} align="middle">
        <Col span={8}>
          <Text strong>配置项:</Text>
          <Select
            value={versionDiffConfigId || undefined}
            onChange={onVersionDiffConfigIdChange}
            style={{ width: '100%', marginTop: spacing.sm }}
            options={configSelectOptions}
            placeholder="选择配置项"
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Col>
        <Col span={4}>
          <Text strong>版本 A:</Text>
          <Select
            value={versionA}
            onChange={onVersionAChange}
            style={{ width: '100%', marginTop: spacing.sm }}
            options={VERSION_OPTIONS}
          />
        </Col>
        <Col span={4}>
          <Text strong>版本 B:</Text>
          <Select
            value={versionB}
            onChange={onVersionBChange}
            style={{ width: '100%', marginTop: spacing.sm }}
            options={VERSION_OPTIONS}
          />
        </Col>
      </Row>

      {versionDiffResult &&
        versionDiffResult.changes &&
        versionDiffResult.changes.length > 0 && (
          <div style={{ marginTop: spacing.md }}>
            <Text strong style={{ display: 'block', marginBottom: spacing.sm }}>
              变更项 ({versionDiffResult.changes.length} 项)
            </Text>
            {versionDiffResult.changes.map((change: any) => renderChangeItem(change))}
          </div>
        )}
      {versionDiffResult &&
        (!versionDiffResult.changes || versionDiffResult.changes.length === 0) && (
          <Alert
            message="两个版本的配置完全一致"
            type="success"
            showIcon
            style={{ marginTop: spacing.md }}
          />
        )}
      {!versionDiffResult && (
        <Empty description="请选择配置项和版本并点击对比" style={{ marginTop: spacing.md }} />
      )}
    </Card>

    <Card
      title="综合差异报告"
      extra={
        <Button
          type="primary"
          icon={<RocketOutlined />}
          onClick={onGenerateReport}
          loading={reportLoading}
        >
          生成报告
        </Button>
      }
    >
      {diffReport && (
        <>
          <Row gutter={16} style={{ marginBottom: spacing.md }}>
            <Col span={8}>
              <Statistic
                title="配置总数"
                value={diffReport.totalConfigs}
                valueStyle={{ fontSize: 20 }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="差异总数"
                value={diffReport.totalDifferences}
                valueStyle={{
                  color:
                    diffReport.totalDifferences > 0
                      ? colors.warning[500]
                      : colors.success[500],
                  fontSize: 20,
                }}
              />
            </Col>
          </Row>

          {diffReport.items.length > 0 ? (
            <List
              bordered
              dataSource={diffReport.items}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <FileTextOutlined />
                        <Text strong>{item.key}</Text>
                        <Tag color="blue">{item.environment}</Tag>
                      </Space>
                    }
                    description={
                      <Space wrap>
                        {item.changes.map((c, idx) => (
                          <Tag
                            key={String(idx)}
                            color={CHANGE_COLOR_MAP[c.operation] || 'default'}
                          >
                            {c.path} ({c.operation})
                          </Tag>
                        ))}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Alert message="所有环境配置完全一致" type="success" showIcon />
          )}
        </>
      )}
      {!diffReport && <Empty description="点击生成报告查看综合差异" />}
    </Card>
  </Space>
);
