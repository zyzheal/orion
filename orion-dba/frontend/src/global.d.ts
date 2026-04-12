import { VueElement } from 'vue';

declare global {
  interface Window {
    MonacoEnvironment: any;

    // wujie 微前端标记
    __POWERED_BY_WUJIE__?: boolean;

    // Orion 全局状态
    $orion?: {
      user?: any;
      permissions?: string[];
      token?: string | null;
      apiBase?: string;
      getApiBase?: () => string;
      eventBus?: {
        emit: (event: string, data: any) => void;
        on: (event: string, callback: (data: any) => void) => void;
        off: (event: string, callback: (data: any) => void) => void;
      };
    };
  }
}
