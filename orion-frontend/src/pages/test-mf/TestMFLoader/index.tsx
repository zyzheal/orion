/**
 * Orion-MF 测试页面
 *
 * 用于验证 orion-mf 框架加载子应用的能力
 * 迁移阶段：Phase 0 - 并行运行验证
 */

// 注意：orion-mf 包类型声明待完善，当前使用 any 类型

import React, { useRef, useState, useEffect } from 'react';
import { Card, Button, Space, Typography, message, Divider } from 'antd';
import { RocketOutlined, SyncOutlined, DeleteOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';

// 动态加载 orion-mf
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mfLoadSubApp: ((config: any) => Promise<any>) | null = null;

// 尝试从多个位置加载
const tryLoadOrionMF = async () => {
  if (mfLoadSubApp) return;

  try {
    // 尝试从 @orion-mf/core 导入
    // @ts-ignore - 动态导入
    const mod = await import('@orion-mf/core');
    mfLoadSubApp = mod.loadSubApp;
    console.log('[TestMF] Loaded from @orion-mf/core');
  } catch (e1) {
    console.warn('[TestMF] Failed to load from @orion-mf/core:', e1);
    // 降级方案：在开发环境手动挂载到 window 以供测试
    if (import.meta.env.DEV) {
      console.warn('[TestMF] Using fallback - orion-mf not available, manual test only');
    }
  }
};

const { Title, Text, Paragraph } = Typography;

interface TestResult {
  appKey: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  error?: string;
  duration?: number;
}

/**
 * 子应用配置（模拟从后端 API 获取）
 * 注意：这些是 Module Federation 远程入口 URL
 * 当前仅为测试配置，实际运行时从 SubAppStore 动态获取
 */
const TEST_SUBAPPS = [
  {
    key: 'dba',
    name: '数据库管理',
    // 开发环境：需要子应用配置 MF 并构建
    // 这里使用占位 URL，实际需要子应用完成 MF 改造
    remoteEntryDev: 'http://localhost:3030/orion-dba/remoteEntry.js',
    remoteEntryProd: '/orion-dba/remoteEntry.js',
  },
  {
    key: 'knowledge',
    name: '知识库',
    remoteEntryDev: 'http://localhost:5173/orion-knowledge/remoteEntry.js',
    remoteEntryProd: '/orion-knowledge/remoteEntry.js',
  },
  {
    key: 'visor',
    name: '监控中心',
    remoteEntryDev: 'http://localhost:3003/orion-visor/remoteEntry.js',
    remoteEntryProd: '/orion-visor/remoteEntry.js',
  },
];

const TestMFLoader: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  // 初始化时加载 orion-mf
  useEffect(() => {
    tryLoadOrionMF().then(() => {
      if (!mfLoadSubApp) {
        message.error('无法加载 orion-mf 框架，请检查依赖');
      }
    });
  }, []);

  // 根据环境选择入口
  const isDev = import.meta.env.DEV;
  const getRemoteEntry = (app: typeof TEST_SUBAPPS[0]) =>
    isDev ? app.remoteEntryDev : app.remoteEntryProd;

  // 测试加载子应用
  const handleLoadSubApp = async (appKey: string) => {
    const app = TEST_SUBAPPS.find((a) => a.key === appKey);
    if (!app) return;

    // 检查 orion-mf 是否已加载
    if (!mfLoadSubApp) {
      message.warning('orion-mf 框架未加载，请刷新页面重试');
      return;
    }

    const startTime = Date.now();
    setLoading(appKey);
    setTestResults((prev) => [
      ...prev,
      { appKey, status: 'loading' },
    ]);

    try {
      console.log(`[TestMF] Loading ${appKey} with remoteEntry: ${getRemoteEntry(app)}`);

      const instance = await mfLoadSubApp!({
        key: app.key,
        name: app.name,
        remoteEntry: getRemoteEntry(app),
        // 使用 shadow DOM 隔离
        cssIsolation: 'shadow',
        // 启用错误边界
        errorBoundary: true,
      });

      console.log(`[TestMF] ${appKey} loaded successfully:`, instance);

      // 挂载到容器
      if (containerRef.current) {
        containerRef.current.appendChild(instance.root as HTMLElement);
      }

      const duration = Date.now() - startTime;
      setTestResults((prev) =>
        prev.map((r) =>
          r.appKey === appKey
            ? { ...r, status: 'success', duration }
            : r
        )
      );
      message.success(`${app.name} 加载成功 (${duration}ms)`);
    } catch (error) {
      console.error(`[TestMF] ${appKey} load error:`, error);
      const duration = Date.now() - startTime;
      setTestResults((prev) =>
        prev.map((r) =>
          r.appKey === appKey
            ? {
                ...r,
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
                duration,
              }
            : r
        )
      );
      message.error(`${app.name} 加载失败: ${error}`);
    } finally {
      setLoading(null);
    }
  };

  // 清理容器
  const handleClear = () => {
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    setTestResults([]);
    message.info('已清理容器');
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Title level={2}>
        <RocketOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        Orion-MF 微前端框架测试
      </Title>

      <Paragraph>
        Phase 0: 并行运行验证 - 验证 orion-mf 框架加载子应用的能力
      </Paragraph>

      <Card style={{ marginBottom: 24 }}>
        <Title level={4}>测试说明</Title>
        <Paragraph>
          本页面用于验证 orion-mf 框架能否正常加载子应用。
          当前阶段为 <Text strong>并行运行验证</Text>，wujie 和 orion-mf 共存。
        </Paragraph>
        <Divider />

        <Title level={4}>测试步骤</Title>
        <ol>
          <li>点击下方按钮尝试加载对应子应用</li>
          <li>观察控制台日志和页面结果</li>
          <li>预期：子应用需要先完成 Module Federation 改造才能成功加载</li>
        </ol>

        <Alert type="info" showIcon>
          注意：当前 3 个子应用（dba/knowledge/visor）尚未改造为 Module Federation，
          预计会出现加载失败。这是正常的迁移阶段状态。
        </Alert>
      </Card>

      <Card style={{ marginBottom: 24 }}>
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
                  onClick={() => handleLoadSubApp(app.key)}
                  loading={loading === app.key}
                  disabled={result?.status === 'success'}
                >
                  加载 {app.name}
                </Button>
              );
            })}
            <Button
              icon={<DeleteOutlined />}
              onClick={handleClear}
            >
              清理
            </Button>
          </Space>

          {testResults.length > 0 && (
            <div style={{ marginTop: 16 }}>
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

      <Card>
        <Title level={4}>容器区域</Title>
        <Text type="secondary">
          子应用将渲染到下方容器中（使用 Shadow DOM 隔离）
        </Text>
        <div
          ref={containerRef}
          style={{
            marginTop: 16,
            minHeight: 200,
            border: '1px dashed colors.neutral[300]',
            borderRadius: 8,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.neutral[500],
          }}
        >
          {testResults.length === 0 ? '点击上方按钮加载子应用' : ''}
        </div>
      </Card>
    </div>
  );
};

// 简单的 Alert 组件替代
const Alert: React.FC<{
  type: 'info' | 'warning' | 'error' | 'success';
  showIcon?: boolean;
  children: React.ReactNode;
}> = ({ type, children }) => {
  const alertColors = {
    info: { bg: colors.info[50], border: colors.info[200], text: colors.info[600] },
    warning: { bg: colors.warning[50], border: colors.warning[200], text: colors.warning[600] },
    error: { bg: colors.error[50], border: colors.error[200], text: colors.error[600] },
    success: { bg: colors.success[50], border: colors.success[200], text: colors.success[600] },
  };
  const style = alertColors[type];

  return (
    <div
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 6,
        padding: '12px 16px',
        color: style.text,
        marginTop: 16,
      }}
    >
      {children}
    </div>
  );
};

export default TestMFLoader;