/**
 * MatrixConfigurator - 矩阵构建配置组件
 *
 * 用于在 Pipeline 阶段中配置矩阵构建（Matrix Build），支持：
 * - 添加/删除矩阵维度（key + values 数组）
 * - 预设模板快速选择
 * - 实时显示笛卡尔积组合数
 * - 排除规则配置
 * - 可视化网格预览所有组合
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  Input,
  Select,
  Space,
  Button,
  Tag,
  Table,
  Badge,
  Card,
  Alert,
  Divider,
  Typography,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  BlockOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Text } = Typography;

// ============================================================================
// Types
// ============================================================================

/** 矩阵维度：key (如 "os", "node") + values (值数组) */
export interface MatrixDimension {
  key: string;
  values: string[];
}

/** 排除规则：匹配一组维度值则排除该组合 */
export interface ExclusionRule {
  /** 格式: { "os": "windows", "node": "18" } — 匹配此规则的组合将被排除 */
  match: Record<string, string>;
  reason?: string;
}

/** 矩阵构建配置 */
export interface MatrixBuildConfig {
  enabled: boolean;
  dimensions: MatrixDimension[];
  exclusions: ExclusionRule[];
}

/** 笛卡尔积中的一个组合 */
export interface MatrixCombination {
  index: number;
  values: Record<string, string>;
  excluded: boolean;
  excludedBy?: ExclusionRule;
}

/** MatrixConfigurator 属性 */
export interface MatrixConfiguratorProps {
  /** 当前配置值 */
  value?: MatrixBuildConfig;
  /** 值变更回调 */
  onChange?: (value: MatrixBuildConfig) => void;
}

// ============================================================================
// 预设模板
// ============================================================================

interface PresetTemplate {
  label: string;
  dimensions: Array<{ keyPlaceholder: string; values: string[] }>;
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    label: 'Node.js 版本',
    dimensions: [
      { keyPlaceholder: 'node', values: ['18', '20', '22'] },
    ],
  },
  {
    label: '操作系统',
    dimensions: [
      { keyPlaceholder: 'os', values: ['linux', 'macos', 'windows'] },
    ],
  },
  {
    label: 'Python 版本',
    dimensions: [
      { keyPlaceholder: 'python', values: ['3.9', '3.10', '3.11', '3.12'] },
    ],
  },
  {
    label: 'Node.js × OS 组合',
    dimensions: [
      { keyPlaceholder: 'node', values: ['18', '20', '22'] },
      { keyPlaceholder: 'os', values: ['linux', 'macos'] },
    ],
  },
  {
    label: 'Python × OS 组合',
    dimensions: [
      { keyPlaceholder: 'python', values: ['3.10', '3.11', '3.12'] },
      { keyPlaceholder: 'os', values: ['linux', 'macos', 'windows'] },
    ],
  },
];

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 计算多个数组的笛卡尔积
 */
function cartesianProduct(arrays: string[][]): string[][] {
  if (arrays.length === 0) return [[]];
  return arrays.reduce<string[][]>(
    (acc, curr) => acc.flatMap((a) => curr.map((c) => [...a, c])),
    [[]]
  );
}

/**
 * 生成所有组合并标记被排除的项
 */
function generateCombinations(
  dimensions: MatrixDimension[],
  exclusions: ExclusionRule[]
): MatrixCombination[] {
  if (dimensions.length === 0 || dimensions.some((d) => d.values.length === 0)) {
    return [];
  }

  const valueArrays = dimensions.map((d) => d.values);
  const product = cartesianProduct(valueArrays);

  return product.map((combo, index) => {
    const values: Record<string, string> = {};
    dimensions.forEach((d, i) => {
      values[d.key] = combo[i];
    });

    // 检查是否匹配任何排除规则
    const matchedRule = exclusions.find((rule) =>
      Object.entries(rule.match).every(([key, val]) => values[key] === val)
    );

    return {
      index,
      values,
      excluded: !!matchedRule,
      excludedBy: matchedRule,
    };
  });
}

