/**
 * WorkflowCanvas — 错误处理配置表单
 *
 * 从 WorkflowCanvas.tsx 抽离的 renderErrorHandlingForm。
 * 依赖 Form.useWatch 提供的 errorHandling.onFailure 值，
 * 通过参数注入以避免破坏 hook 依赖链。
 */
import React from 'react';
import { Form, Input, Select } from 'antd';
import {
  errorHandlingStrategyOptions,
  retryCountOptions,
} from './WorkflowCanvasConfig';

interface Props {
  editable: boolean;
  onFailure?: 'skip' | 'retry' | 'abort';
}

export const renderErrorHandlingForm = ({ editable, onFailure }: Props): React.ReactNode => {
  if (!editable) return null;
  return (
    <>
      <Form.Item label="失败策略" name={['errorHandling', 'onFailure']}>
        <Select options={errorHandlingStrategyOptions} />
      </Form.Item>
      {onFailure === 'retry' && (
        <Form.Item
          label="重试次数"
          name={['errorHandling', 'retryCount']}
          rules={[
            {
              validator: (_, val) =>
                Promise.resolve(
                  val >= 1 && val <= 3 ? undefined : Promise.reject(new Error('1-3 次')),
                ),
            },
          ]}
        >
          <Select options={retryCountOptions} />
        </Form.Item>
      )}
      {onFailure === 'retry' && (
        <Form.Item
          label="重试间隔(秒)"
          name={['errorHandling', 'retryInterval']}
          rules={[
            {
              validator: (_, val) =>
                Promise.resolve(
                  val > 0 ? undefined : Promise.reject(new Error('必须为正整数')),
                ),
            },
          ]}
        >
          <Input type="number" />
        </Form.Item>
      )}
    </>
  );
};
