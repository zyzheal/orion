/**
 * ValidationReport Component
 * Displays module dependency validation results
 * Shows missing dependencies and circular dependency chains
 */
import React from 'react';
import { Typography, Card, Tag, Alert, Empty, Space, List, Collapse } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { DependencyValidationResult } from '@/api/module-manager';

const { Title, Text, Paragraph } = Typography;

// ============================================================================
// Types
// ============================================================================

interface ValidationReportProps {
  validation: DependencyValidationResult | null;
  loading?: boolean;
  startupOrder?: string[];
}

// ============================================================================
// Component
// ============================================================================

const ValidationReport: React.FC<ValidationReportProps> = ({
  validation,
  loading = false,
  startupOrder,
}) => {
  if (!validation && !loading) {
    return <Empty description="暂无校验数据" />;
  }

  if (loading) {
    return (
      <Card title="依赖校验" size="small">
        <Text type="secondary">正在加载校验结果...</Text>
      </Card>
    );
  }

  const isValid = validation?.valid ?? true;

  return (
    <Space direction="vertical" size={spacing[4]} style={{ width: '100%' }}>
      {/* Validation summary */}
      <Alert
        message={isValid ? '依赖校验通过' : '依赖校验未通过'}
        description={
          isValid
            ? '所有模块的依赖关系均满足，系统可以正常启动。'
            : `发现 ${validation!.missingDependencies.length} 个缺失依赖，${
                (validation!.circularDependencies || []).length
              } 个循环依赖链。`
        }
        type={isValid ? 'success' : 'error'}
        showIcon
        icon={
          isValid ? (
            <CheckCircleOutlined style={{ fontSize: 16 }} />
          ) : (
            <CloseCircleOutlined style={{ fontSize: 16 }} />
          )
        }
      />

      {/* Missing dependencies */}
      {validation && validation.missingDependencies.length > 0 && (
        <Card title="缺失依赖" size="small">
          <List
            dataSource={validation.missingDependencies}
            renderItem={(depId) => (
              <List.Item>
                <Space>
                  <WarningOutlined style={{ color: colors.warning[500] }} />
                  <Tag color="orange">缺失</Tag>
                  <Text code>{depId}</Text>
                  <Text type="secondary">- 该模块未注册或已被删除</Text>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* Circular dependencies */}
      {validation &&
        validation.circularDependencies &&
        validation.circularDependencies.length > 0 && (
          <Card title="循环依赖" size="small">
            <Collapse>
              {validation.circularDependencies.map((chain, index) => (
                <Collapse.Panel
                  key={index}
                  header={
                    <Space>
                      <LinkOutlined style={{ color: colors.error[500] }} />
                      <Text>循环依赖链 #{index + 1}</Text>
                      <Tag color="red">{chain.length} 个模块</Tag>
                    </Space>
                  }
                >
                  <div style={{ padding: '8px 0' }}>
                    {chain.map((moduleId, idx) => (
                      <span key={moduleId}>
                        <Tag color="volcano">{moduleId}</Tag>
                        {idx < chain.length - 1 && (
                          <Text type="secondary" style={{ margin: '0 4px' }}>
                            {'->'}
                          </Text>
                        )}
                      </span>
                    ))}
                    <Text type="secondary" style={{ margin: '0 4px' }}>
                      {'->'}
                    </Text>
                    <Tag color="volcano">{chain[0]}</Tag>
                  </div>
                </Collapse.Panel>
              ))}
            </Collapse>
          </Card>
        )}

      {/* Startup order */}
      {startupOrder && startupOrder.length > 0 && (
        <Card title="推荐启动顺序" size="small">
          <Paragraph type="secondary" style={{ marginBottom: spacing[3] }}>
            根据依赖关系拓扑排序得出的推荐启动顺序。请确保按照此顺序启动模块，以避免依赖未就绪的问题。
          </Paragraph>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {startupOrder.map((moduleId, index) => (
              <Tag
                key={moduleId}
                color={index === 0 ? 'green' : index < 5 ? 'blue' : 'default'}
                style={{ marginBottom: 4 }}
              >
                {index + 1}. {moduleId}
              </Tag>
            ))}
          </div>
        </Card>
      )}
    </Space>
  );
};

export default ValidationReport;
