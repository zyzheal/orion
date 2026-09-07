/**
 * Shared credential form body (market selector + field rows)
 * 抽取自 index.tsx (P2-9 Phase 137)
 */
import React from 'react';
import { Form, Input, Select, Divider, Alert } from 'antd';
import { MARKET_OPTIONS, MARKET_CREDENTIAL_FIELDS } from '../constants';

const { Password } = Input;

interface CredentialFormFieldsProps {
  selectedMarket: string;
  onMarketChange: (value: string) => void;
  disabledMarket?: boolean;
}

export const CredentialFormFields: React.FC<CredentialFormFieldsProps> = ({
  selectedMarket,
  onMarketChange,
  disabledMarket = false,
}) => (
  <>
    <Form.Item label="应用市场" name="market" initialValue={selectedMarket} rules={[{ required: true }]}>
      <Select
        options={MARKET_OPTIONS}
        onChange={onMarketChange}
        disabled={disabledMarket}
      />
    </Form.Item>

    <Divider orientation="left">凭证信息</Divider>

    {MARKET_CREDENTIAL_FIELDS[selectedMarket]?.map((field) => (
      <Form.Item
        key={field.name}
        label={field.label}
        name={field.name}
        rules={field.required ? [{ required: true, message: `请输入${field.label}` }] : []}
      >
        {field.type === 'password' ? (
          <Password placeholder={field.placeholder} />
        ) : (
          <Input placeholder={field.placeholder} />
        )}
      </Form.Item>
    ))}

    {!MARKET_CREDENTIAL_FIELDS[selectedMarket] && (
      <Alert
        message="暂不支持此市场"
        description="请联系管理员添加此市场的凭证配置模板"
        type="warning"
        showIcon
      />
    )}
  </>
);
