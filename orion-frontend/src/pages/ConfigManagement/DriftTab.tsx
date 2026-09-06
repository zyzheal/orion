/**
 * DriftTab — 配置漂移检测 Tab
 */
import React from 'react';
import {
  Card,
  Button,
  Tag,
  Alert,
  List,
  Space,
  Empty,
  Typography,
} from 'antd';

const { Paragraph, Text } = Typography;
import { ScanOutlined, FileTextOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { DriftResult } from '@/api/config';

export interface DriftTabProps {
  driftLoading: boolean;
  driftResult: DriftResult | null;
  onDriftDetect: () => void;
}

export const DriftTab: React.FC<DriftTabProps> = ({
  driftLoading,
  driftResult,
  onDriftDetect,
}) => (
  <Card
    title="配置漂移检测"
    extra={
      <Button
        type="primary"
        icon={<ScanOutlined />}
        onClick={onDriftDetect}
        loading={driftLoading}
      >
        检测漂移
      </Button>
    }
  >
    <Paragraph type="secondary">
      检测当前环境与 Git 仓库之间的配置差异，识别配置漂移。 漂移指本地配置与 Git
      中定义的配置不一致的情况。
    </Paragraph>

    {driftResult && (
      <>
        <Alert
          message={
            driftResult.driftDetected
              ? `检测到 ${driftResult.itemCount} 处配置漂移`
              : '未检测到配置漂移'
          }
          type={driftResult.driftDetected ? 'warning' : 'success'}
          showIcon
          style={{ marginBottom: spacing.md }}
        />

        {driftResult.driftDetected && driftResult.items && driftResult.items.length > 0 && (
          <List
            bordered
            dataSource={driftResult.items}
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
                    <div>
                      <Paragraph
                        style={{
                          background: colors.error[50],
                          padding: '4px 8px',
                          borderRadius: 4,
                          marginBottom: 4,
                        }}
                      >
                        <Text type="secondary">当前值: </Text>
                        <Text delete style={{ fontSize: 12 }}>
                          {typeof item.localValue === 'string'
                            ? item.localValue
                            : JSON.stringify(item.localValue)}
                        </Text>
                      </Paragraph>
                      <Paragraph
                        style={{
                          background: colors.success[50],
                          padding: '4px 8px',
                          borderRadius: 4,
                        }}
                      >
                        <Text type="secondary">期望值: </Text>
                        <Text style={{ fontSize: 12, color: colors.success[600] }}>
                          {typeof item.remoteValue === 'string'
                            ? item.remoteValue
                            : JSON.stringify(item.remoteValue)}
                        </Text>
                      </Paragraph>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}

        {!driftResult.driftDetected && (
          <Empty
            image={
              <CheckCircleOutlined style={{ fontSize: 64, color: colors.success[500] }} />
            }
            description="当前环境与 Git 仓库配置完全一致"
          />
        )}
      </>
    )}

    {!driftResult && <Empty description="点击检测漂移按钮开始扫描" />}
  </Card>
);
