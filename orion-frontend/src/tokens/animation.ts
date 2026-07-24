/**
 * Orion Design Tokens - 动画系统
 * 定义过渡、动画关键帧和时长
 */

export const animation = {
  // ============ 过渡时长 ============
  duration: {
    instant: 0,
    fastest: 100,
    faster: 150,
    fast: 200,
    normal: 300,
    slow: 400,
    slower: 500,
    slowest: 1000,
  },

  // ============ 缓动函数 ============
  easing: {
    linear: 'linear',
    ease: 'ease',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
    smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', // 弹簧回弹效果
  },

  // ============ 过渡属性 ============
  transition: {
    all: 'all',
    colors: 'color, background-color, border-color, fill, stroke',
    opacity: 'opacity',
    shadow: 'box-shadow',
    transform: 'transform',
    height: 'height',
  },

  // ============ 动画关键帧 ============
  keyframes: {
    fadeIn: {
      '0%': { opacity: 0 },
      '100%': { opacity: 1 },
    },
    fadeOut: {
      '0%': { opacity: 1 },
      '100%': { opacity: 0 },
    },
    slideInUp: {
      '0%': { transform: 'translateY(100%)' },
      '100%': { transform: 'translateY(0)' },
    },
    slideInDown: {
      '0%': { transform: 'translateY(-100%)' },
      '100%': { transform: 'translateY(0)' },
    },
    slideInLeft: {
      '0%': { transform: 'translateX(-100%)' },
      '100%': { transform: 'translateX(0)' },
    },
    slideInRight: {
      '0%': { transform: 'translateX(100%)' },
      '100%': { transform: 'translateX(0)' },
    },
    scaleIn: {
      '0%': { transform: 'scale(0)' },
      '100%': { transform: 'scale(1)' },
    },
    rotate: {
      '0%': { transform: 'rotate(0deg)' },
      '100%': { transform: 'rotate(360deg)' },
    },
    pulse: {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.5 },
    },
    spin: {
      '0%': { transform: 'rotate(0deg)' },
      '100%': { transform: 'rotate(360deg)' },
    },
  },

  // ============ 预设动画 ============
  presets: {
    fadeIn: 'fadeIn 0.3s ease',
    fadeOut: 'fadeOut 0.3s ease',
    slideInUp: 'slideInUp 0.3s ease',
    slideInDown: 'slideInDown 0.3s ease',
    scaleIn: 'scaleIn 0.2s ease',
    pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    spin: 'spin 1s linear infinite',
  },
} as const;

/**
 * 组件动画配置
 */
export const componentAnimation = {
  // 按钮
  button: {
    hover: {
      transition: 'all 0.2s ease',
      transform: 'translateY(-1px)',
    },
    active: {
      transition: 'all 0.1s ease',
      transform: 'translateY(0)',
    },
  },

  // 卡片
  card: {
    hover: {
      transition: 'box-shadow 0.3s ease, transform 0.3s ease',
      transform: 'translateY(-2px)',
    },
  },

  // 下拉菜单
  dropdown: {
    enter: 'slideInDown 0.2s ease',
    exit: 'fadeOut 0.15s ease',
  },

  // 弹窗
  modal: {
    enter: 'fadeIn 0.3s ease',
    exit: 'fadeOut 0.2s ease',
  },

  // 消息提示
  toast: {
    enter: 'slideInDown 0.3s ease',
    exit: 'slideInUp 0.2s ease',
  },
} as const;

export default animation;
