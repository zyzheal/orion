/**
 * TestSelector constants
 * 抽取自 index.tsx (P2-9 Phase 173)
 */
import React from 'react';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import type { TestCase } from './types';

export const STATUS_OPTIONS = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Passed', value: 'passed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Skipped', value: 'skipped' },
  { label: 'Pending', value: 'pending' },
];

export const SUITE_OPTIONS: { label: string; value: string }[] = [];
export const TAG_OPTIONS: { label: string; value: string }[] = [];

export function getStatusColor(status: TestCase['status']): string {
  switch (status) {
    case 'passed':
      return colors.success[500];
    case 'failed':
      return colors.error[500];
    case 'skipped':
      return colors.neutral[400];
    case 'pending':
      return colors.warning[500];
  }
}

export function getStatusLabel(status: TestCase['status']): string {
  switch (status) {
    case 'passed':
      return 'Passed';
    case 'failed':
      return 'Failed';
    case 'skipped':
      return 'Skipped';
    case 'pending':
      return 'Pending';
  }
}

export function getStatusIcon(status: TestCase['status']): React.ReactNode {
  switch (status) {
    case 'passed':
      return <CheckCircleOutlined />;
    case 'failed':
      return <CloseCircleOutlined />;
    case 'skipped':
      return <MinusCircleOutlined />;
    case 'pending':
      return <AppstoreOutlined />;
  }
}
