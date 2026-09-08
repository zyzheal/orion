/**
 * constants.ts - ScriptRunner 常量定义
 * 抽取自 index.tsx (P2-9 Phase 230)
 */
import type { ScriptLanguage, ScriptLevel } from '@/api/scripts';

export const languageOptions: { label: string; value: ScriptLanguage }[] = [
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'Python', value: 'python' },
  { label: 'Shell', value: 'shell' },
];

export const levelOptions: { label: string; value: ScriptLevel }[] = [
  { label: '安全 (safe)', value: 'safe' },
  { label: '标准 (standard)', value: 'standard' },
  { label: '高级 (advanced)', value: 'advanced' },
];
