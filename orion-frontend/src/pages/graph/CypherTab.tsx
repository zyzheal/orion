/**
 * Cypher Query Tab
 * Form for entering a Cypher query, error alert on failure, and an
 * Ant Table rendering the query result rows.
 */
import React from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Space,
  Tag,
  Table as AntTable,
  Typography,
} from 'antd';
import { CodeOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { CYPHER_PLACEHOLDER } from './config';

const { Paragraph, Text } = Typography;

export interface CypherTabProps {
  form: import('antd').FormInstance;
  queryLoading: boolean;
  queryError: string | null;
  queryResult: {
    columns: string[];
    rows: Record<string, unknown>[];
  } | null;
  onExecuteQuery: () => void;
}

const CypherTab: React.FC<CypherTabProps> = ({
  form: queryForm,
  queryLoading,
  queryError,
  queryResult,
  onExecuteQuery,
}) => {
  return (
    <div>
      {/* Query Form */}
      <Card title="Cypher 查询" size="small" style={{ marginBottom: spacing.md }}>
        <Form form={queryForm} layout="vertical">
          <Form.Item
            name="cypherQuery"
            rules={[{ required: true, message: '请输入 Cypher 查询语句' }]}
          >
            <Input.TextArea
              rows={6}
              placeholder={CYPHER_PLACEHOLDER}
              style={cypherInputStyle}
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={onExecuteQuery}
              loading={queryLoading}
            >
              执行查询
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Error Display */}
      {queryError && (
        <Alert
          message="查询错误"
          description={queryError}
          type="error"
          showIcon
          style={{ marginBottom: spacing.md }}
        />
      )}

      {/* Query Results */}
      {queryResult && (
        <Card
          title={
            <Space>
              <CodeOutlined />
              <Text>查询结果</Text>
              <Tag color="blue">{queryResult.rows.length} 行</Tag>
            </Space>
          }
          size="small"
        >
          {queryResult.rows.length === 0 ? (
            <Text type="secondary">查询成功，但无返回数据</Text>
          ) : (
            <AntTable
              dataSource={queryResult.rows}
              rowKey={(_, index) => String(index)}
              size="small"
              scroll={{ x: true }}
              columns={queryResult.columns.map((col) => ({
                title: col,
                dataIndex: col,
                key: col,
                ellipsis: true,
                render: (v: unknown) => {
                  if (v === null || v === undefined) {
                    return <Text type="secondary">null</Text>;
                  }
                  if (typeof v === 'object') {
                    return <Text code>{JSON.stringify(v)}</Text>;
                  }
                  return <Text>{String(v)}</Text>;
                },
              }))}
            />
          )}
        </Card>
      )}

      {!queryResult && !queryError && (
        <Card style={{ textAlign: 'center', padding: 60 }}>
          <CodeOutlined style={largeNeutralIconStyle} />
          <Paragraph type="secondary" style={{ marginTop: spacing.md }}>
            输入 Cypher 查询语句并执行
          </Paragraph>
          <Text type="secondary" style={{ fontSize: 12 }}>
            示例: MATCH (n) RETURN n LIMIT 10
          </Text>
        </Card>
      )}
    </div>
  );
};

const cypherInputStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 13,
};
const largeNeutralIconStyle: React.CSSProperties = {
  fontSize: 48,
  color: colors.neutral[300],
};

export default CypherTab;
