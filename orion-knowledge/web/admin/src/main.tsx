import '@/assets/fonts/font.css';
import '@/assets/styles/index.css';
import '@/assets/styles/markdown.css';
import React, { createContext } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { wrapWindowOpen } from './utils/getBasename';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import App from './App';
import store from './store';

// Window 类型已在 getBasename.ts 中统一声明

// ============================================
// Orion 全局状态接口
// ============================================
export interface OrionGlobalState {
  user?: {
    id: number;
    username: string;
    email: string;
    avatar?: string;
    department?: string;
  };
  permissions?: string[];
  token?: string;
  apiBase?: string;
  basename?: string;
  navigateTo?: (path: string) => void;
  showMessage?: (type: 'success' | 'error', message: string) => void;
}

export const OrionContext = createContext<OrionGlobalState>({});

// ============================================
// 渲染应用
// ============================================
function render(props: any = {}) {
  const { container, basename } = props;

  console.log(`[orion-knowledge] render called, container type:`, container?.constructor?.name || 'null');
  console.log(`[orion-knowledge] render basename:`, basename);

  const containerEl = container
    ? container.querySelector('#root')
    : document.querySelector('#root');

  if (!containerEl) {
    console.error('[orion-knowledge] No #root element found!');
    return null;
  }

  console.log(`[orion-knowledge] Found #root element:`, containerEl);

  // 复用已存在的 React root
  let existingRoot: Root | null = null;
  try {
    existingRoot = (containerEl as any).__reactRoot || null;
  } catch { /* ignore */ }

  let root: Root;
  if (existingRoot) {
    console.log('[orion-knowledge] Reusing existing React root');
    root = existingRoot;
    // 微前端模式下复用 root 时，检查是否已挂载过，避免重复渲染
    if ((window as any).__POWERED_BY_ORION__ && (containerEl as any).__orionRendered) {
      console.log('[orion-knowledge] Already rendered in this container, skipping re-render');
      return root;
    }
    (containerEl as any).__orionRendered = true;
  } else {
    console.log('[orion-knowledge] Creating new React root');
    root = createRoot(containerEl);
    (containerEl as any).__reactRoot = root;
  }

  root.render(
    <React.StrictMode>
      <Provider store={store}>
        <BrowserRouter basename={basename || window.__BASENAME__ || '/'}>
          <OrionContext.Provider value={props}>
            <App />
          </OrionContext.Provider>
        </BrowserRouter>
      </Provider>
    </React.StrictMode>
  );

  console.log('[orion-knowledge] BrowserRouter basename:', basename || window.__BASENAME__ || '/');

  console.log('[orion-knowledge] React render completed');

  return root;
}

// ============================================
// 独立运行模式（延迟检查，给微前端 mount 调用留出时间）
// ============================================
let knowledgeRoot: Root | null = null;
let autoRenderTimer: ReturnType<typeof setTimeout> | null = null;

function tryAutoRender() {
  // 同时检查 wujie 和 Orion-MF 的标志位，避免在微前端模式下自动渲染
  if (!(window as any).__POWERED_BY_WUJIE__ && !(window as any).__POWERED_BY_ORION__) {
    // 动态加载 CSS 文件
    const loadCSS = (href: string) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    };

    loadCSS(`${window.__BASENAME__ || ''}/orion-knowledge.css`);

    wrapWindowOpen(window.__BASENAME__ || '');
    dayjs.extend(duration);
    dayjs.extend(relativeTime);
    dayjs.locale('zh-cn');

    knowledgeRoot = render();
    console.log('[orion-knowledge] Running in standalone mode');
  }
}

// 使用 setTimeout 延迟检查，给 MF mount 调用留出时间
autoRenderTimer = setTimeout(tryAutoRender, 100);

// ============================================
// wujie 生命周期
// wujie 通过 window.$wujie.props 传递 props（非 mount 参数）
// ============================================

async function doBootstrap() {
  console.log('[orion-knowledge] bootstrap');
  dayjs.extend(duration);
  dayjs.extend(relativeTime);
  dayjs.locale('zh-cn');
}

function getWujieProps(): any {
  return (window as any).$wujie?.props || {};
}

async function doMount(container: any, props?: Record<string, unknown>) {
  // 取消自动渲染定时器，避免双重渲染
  if (autoRenderTimer) {
    clearTimeout(autoRenderTimer);
    autoRenderTimer = null;
  }

  // 兼容 wujie 和 MF 两种调用方式：
  // - wujie: doMount(wujieProps) - 只有一个参数
  // - MF: doMount(containerElement, { basename, ... }) - 两个参数
  const isWujieStyle = !container?.nodeType && !container?.host;
  const effectiveProps = isWujieStyle ? container : props;
  const effectiveContainer = isWujieStyle ? document : container;

  // 从 props 中获取 basename（MF 模式）
  const propsBasename = (effectiveProps as any)?.basename;
  console.log(`[orion-knowledge] doMount called, propsBasename:`, propsBasename);
  console.log(`[orion-knowledge] effectiveProps keys:`, effectiveProps ? Object.keys(effectiveProps) : 'null');
  console.log(`[orion-knowledge] effectiveContainer type:`, effectiveContainer?.constructor?.name || 'null');
  if (propsBasename) {
    window.__BASENAME__ = propsBasename;
    console.log(`[orion-knowledge] Using basename from mount props: ${propsBasename}`);
  }

  // 包装 window.open，确保子应用内部的 window.open 调用自动添加 basename
  wrapWindowOpen(propsBasename || '');

  console.log('[orion-knowledge] mount, props:', effectiveProps);

  window.__POWERED_BY_WUJIE__ = true;
  window.__POWERED_BY_ORION__ = true;

  // 在有效容器内创建 #root 元素
  // 注意：当使用 Shadow DOM 时，#root 必须在 ShadowRoot 内部，
  // 否则 render 函数中的 container.querySelector('#root') 会返回 null
  let rootEl = effectiveContainer.querySelector('#root');
  if (!rootEl) {
    rootEl = document.createElement('div');
    rootEl.id = 'root';
    effectiveContainer.appendChild(rootEl);
    console.log('[orion-knowledge] Created #root element inside container:', effectiveContainer.constructor?.name);
  }

  knowledgeRoot = render({ ...effectiveProps, container: effectiveContainer, basename: propsBasename });

  // 验证渲染结果
  setTimeout(() => {
    const shadowRoot = effectiveContainer;
    if (shadowRoot?.host) {
      // ShadowRoot 场景
      const hostEl = shadowRoot.host;
      const rootInShadow = shadowRoot.querySelector('#root');
      console.log(`[orion-knowledge] Post-render check:`, {
        hostInDom: !!document.body.contains(hostEl),
        hostId: hostEl.id,
        shadowRootContent: shadowRoot.innerHTML?.substring(0, 100),
        hasRootInShadow: !!rootInShadow,
        rootContent: rootInShadow?.innerHTML?.substring(0, 100),
      });
    }
  }, 500);
}

async function doUnmount() {
  console.log('[orion-knowledge] unmount');
  if (knowledgeRoot) {
    knowledgeRoot.unmount();
    knowledgeRoot = null;
  }
  window.__POWERED_BY_WUJIE__ = false;
}

// 导出 ES module 生命周期（用于构建后产物）
export { doBootstrap as bootstrap, doMount as mount, doUnmount as unmount };

// 挂载到 window（用于 Vite dev 模式，wujie 从全局读取）
(window as any).bootstrap = doBootstrap;
(window as any).mount = doMount;
(window as any).unmount = doUnmount;
