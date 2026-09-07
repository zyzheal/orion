/**
 * DBA Index Advisor page
 *
 * Suggests CREATE INDEX statements by combining signals from the
 * platform's query execution log. Users pick a data source (and
 * optionally pin a table list), then get ranked recommendations with
 * the rationale and evidence for each.
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Input,
  Select,
  message,
  Alert,
} from 'antd';
import {
  ThunderboltOutlined,
  BulbOutlined,
  DatabaseOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import {
  listDataSources,
  suggestIndexes,
  type DataSource,
  type SuggestIndexesResult,
  type IndexSuggestion,
} from '@/api/dba';

const { Title, Text, Paragraph } = Typography;


// impactBorderColor picks a border color for a suggestion Card based
// on its impact score: >=100 is critical (red), >=10 is warning
// (orange), otherwise informational (primary blue).
function impactBorderColor(impact: number): string {
  if (impact >= 100) return colors.error[500] as string;
  if (impact >= 10) return colors.warning[500] as string;
  return colors.primary[500] as string;
}


const DbaAdvisor: React.FC = () => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [dataSourceId, setDataSourceId] = useState<string>('');
  const [tablesText, setTablesText] = useState<string>('');
  const [dbType, setDbType] = useState<string>('postgres');
  const [schema, setSchema] = useState<string>('');

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SuggestIndexesResult | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await listDataSources('default');
        const list = (res.data as DataSource[]) ?? [];
        setDataSources(Array.isArray(list) ? list : []);
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  const runSuggest = async () => {
    if (!dataSourceId) {
      message.warning('请选择数据源');
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const tables = tablesText
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await suggestIndexes({
        data_source_id: dataSourceId,
        db_type: dbType,
        schema: schema || undefined,
        tables: tables.length > 0 ? tables : undefined,
      });
      setResult(res.data as SuggestIndexesResult);
    } catch (err) {
      message.error(`索引建议失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setRunning(false);
    }
  };

  const copySQL = async (sql: string) => {
    try {
      await navigator.clipboard.writeText(sql);
      message.success('SQL 已复制');
    } catch {
      message.error('复制失败');
    }
  };

  const suggestions = (result?.suggestions ?? []) as IndexSuggestion[];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <BulbOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
          索引建议 Agent
        </Title>
        <Text type="secondary">
          基于慢查询 + Schema 现有索引，生成 CREATE INDEX 语句
        </Text>
      </div>

      <Card size="small" style={{ marginBottom: spacing.md }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Space wrap size={12}>
            <Select
              style={{ width: 260 }}
              placeholder="选择数据源"
              value={dataSourceId || undefined}
              onChange={setDataSourceId}
              options={dataSources.map((ds) => ({
                label: `${ds.name} (${ds.host}:${ds.port})`,
                value: ds.id,
              }))}
              allowClear
            />
            <Select
              style={{ width: 140 }}
              value={dbType}
              onChange={setDbType}
              options={[
                { label: 'PostgreSQL', value: 'postgres' },
                { label: 'MySQL', value: 'mysql' },
              ]}
            />
            <Input
              style={{ width: 160 }}
              placeholder="Schema (可选)"
              value={schema}
              onChange={(e) => setSchema(e.target.value)}
              allowClear
            />
          </Space>
          <Space wrap size={12}>
            <Text>目标表:</Text>
            <Input
              style={{ width: 380 }}
              placeholder="留空则从慢查询自动推断，如: orders,users,orders"
              value={tablesText}
              onChange={(e) => setTablesText(e.target.value)}
              allowClear
            />
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={running}
              onClick={runSuggest}
              disabled={!dataSourceId}
            >
              生成索引建议
            </Button>
          </Space>
        </Space>
      </Card>

      {result && (
        <>
          <Card
            size="small"
            title={
              <Space>
                <DatabaseOutlined />
                <Text>{suggestions.length} 条建议</Text>
                <Text type="secondary">总影响分数: {suggestions.reduce((a, b) => a + (b.impact || 0), 0).toFixed(1)}</Text>
              </Space>
            }
          >
            {suggestions.length === 0 ? (
              <Card style={{ background: '#fafafa' }}>
                <Text type="secondary">
                  未发现明显的索引缺失。可能原因：
                </Text>
                <ul style={{ paddingLeft: 20, marginTop: 4 }}>
                  <li>数据源下暂无慢查询记录</li>
                  <li>现有索引已覆盖慢查询的过滤列</li>
                  <li>指定表在慢查询中未出现</li>
                </ul>
              </Card>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                {suggestions.map((s, i) => (
                  <Card
                    key={i}
                    size="small"
                    style={{ borderLeft: `3px solid ${impactBorderColor(s.impact)}` }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <Space size={6} wrap>
                        <Tag color="blue">{s.table}</Tag>
                        <Tag color="geekblue">{s.kind}</Tag>
                        <Tag color={s.db_type === 'mysql' ? 'green' : 'purple'}>{s.db_type}</Tag>
                      </Space>
                      <Tag color={s.impact >= 100 ? 'red' : s.impact >= 10 ? 'orange' : 'blue'}>
                        影响 {s.impact.toFixed(1)}
                      </Tag>
                    </div>
                    <Text strong style={{ display: 'block', marginTop: 6 }}>
                      列: {s.columns.join(', ')}
                    </Text>
                    <Paragraph style={{ margin: '4px 0', fontSize: 12 }} type="secondary">
                      {s.reason}
                    </Paragraph>
                    <div
                      style={{
                        background: '#1e1e1e',
                        color: '#d4d4d4',
                        padding: 8,
                        borderRadius: 4,
                        fontFamily: 'monospace',
                        fontSize: 12,
                        overflow: 'auto',
                        maxHeight: 80,
                        position: 'relative',
                      }}
                    >
                      <Button
                        size="small"
                        type="text"
                        icon={<CopyOutlined />}
                        onClick={() => copySQL(s.sql)}
                        style={{ color: '#d4d4d4', position: 'absolute', top: 4, right: 4 }}
                      />
                      {s.sql}
                    </div>
                    {s.evidence.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          证据 ({s.evidence.length}):
                        </Text>
                        <ul style={{ paddingLeft: 20, marginTop: 2 }}>
                          {s.evidence.slice(0, 3).map((e, j) => (
                            <li key={j} style={{ fontSize: 11, color: colors.neutral[500] as string }}>
                              <code>{e}</code>
                            </li>
                          ))}
                          {s.evidence.length > 3 && (
                            <li style={{ fontSize: 11, color: colors.neutral[500] as string }}>
                              ... 及 {s.evidence.length - 3} 条
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </Card>
                ))}
              </Space>
            )}
          </Card>

          <Alert
            type="info"
            showIcon
            message="使用方式"
            description="点击复制图标将 CREATE INDEX 语句复制到剪贴板，然后交给 DBA 审核并执行。建议先在生产环境以外验证。"
            style={{ marginTop: spacing.md }}
          />
        </>
      )}
    </div>
  );
};

export default DbaAdvisor;
