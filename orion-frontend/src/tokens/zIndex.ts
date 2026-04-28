/**
 * Orion Design Tokens - Z-Index 层级系统
 * 管理界面元素的堆叠顺序，避免层级冲突
 */

export const zIndex = {
  // ============ 基础层级 ============
  hidden: -1,
  auto: 'auto',
  base: 0,

  // ============ 组件层级 (0-1000) ============
  dropdown: 1000, // 下拉菜单
  sticky: 1020, // 吸顶元素
  fixed: 1030, // 固定定位
  backdrop: 1040, // 遮罩层
  modal: 1050, // 弹窗
  popover: 1060, // 弹出框
  tooltip: 1070, // 提示
  toast: 1080, // 消息提示
  notification: 1090, // 通知

  // ============ 特殊层级 ============
  max: 9999,
  min: -9999,
} as const;

/**
 * 层级分组说明
 *
 * 0-100:    内容层（普通内容）
 * 100-500:  装饰层（边框、分隔线等）
 * 500-1000: 交互层（按钮、卡片悬浮等）
 * 1000-2000: 浮层（下拉、弹窗、遮罩等）
 * 2000+:    系统层（第三方组件、特殊需求）
 */
export const zIndexLayers = {
  content: { min: 0, max: 100 },
  decoration: { min: 100, max: 500 },
  interaction: { min: 500, max: 1000 },
  overlay: { min: 1000, max: 2000 },
  system: { min: 2000, max: 9999 },
} as const;

export default zIndex;
