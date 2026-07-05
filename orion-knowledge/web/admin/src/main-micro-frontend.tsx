import '@/assets/fonts/font.css';
import '@/assets/styles/index.css';
import '@/assets/styles/markdown.css';
import React, { createContext } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { wrapWindowOpen, initBasename } from './utils/getBasename';
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
// 微前端标识：判断是否运行在 Orion 容器中
// 使用 getter 而非一次性检查，避免 Vite 模块缓存导致状态不同步
// ============================================
const isOrionChild = () => !!window.__POWERED_BY_ORION__;

// ============================================
// 应用实例引用
// ============================================
let knowledgeRoot: Root | null = null;

// 跟踪每个容器的 React root（避免在 ShadowRoot 上直接挂属性）
const rootMap = new WeakMap<Element, Root>();

// ============================================
// 渲染应用
// ============================================
function render(props: any = {}) {
  const { container, basename } = props;

  const containerEl = container
    ? container.querySelector('#root')
    : document.querySelector('#root');

  if (!containerEl || !(containerEl instanceof Element)) return;

  // 复用已存在的 React root
  let existingRoot: Root | null = rootMap.get(containerEl) || null;

  if (existingRoot) {
    knowledgeRoot = existingRoot;
  } else {
    knowledgeRoot = createRoot(containerEl);
    rootMap.set(containerEl, knowledgeRoot);
  }

  knowledgeRoot.render(
    <React.StrictMode>
      <Provider store={store}>
        <BrowserRouter basename={basename || window.__BASENAME__}>
          <OrionContext.Provider value={props}>
            <App />
          </OrionContext.Provider>
        </BrowserRouter>
      </Provider>
    </React.StrictMode>
  );
}

// ============================================
// 独立运行模式（开发环境）
// 仅在非微前端模式下自动渲染
// ============================================
if (!isOrionChild()) {
  // 初始化 basename（独立运行模式）
  initBasename();

  // 动态加载 CSS 文件（开发环境下该文件可能不存在，静默忽略）
  const loadCSS = (href: string) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onerror = () => console.log(`[orion-knowledge] CSS not found: ${href}`);
    document.head.appendChild(link);
  };

  loadCSS(`${window.__BASENAME__ || ''}/orion-knowledge.css`);
  wrapWindowOpen(window.__BASENAME__ || '');
  dayjs.extend(duration);
  dayjs.extend(relativeTime);
  dayjs.locale('zh-cn');

  render();
  console.log('[orion-knowledge] Running in standalone mode');
}

// ============================================
// 微前端子应用生命周期（用于 Module Federation）
// ============================================

/**
 * 生命周期：初始化
 * 在子应用首次加载前调用，可用于全局初始化逻辑
 */
export async function bootstrap() {
  console.log('[orion-knowledge] bootstrap');
  dayjs.extend(duration);
  dayjs.extend(relativeTime);
  dayjs.locale('zh-cn');
}

/**
 * 生命周期：挂载
 * 主应用调用此方法将子应用渲染到指定容器
 * @param container - MFSandboxBridge 传递的容器（ShadowRoot 或 HTMLElement）
 * @param props - MFSandboxBridge 传递的 props（含 basename）
 */
export async function mount(container: any, props?: Record<string, unknown>) {
  console.log('[orion-knowledge-mf] mount with container:', container);
  console.log('[orion-knowledge-mf] mount with props:', props);

  window.__POWERED_BY_ORION__ = true;

  // 兼容处理：如果是 HTMLElement/ShadowRoot，直接使用
  const effectiveContainer = container?.nodeType || container?.host
    ? container
    : (props?.container || document.body);

  // 从 props 中获取主应用传入的 basename
  const propsBasename = (props as any)?.basename;
  if (propsBasename) {
    window.__BASENAME__ = propsBasename;
    console.log(`[orion-knowledge-mf] Using basename from props: ${propsBasename}`);
  }

  // 在容器内创建 #root 元素
  let rootEl = effectiveContainer.querySelector('#root');
  if (!rootEl) {
    rootEl = document.createElement('div');
    rootEl.id = 'root';
    effectiveContainer.appendChild(rootEl);
    console.log('[orion-knowledge-mf] Created #root element inside container');
  }

  render({ container: effectiveContainer, basename: propsBasename });
}

/**
 * 生命周期：卸载
 * 主应用调用此方法销毁子应用实例，释放资源
 */
export async function unmount() {
  console.log('[orion-knowledge] unmount');
  if (knowledgeRoot) {
    knowledgeRoot.unmount();
    knowledgeRoot = null;
  }
  window.__POWERED_BY_ORION__ = false;
}

// 挂载到 window（用于 Vite dev 模式）
(window as any).bootstrap = bootstrap;
(window as any).mount = mount;
(window as any).unmount = unmount;