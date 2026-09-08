/**
 * TestAreaCard.tsx - 子应用加载测试卡
 * 抽取自 index.tsx (P2-9 Phase 229)
 */
import React from 'react';
import { Button, Card, Space, Typography } from 'antd';
import { DeleteOutlined, RocketOutlined, SyncOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { TEST_SUBAPPS, type TestResult } from '../constants';

const { Title, Text } = Typography;

interface Props {
  testResults: TestResult[];
  loading: string | null;
  onLoadSubApp: (appKey: string) => void;
  onClear: () => void;
}

export const TestAreaCard: React.FC<Props> = ({
  testResults,
  loading,
  onLoadSubApp,
  onClear,
}) => (
  <Card style={{ marginBottom: spacing.lg }}>
    <Space direction="vertical" style={{ width: '100%' }}>
      <Title level={4}>子应用加载测试</Title>
      <Space wrap>
        {TEST_SUBAPPS.map((app) => {
          const result = testResults.find((r) => r.appKey === app.key);
          return (
            <Button
              key={app.key}
              type={result?.status === 'success' ? 'default' : 'primary'}
              icon={loading === app.key ? <SyncOutlined spin /> : <RocketOutlined />}
              onClick={() => onLoadSubApp(app.key)}
              loading={loading === app.key}
              disabled={result?.status === 'success'}
            >
              加载 {app.name}
            </Button>
          );
        })}
        <Button icon={<DeleteOutlined />} onClick={onClear}>
          清理
        </Button>
      </Space>

      {testResults.length > 0 && (
        <div style={{ marginTop: spacing.md }}>
          <Text strong>测试结果：</Text>
          <ul>
            {testResults.map((result) => (
              <li key={result.appKey}>
                <Text code>{result.appKey}</Text>
                {' - '}
                <Text
                  style={{
                    color:
                      result.status === 'success'
                        ? colors.success[500]
                        : result.status === 'error'
                          ? colors.error[500]
                          : colors.warning[500],
                  }}
                >
                  {result.status === 'loading' && '加载中...'}
                  {result.status === 'success' && `成功 (${result.duration}ms)`}
                  {result.status === 'error' && `失败: ${result.error}`}
                  {result.status === 'pending' && '待测试'}
                </Text>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Space>
  </Card>
);
