/**
 * 验证邮箱格式
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * 验证手机号格式（中国大陆）
 */
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
};

/**
 * 验证 URL 格式
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * 验证身份证号码（中国大陆）
 */
export const isValidIdCard = (idCard: string): boolean => {
  const idCardRegex = /^\d{17}[\dXx]$/;
  if (!idCardRegex.test(idCard)) {
    return false;
  }

  // 简化版，实际生产环境需要完整的校验码验证
  return true;
};

/**
 * 验证密码强度
 * 要求：至少 8 位，包含字母和数字
 */
export const isStrongPassword = (password: string): boolean => {
  if (password.length < 8) {
    return false;
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  return hasLetter && hasNumber;
};

/**
 * 验证用户名
 * 要求：4-20 位，只能包含字母、数字、下划线
 */
export const isValidUsername = (username: string): boolean => {
  const usernameRegex = /^[a-zA-Z0-9_]{4,20}$/;
  return usernameRegex.test(username);
};

/**
 * 验证是否为空
 */
export const isNotEmpty = (value: unknown): boolean => {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value).length > 0;
  }
  return value !== null && value !== undefined;
};

/**
 * 验证字符串长度
 */
export const isValidLength = (str: string, min: number, max: number): boolean => {
  const length = str.trim().length;
  return length >= min && length <= max;
};