/**
 * 解析逗号分隔的字符串为值数组
 */
function parseValues(input: string): string[] {
  return input
    .split(/[,\s]+/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

// ============================================================================
// Component
// ============================================================================

const MatrixConfigurator: React.FC<MatrixConfiguratorProps> = ({
  value,
  onChange,
}) => {
  const [dimensions, setDimensions] = useState<MatrixDimension[]>(
    value?.dimensions || []
  );
  const [exclusions, setExclusions] = useState<ExclusionRule[]>(
    value?.exclusions || []
  );

  // 同步到外部 value（仅在 dimensions/exclusions 变化时）
  // 注意：enabled 状态由外部 Switch 控制，不应根据 dimensions.length 自动推断
  const config = useMemo<MatrixBuildConfig>(
    () => ({
      enabled: value?.enabled ?? dimensions.length > 0,
      dimensions,
      exclusions,
    }),
    [dimensions, exclusions, value?.enabled]
  );

  // 计算组合
  const combinations = useMemo(
    () => generateCombinations(dimensions, exclusions),
    [dimensions, exclusions]
  );

  // 统计有效和排除的组合数
  const totalCount = combinations.length;
  const excludedCount = combinations.filter((c) => c.excluded).length;
  const effectiveCount = totalCount - excludedCount;

  // 通知外部配置变更
  React.useEffect(() => {
    onChange?.(config);
  }, [config, onChange]);

  // --------------------------------------------------------------------------
  // 维度操作
  // --------------------------------------------------------------------------

  const handleAddDimension = useCallback(() => {
    setDimensions((prev) => [
      ...prev,
      { key: '', values: [] },
    ]);
  }, []);

  const handleRemoveDimension = useCallback((index: number) => {
    setDimensions((prev) => prev.filter((_, i) => i !== index));
    // 同时清理引用了该维度 key 的排除规则
  }, []);

  const handleUpdateDimensionKey = useCallback((index: number, key: string) => {
    setDimensions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], key };
      return next;
    });
  }, []);

  const handleUpdateDimensionValues = useCallback(
    (index: number, valuesInput: string) => {
      const values = parseValues(valuesInput);
      setDimensions((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], values };
        return next;
      });
    },
    []
  );

  // --------------------------------------------------------------------------
  // 预设模板
  // --------------------------------------------------------------------------

  const handleApplyPreset = useCallback((preset: PresetTemplate) => {
    setDimensions(
      preset.dimensions.map((d) => ({
        key: d.keyPlaceholder,
        values: d.values,
      }))
    );
    setExclusions([]);
  }, []);

  // --------------------------------------------------------------------------
  // 排除规则操作
  // --------------------------------------------------------------------------

  const handleAddExclusion = useCallback(() => {
    // 默认匹配第一个维度的第一个值
    const defaultMatch: Record<string, string> = {};
    dimensions.forEach((d) => {
      if (d.key && d.values.length > 0) {
        defaultMatch[d.key] = d.values[0];
      }
    });
    setExclusions((prev) => [
      ...prev,
      { match: defaultMatch, reason: '' },
    ]);
  }, [dimensions]);

  const handleRemoveExclusion = useCallback((index: number) => {
    setExclusions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpdateExclusionMatch = useCallback(
    (exIndex: number, dimKey: string, dimValue: string) => {
      setExclusions((prev) => {
        const next = [...prev];
        next[exIndex] = {
          ...next[exIndex],
          match: { ...next[exIndex].match, [dimKey]: dimValue },
        };
        return next;
      });
    },
    []
  );

  const handleUpdateExclusionReason = useCallback((exIndex: number, reason: string) => {
    setExclusions((prev) => {
      const next = [...prev];
      next[exIndex] = { ...next[exIndex], reason };
      return next;
    });
  }, []);

  // --------------------------------------------------------------------------
  // 组合预览表格列
  // --------------------------------------------------------------------------

  const combinationColumns = useMemo(() => {
    if (dimensions.length === 0) return [];

    const cols: any[] = [
      {
        title: '#',
        dataIndex: 'index',
        key: 'index',
        width: 50,
        render: (val: number) => val + 1,
      },
    ];

    dimensions.forEach((d) => {
      cols.push({
        title: d.key || '(未命名)',
        key: d.key || `dim-${dimensions.indexOf(d)}`,
        render: (_: unknown, record: MatrixCombination) => record.values[d.key] || '-',
      });
    });

    cols.push({
      title: '状态',
      key: 'status',
      width: 80,
      render: (_: unknown, record: MatrixCombination) =>
        record.excluded ? (
          <Tooltip title={record.excludedBy?.reason || '已排除'}>
            <Badge status="error" text="排除" />
          </Tooltip>
        ) : (
          <Badge status="success" text="执行" />
        ),
    });

    return cols;
  }, [dimensions]);

  // --------------------------------------------------------------------------
  // 渲染
  // --------------------------------------------------------------------------

  // 没有维度时的引导界面
  if (dimensions.length === 0) {
    return (
      <Card
        size="small"
        title={
          <Space>
            <ThunderboltOutlined style={{ color: colors.warning[500] }} />
            <span>矩阵构建配置</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={handleAddDimension}
          >
            添加维度
          </Button>
        }
      >
        <Alert
          type="info"
          message="矩阵构建可以对多个维度进行组合，一次运行所有组合"
          description="例如：3 个 Node.js 版本 × 2 个操作系统 = 6 个并行任务"
          showIcon
          style={{ marginBottom: spacing.md }}
        />

        <Text strong>快速选择预设模板：</Text>
        <div style={{ marginTop: spacing[3] }}>
          <Space wrap>
            {PRESET_TEMPLATES.map((preset) => (
              <Button
                key={preset.label}
                size="small"
                onClick={() => handleApplyPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </Space>
        </div>
      </Card>
    );
  }

  // 维度列表
  const dimensionRows = dimensions.map((dim, index) => (
    <Space key={index} style={{ width: '100%', marginBottom: spacing.sm }} align="start">
      <Input
        value={dim.key}
        onChange={(e) => handleUpdateDimensionKey(index, e.target.value)}
        placeholder="维度名称 (如 os, node, python)"
        style={{ width: 200 }}
        addonBefore="Key"
      />
      <Input
        value={dim.values.join(', ')}
        onChange={(e) => handleUpdateDimensionValues(index, e.target.value)}
        placeholder="用逗号分隔多个值"
        style={{ flex: 1 }}
        addonBefore="Values"
      />
      <Tooltip title="删除此维度">
        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveDimension(index)}
        />
      </Tooltip>
    </Space>
  ));

  // 已选值 Tag 预览
  const dimensionTags = dimensions
    .filter((d) => d.key && d.values.length > 0)
    .map((d, idx) => (
      <Space key={idx} style={{ marginBottom: 4 }}>
        <Tag color="blue">
          {d.key}: {d.values.map((v) => `"${v}"`).join(', ')}
        </Tag>
      </Space>
    ));

  // 组合数预览
  let previewText = '';
  if (dimensions.every((d) => d.key && d.values.length > 0)) {
    const parts = dimensions.map((d) => `${d.values.length} ${d.key}`);
    previewText = `${parts.join(' × ')} = ${totalCount} 个组合`;
    if (excludedCount > 0) {
      previewText += `，排除 ${excludedCount} 个，有效 ${effectiveCount} 个`;
    }
  }

  return (
    <Card
      size="small"
      title={
        <Space>
          <ThunderboltOutlined style={{ color: colors.warning[500] }} />
          <span>矩阵构建配置</span>
          {totalCount > 0 && (
            <Tag color="processing">{effectiveCount} 个任务</Tag>
          )}
        </Space>
      }
      extra={
        <Button
          type="link"
          size="small"
          icon={<PlusOutlined />}
          onClick={handleAddDimension}
        >
          添加维度
        </Button>
      }
    >
      {/* 预设模板 */}
      <div style={{ marginBottom: spacing.md }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          快速预设：
        </Text>
        <Space wrap style={{ marginLeft: spacing.sm }}>
          {PRESET_TEMPLATES.map((preset) => (
            <Button
              key={preset.label}
              size="small"
              type="default"
              onClick={() => handleApplyPreset(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </Space>
      </div>

      {/* 维度列表 */}
      <div style={{ marginBottom: spacing.md }}>
        {dimensionRows}
      </div>

      {/* 维度值预览 */}
      {dimensionTags.length > 0 && (
        <div style={{ marginBottom: spacing[3] }}>{dimensionTags}</div>
      )}

      {/* 组合数预览 */}
      {previewText && (
        <Alert
          type="success"
          icon={<CheckCircleOutlined />}
          message={
            <Space>
              <Text strong>组合预览：</Text>
              <Text>{previewText}</Text>
            </Space>
          }
          showIcon
          style={{ marginBottom: spacing.md }}
        />
      )}

      {/* 组合表格预览 */}
      {combinations.length > 0 && combinations.length <= 100 && (
        <Table
          size="small"
          columns={combinationColumns}
          dataSource={combinations}
          rowKey="index"
          pagination={false}
          scroll={{ y: 200 }}
          rowClassName={(record: MatrixCombination) =>
            record.excluded ? 'matrix-excluded-row' : ''
          }
          style={{ marginBottom: spacing.md }}
        />
      )}

      {/* 组合数过多时的提示 */}
      {combinations.length > 100 && (
        <Alert
          type="warning"
          message={`组合数较多：共 ${totalCount} 个组合，${excludedCount} 个被排除，${effectiveCount} 个将执行`}
          showIcon
          style={{ marginBottom: spacing.md }}
        />
      )}

      {/* 排除规则配置 */}
      <Divider orientation="left" orientationMargin={0}>
        <Space>
          <BlockOutlined />
          <span>排除规则</span>
          {exclusions.length > 0 && (
            <Badge count={exclusions.length} size="small" />
          )}
        </Space>
      </Divider>

      {exclusions.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          暂无排除规则，所有组合都将被执行
        </Text>
      ) : (
        exclusions.map((rule, exIndex) => (
          <Card
            key={exIndex}
            size="small"
            style={{ marginBottom: spacing.sm }}
            extra={
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => handleRemoveExclusion(exIndex)}
              />
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {/* 匹配条件 */}
              <Space wrap>
                {dimensions
                  .filter((d) => d.key && d.values.length > 0)
                  .map((d) => (
                    <Space key={d.key}>
                      <Text strong>{d.key} =</Text>
                      <Select
                        size="small"
                        style={{ width: 120 }}
                        value={rule.match[d.key]}
                        onChange={(val: string) =>
                          handleUpdateExclusionMatch(exIndex, d.key, val)
                        }
                        options={d.values.map((v) => ({ label: v, value: v }))}
                      />
                    </Space>
                  ))}
              </Space>

              {/* 排除原因（可选） */}
              <Input
                size="small"
                value={rule.reason}
                onChange={(e) =>
                  handleUpdateExclusionReason(exIndex, e.target.value)
                }
                placeholder="排除原因（可选）"
              />
            </Space>
          </Card>
        ))
      )}

      {dimensions.length > 0 && (
        <Button
          type="dashed"
          block
          icon={<PlusOutlined />}
          onClick={handleAddExclusion}
          style={{ marginTop: spacing.sm }}
          disabled={
            dimensions.some((d) => !d.key || d.values.length === 0)
          }
        >
          添加排除规则
        </Button>
      )}
    </Card>
  );
};

export default MatrixConfigurator;
