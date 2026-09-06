/**
 * TaskOutputsTable — 任务输出变量表
 *
 * 后端 API 尚未就绪 (/v1/pipeline-runs/:runId/outputs)，当前展示空态。
 */
import React from 'react';
import { Empty, Typography } from 'antd';
import { spacing } from '@/tokens';

const { Text } = Typography;

export const TaskOutputsTable: React.FC = () => (
  <Empty
    description={
      <div>
        <Text type="secondary">任务输出 API 开发中</Text>
        <Text
          type="secondary"
          style={{ display: 'block', fontSize: spacing[2], marginTop: 4 }}
        >
          需要后端提供 /v1/pipeline-runs/:runId/outputs 接口后自动展示变量传播数据
        </Text>
      </div>
    }
  />
);
