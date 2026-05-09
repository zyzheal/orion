/**
 * Orion Design Tokens
 * 统一的设计令牌系统，确保产品设计一致性
 *
 * @packageDocumentation
 */

export { colors, colorCSSVariables, semanticColors } from './colors';
export { spacing, spacingRem, componentSpacing, spacingCSSVariables } from './spacing';
export { radius, componentRadius, radiusCSSVariables } from './radius';
export { shadows, shadowOpacity, shadowsCSSVariables } from './shadows';
export { typography, textStyles, typographyCSSVariables } from './typography';
export { zIndex, zIndexLayers } from './zIndex';
export { animation, componentAnimation } from './animation';
export { breakpoints, mediaQueries } from './breakpoints';

// 默认导出所有 tokens
import { colors } from './colors';
import { spacing } from './spacing';
import { radius } from './radius';
import { shadows } from './shadows';
import { typography } from './typography';
import { zIndex } from './zIndex';
import { animation } from './animation';
import { breakpoints } from './breakpoints';

export const designTokens = {
  colors,
  spacing,
  radius,
  shadows,
  typography,
  zIndex,
  animation,
  breakpoints,
};

export default designTokens;
