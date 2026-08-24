/**
 * useSubmit — 统一异步提交钩子
 *
 * 参考 Google/AWS/Microsoft 最佳实践：
 * - 防重复点击（debounce + 自动 submitting 管理）
 * - 统一 error 处理（错误类型安全）
 * - 可选成功回调 + loading 回传
 * - 一次封装解决 18+ 页 confirmLoading 缺失问题
 *
 * @example
 *   const submit = useSubmit(async (values) => {
 *     await updateBudgetGuard(id, values);
 *   });
 *   // Modal 中: onOk={submit} confirmLoading={submit.submitting}
 *   // 按钮中: onClick={submit.execute(formData)} loading={submit.submitting}
 */
import { useCallback, useState } from 'react';
import { message } from 'antd';

export interface SubmitState<TError = unknown> {
  submitting: boolean;
  error: TError | null;
  clearError: () => void;
}

export interface UseSubmitOptions {
  /** 防重复点击间隔(ms)，默认 300ms */
  debounceMs?: number;
  /** 成功提示 */
  successMessage?: string | false;
  /** 失败提示 */
  errorMessage?: string | ((error: unknown) => string);
  /** 提交前回调（return false 阻止提交） */
  beforeSubmit?: () => boolean | Promise<boolean>;
  /** 提交后回调（无论成功失败） */
  afterSubmit?: () => void;
}

type AsyncFn<TArgs extends unknown[] = []> = (...args: TArgs) => Promise<void> | void;

export function useSubmit<TArgs extends unknown[] = [], TError = unknown>(
  asyncFn: AsyncFn<TArgs>,
  options: UseSubmitOptions = {},
) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<TError | null>(null);
  const {
    debounceMs = 300,
    successMessage,
    errorMessage,
    beforeSubmit,
    afterSubmit,
  } = options;
  const [lock, setLock] = useState(false);

  const clearError = useCallback(() => setError(null), []);

  const execute = useCallback(
    async (...args: TArgs) => {
      // 防重复点击
      if (submitting || lock) return;

      // 前置校验
      if (beforeSubmit) {
        const canProceed = await beforeSubmit();
        if (!canProceed) return;
      }

      setLock(true);
      setSubmitting(true);
      setError(null);

      try {
        await asyncFn(...args);
        if (successMessage === false) {
          // 静默成功
        } else if (successMessage) {
          message.success(successMessage);
        }
      } catch (err) {
        const typedErr = err as TError;
        setError(typedErr);

        // 跳过表单校验错误（Ant Design Form）
        if (hasErrorFields(typedErr)) return;

        const msg =
          typeof errorMessage === 'function'
            ? errorMessage(err)
            : errorMessage ?? '操作失败，请重试';
        message.error(msg);
      } finally {
        setSubmitting(false);
        setTimeout(() => setLock(false), debounceMs);
        afterSubmit?.();
      }
    },
    [asyncFn, debounceMs, successMessage, errorMessage, beforeSubmit, afterSubmit, submitting],
  );

  return {
    execute,
    submitting,
    error,
    clearError,
  } as SubmitState<TError> & { execute: (...args: TArgs) => Promise<void> };
}

function hasErrorFields(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'errorFields' in error &&
    Array.isArray((error as { errorFields?: unknown[] }).errorFields) &&
    (error as { errorFields: unknown[] }).errorFields.length > 0
  );
}

export default useSubmit;
