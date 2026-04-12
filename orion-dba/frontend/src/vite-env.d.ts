/// <reference types="vite/client" />

// 微前端：Orion 全局类型定义
interface OrionGlobal {
  user: {
    id: string;
    name: string;
    email: string;
    roles: string[];
  };
  permissions: string[];
  token: string;
  apiBase: string;
}

declare global {
  interface Window {
    __POWERED_BY_ORION__: boolean;
    $orion?: OrionGlobal;
  }
}

// 模块导出声明
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// 库导出声明
declare module 'sql-formatter';
declare module 'insert-css';
declare module 'vditor';
