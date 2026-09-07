/**
 * PasswordPolicy state hook
 * 抽取自 index.tsx (P2-9 Phase 144)
 */
import { useEffect, useMemo, useState } from 'react';
import { Form } from 'antd';
import { colors } from '@/tokens';
import { calculatePasswordStrength, containsDictionaryWord, hasConsecutiveChars } from './helpers';

export const usePasswordPolicyState = () => {
  const [form] = Form.useForm();
  const [testPassword, setTestPassword] = useState('');
  const [strength, setStrength] = useState<{ score: number; label: string; color: string }>({
    score: 0,
    label: '弱',
    color: colors.error[500],
  });

  useEffect(() => {
    if (!testPassword) {
      setStrength({ score: 0, label: '弱', color: colors.error[500] });
    } else {
      setStrength(calculatePasswordStrength(testPassword));
    }
  }, [testPassword]);

  const checkItems: Array<{ label: string; pass: boolean }> = useMemo(() => {
    const minLength = (form.getFieldValue('minLength') as number) || 8;
    return [
      {
        label: `长度 >= ${minLength} 字符`,
        pass: testPassword.length >= minLength,
      },
      {
        label: '包含大写字母',
        pass: /[A-Z]/.test(testPassword),
      },
      {
        label: '包含小写字母',
        pass: /[a-z]/.test(testPassword),
      },
      {
        label: '包含数字',
        pass: /[0-9]/.test(testPassword),
      },
      {
        label: '包含特殊字符',
        pass: /[^A-Za-z0-9]/.test(testPassword),
      },
      {
        label: '无连续重复字符（如 "aaa"）',
        pass: !hasConsecutiveChars(testPassword),
      },
      {
        label: '非常见字典单词',
        pass: !containsDictionaryWord(testPassword),
      },
    ];
  }, [form, testPassword]);

  return {
    form,
    testPassword,
    setTestPassword,
    strength,
    checkItems,
  };
};

export type PasswordPolicyState = ReturnType<typeof usePasswordPolicyState>;
