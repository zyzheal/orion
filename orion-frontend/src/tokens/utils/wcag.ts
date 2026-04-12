/**
 * WCAG 2.1 AA 对比度验证工具
 * 确保颜色组合符合无障碍标准
 *
 * WCAG 2.1 AA 要求:
 * - 正常文本：对比度 >= 4.5:1
 * - 大文本 (>= 18pt 或 >= 14pt bold)：对比度 >= 3:1
 */

/**
 * 计算颜色的相对亮度
 * @see https://www.w3.org/TR/WCAG20-TECHS/G17.html#G17-tests
 */
export const getRelativeLuminance = (hex: string): number => {
  const rgb = hexToRgb(hex);
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * 计算两个颜色之间的对比度
 * @see https://www.w3.org/TR/WCAG20-TECHS/G18.html
 */
export const getContrastRatio = (foreground: string, background: string): number => {
  const lum1 = getRelativeLuminance(foreground);
  const lum2 = getRelativeLuminance(background);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * 检查颜色组合是否符合 WCAG 2.1 AA 标准
 */
export const meetsWCAGAA = (
  foreground: string,
  background: string,
  type: 'normal' | 'large' = 'normal'
): boolean => {
  const ratio = getContrastRatio(foreground, background);
  const threshold = type === 'normal' ? 4.5 : 3.0;
  return ratio >= threshold;
};

/**
 * 检查颜色组合是否符合 WCAG 2.1 AAA 标准
 */
export const meetsWCAGAAA = (
  foreground: string,
  background: string,
  type: 'normal' | 'large' = 'normal'
): boolean => {
  const ratio = getContrastRatio(foreground, background);
  const threshold = type === 'normal' ? 7.0 : 4.5;
  return ratio >= threshold;
};

/**
 * Hex 转 RGB
 */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
};

/**
 * 验证所有颜色组合
 */
export const validateColorCombinations = (): Array<{
  foreground: string;
  background: string;
  ratio: number;
  passesAA: boolean;
  passesAAA: boolean;
}> => {
  const results: Array<{
    foreground: string;
    background: string;
    ratio: number;
    passesAA: boolean;
    passesAAA: boolean;
  }> = [];

  // 测试常用颜色组合
  const testCombinations = [
    { fg: '#1f1f1f', bg: '#ffffff' }, // 深色文字 on 浅色背景
    { fg: '#ffffff', bg: '#141414' }, // 浅色文字 on 深色背景
    { fg: '#1890ff', bg: '#ffffff' }, // 主色 on 浅色背景
    { fg: '#1890ff', bg: '#141414' }, // 主色 on 深色背景
    { fg: '#52c41a', bg: '#ffffff' }, // 成功色 on 浅色背景
    { fg: '#faad14', bg: '#ffffff' }, // 警告色 on 浅色背景
    { fg: '#f5222d', bg: '#ffffff' }, // 错误色 on 浅色背景
  ];

  for (const { fg, bg } of testCombinations) {
    const ratio = getContrastRatio(fg, bg);
    results.push({
      foreground: fg,
      background: bg,
      ratio: Math.round(ratio * 100) / 100,
      passesAA: ratio >= 4.5,
      passesAAA: ratio >= 7.0,
    });
  }

  return results;
};

export default {
  getRelativeLuminance,
  getContrastRatio,
  meetsWCAGAA,
  meetsWCAGAAA,
  hexToRgb,
  validateColorCombinations,
};
