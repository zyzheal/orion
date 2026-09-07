/**
 * FormDesigner condition localStorage persistence
 * 抽取自 index.tsx (P2-9 Phase 161)
 *
 * Forms: real API via '@/api/lowcode' (Go backend online).
 * Conditions: localStorage-backed (Go backend pending).
 */
import { COND_KEY } from './constants';
import type { ConditionRule } from './types';

const loadCond = (): ConditionRule[] => {
  try {
    return JSON.parse(localStorage.getItem(COND_KEY) || '[]') as ConditionRule[];
  } catch {
    return [];
  }
};

const saveCond = (items: ConditionRule[]) => {
  localStorage.setItem(COND_KEY, JSON.stringify(items));
};

export const listConditions = () => Promise.resolve(loadCond());

export const createCondition = (r: Partial<ConditionRule>) => {
  const items = loadCond();
  items.push({ id: Date.now().toString(), ...r } as ConditionRule);
  saveCond(items);
  return Promise.resolve();
};

export const updateCondition = (id: string, r: Partial<ConditionRule>) => {
  const items = loadCond().map((x) => (x.id === id ? { ...x, ...r } : x));
  saveCond(items);
  return Promise.resolve();
};

export const deleteCondition = (id: string) => {
  saveCond(loadCond().filter((x) => x.id !== id));
  return Promise.resolve();
};
