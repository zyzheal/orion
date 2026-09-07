/**
 * ApkCredentials constants
 * 抽取自 index.tsx (P2-9 Phase 137)
 */
import type { MarketOption, CredentialField } from './types';

export const MARKET_OPTIONS: MarketOption[] = [
  { label: '华为 AppGallery', value: 'huawei', icon: '📱' },
  { label: '小米应用商店', value: 'xiaomi', icon: '📱' },
  { label: 'OPPO 软件商店', value: 'oppo', icon: '📱' },
  { label: 'VIVO 应用商店', value: 'vivo', icon: '📱' },
  { label: '荣耀应用市场', value: 'honor', icon: '📱' },
  { label: '腾讯应用宝', value: 'tencent', icon: '📱' },
  { label: 'Google Play', value: 'googleplay', icon: '🌐' },
  { label: '三星 Galaxy Store', value: 'samsung', icon: '📱' },
  { label: '蒲公英', value: 'pgyer', icon: '🌿' },
  { label: 'fir.im', value: 'fir', icon: '📦' },
];

export const MARKET_CREDENTIAL_FIELDS: Record<string, CredentialField[]> = {
  huawei: [
    { name: 'clientId', label: 'Client ID', placeholder: 'Enter Huawei client ID', required: true },
    {
      name: 'clientSecret',
      label: 'Client Secret',
      placeholder: 'Enter Huawei client secret',
      required: true,
      type: 'password',
    },
    { name: 'appId', label: 'App ID', placeholder: 'Enter app ID (optional)', required: false },
  ],
  xiaomi: [
    {
      name: 'email',
      label: 'Developer Email',
      placeholder: 'Enter Xiaomi developer email',
      required: true,
    },
    {
      name: 'privateKey',
      label: 'RSA Private Key',
      placeholder: 'Enter RSA private key',
      required: true,
      type: 'password',
    },
    {
      name: 'cert',
      label: 'Certificate',
      placeholder: 'Enter certificate path (optional)',
      required: false,
    },
  ],
  oppo: [
    { name: 'clientId', label: 'Client ID', placeholder: 'Enter OPPO client ID', required: true },
    {
      name: 'clientSecret',
      label: 'Client Secret',
      placeholder: 'Enter OPPO client secret',
      required: true,
      type: 'password',
    },
  ],
  vivo: [
    {
      name: 'accessKey',
      label: 'Access Key',
      placeholder: 'Enter VIVO access key',
      required: true,
    },
    {
      name: 'accessSecret',
      label: 'Access Secret',
      placeholder: 'Enter VIVO access secret',
      required: true,
      type: 'password',
    },
  ],
  honor: [
    { name: 'clientId', label: 'Client ID', placeholder: 'Enter Honor client ID', required: true },
    {
      name: 'clientSecret',
      label: 'Client Secret',
      placeholder: 'Enter Honor client secret',
      required: true,
      type: 'password',
    },
    { name: 'appId', label: 'App ID', placeholder: 'Enter app ID (optional)', required: false },
  ],
  tencent: [
    { name: 'userId', label: 'User ID', placeholder: 'Enter Tencent user ID', required: true },
    {
      name: 'accessSecret',
      label: 'Access Secret',
      placeholder: 'Enter access secret',
      required: true,
      type: 'password',
    },
    { name: 'appId', label: 'App ID', placeholder: 'Enter app ID', required: true },
  ],
  googleplay: [
    {
      name: 'jsonKeyFile',
      label: 'Service Account JSON',
      placeholder: 'Paste service account JSON content',
      required: true,
      type: 'password',
    },
    {
      name: 'packageName',
      label: 'Package Name',
      placeholder: 'Enter package name',
      required: true,
    },
    {
      name: 'track',
      label: 'Track',
      placeholder: 'e.g., internal, beta, production',
      required: false,
    },
  ],
  samsung: [
    {
      name: 'serviceAccountId',
      label: 'Service Account ID',
      placeholder: 'Enter service account ID',
      required: true,
    },
    {
      name: 'privateKey',
      label: 'Private Key',
      placeholder: 'Enter RSA private key',
      required: true,
      type: 'password',
    },
    { name: 'contentId', label: 'Content ID', placeholder: 'Enter content ID', required: true },
  ],
  pgyer: [
    {
      name: 'apiKey',
      label: 'API Key',
      placeholder: 'Enter Pgyer API key',
      required: true,
      type: 'password',
    },
  ],
  fir: [
    {
      name: 'apiToken',
      label: 'API Token',
      placeholder: 'Enter fir.im API token',
      required: true,
      type: 'password',
    },
  ],
};

export const getMarketName = (value: string): string => {
  const market = MARKET_OPTIONS.find((m) => m.value === value);
  return market ? `${market.icon} ${market.label}` : value;
};

export const getSecretName = (market: string): string => `apk-${market}-credentials`;
