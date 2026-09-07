/**
 * Login BrandPanel (left side)
 * 抽取自 index.tsx (P2-9 Phase 179)
 */
import React from 'react';
import { Typography } from 'antd';
import { colors, spacing } from '@/tokens';
import { useIntl } from '@/i18n';
import { featureIcons, featureKeys } from '../constants';
import { DecorativeCircles } from './DecorativeCircles';

const { Title, Text } = Typography;

export const BrandPanel: React.FC = () => {
  const { t } = useIntl();

  return (
    <div
      style={{
        flex: '0 0 480px',
        background: `linear-gradient(160deg, ${colors.primary[700]} 0%, ${colors.primary[900]} 40%, ${colors.primary[900]} 100%)`,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 40px',
      }}
    >
      <DecorativeCircles />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3] }}>
          <img src="/logo.svg" alt="Orion" style={{ width: 40, height: 40 }} />
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: colors.neutral[0],
              letterSpacing: '0.5px',
            }}
          >
            {t('login.title')}
          </span>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <Title
          level={1}
          style={{
            color: colors.neutral[0],
            fontSize: 36,
            fontWeight: 700,
            lineHeight: 1.3,
            marginBottom: spacing.md,
            letterSpacing: '-0.5px',
          }}
        >
          {t('login.tagline1')}
          <br />
          {t('login.tagline2')}
        </Title>
        <Text
          style={{
            color: 'rgba(255,255,255,0.65)',
            fontSize: 15,
            lineHeight: 1.8,
            display: 'block',
            marginBottom: 40,
          }}
        >
          Orion 不替代现有工具链，而是通过 AI 能力
          <br />让 Tekton、Knative、Prometheus 和 K8s 协同工作
        </Text>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {featureIcons.map((Icon, i) => (
            <FeatureItem
              key={String(i)}
              icon={<Icon />}
              title={t(featureKeys[i][0])}
              desc={t(featureKeys[i][1])}
            />
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
          Orion Platform ©{new Date().getFullYear()} · AI-Driven DevOps
        </Text>
      </div>
    </div>
  );
};

const FeatureItem = ({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) => (
  <div
    style={FEATURE_CARD_STYLE}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
      (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)';
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
      (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
    }}
  >
    <div style={FEATURE_ICON_STYLE}>{icon}</div>
    <div>
      <div style={FEATURE_TITLE_STYLE}>{title}</div>
      <div style={FEATURE_DESC_STYLE}>{desc}</div>
    </div>
  </div>
);

const FEATURE_CARD_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '14px 18px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.08)',
  transition: 'all 0.3s',
};

const FEATURE_ICON_STYLE: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 10,
  background: 'rgba(255,255,255,0.1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 18,
  color: colors.primary[300],
  flexShrink: 0,
};

const FEATURE_TITLE_STYLE: React.CSSProperties = {
  color: colors.neutral[0],
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 2,
};

const FEATURE_DESC_STYLE: React.CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  fontSize: 12,
  lineHeight: 1.5,
};

