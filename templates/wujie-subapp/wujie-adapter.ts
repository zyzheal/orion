/**
 * Wujie 子应用入口适配器
 *
 * 使用方法:
 * 1. 在子应用 main.ts 中引入此文件
 * 2. 调用 createSubAppAdapter 创建适配器
 * 3. 使用 adapter.mount 和 adapter.unmount 包装原有逻辑
 *
 * @example
 * import { createSubAppAdapter } from '@/utils/wujie-adapter'
 *
 * const adapter = createSubAppAdapter({
 *   name: 'orion-dba',
 *   render: (props) => {
 *     // 渲染逻辑
 *     createApp(App).mount('#app')
 *   }
 * })
 *
 * export const { bootstrap, mount, unmount } = adapter
 */

export interface SubAppAdapterOptions {
  /** 子应用名称 */
  name: string
  /** 渲染函数 */
  render: (props: Record<string, unknown>) => void
  /** 卸载回调 */
  onDestroy?: () => void
}

export interface SubAppAdapter {
  /** 子应用启动 */
  bootstrap: () => Promise<void>
  /** 子应用挂载 */
  mount: (props: Record<string, unknown>) => Promise<void>
  /** 子应用卸载 */
  unmount: () => Promise<void>
}

/**
 * 创建子应用适配器
 */
export function createSubAppAdapter(options: SubAppAdapterOptions): SubAppAdapter {
  const { name, render, onDestroy } = options

  let mounted = false
  let propsCache: Record<string, unknown> = {}

  return {
    async bootstrap() {
      console.log(`[Wujie] ${name} bootstrap`)
    },

    async mount(props: Record<string, unknown>) {
      console.log(`[Wujie] ${name} mount`, props)

      if (mounted) {
        console.warn(`[Wujie] ${name} already mounted`)
        return
      }

      // 缓存 props
      propsCache = props

      // 标记正在运行
      ;(window as unknown as Record<string, unknown>).__POWERED_BY_WUJIE__ = true

      // 存储全局状态
      if (props.$orion) {
        ;(window as unknown as Record<string, unknown>).$orion = props.$orion
      }

      // 渲染应用
      render(props)

      mounted = true
    },

    async unmount() {
      console.log(`[Wujie] ${name} unmount`)

      if (!mounted) {
        console.warn(`[Wujie] ${name} not mounted`)
        return
      }

      // 执行销毁回调
      onDestroy?.()

      // 清理标记
      ;(window as unknown as Record<string, unknown>).__POWERED_BY_WUJIE__ = false

      mounted = false
    }
  }
}

/**
 * 检测是否在 wujie 沙箱中运行
 */
export function isWujieSubApp(): boolean {
  return !!((window as unknown as Record<string, unknown>).__POWERED_BY_WUJIE__)
}

/**
 * 获取主应用注入的全局状态
 */
export function getOrionState() {
  return (window as unknown as Record<string, unknown>).$orion
}

/**
 * 获取 API 基础路径
 */
export function getApiBase(): string {
  const orion = getOrionState()
  if (orion?.getApiBase) {
    return orion.getApiBase()
  }
  return import.meta.env.VITE_API_BASE_URL || '/api'
}

/**
 * 获取认证 Token
 */
export function getToken(): string | null {
  const orion = getOrionState()
  return orion?.token || localStorage.getItem('access_token')
}

/**
 * 发送事件到主应用
 */
export function emitEvent(event: string, data: unknown): void {
  const orion = getOrionState()
  orion?.eventBus?.emit(event, data)
}

/**
 * 监听主应用事件
 */
export function onEvent(event: string, callback: (data: unknown) => void): () => void {
  const orion = getOrionState()
  orion?.eventBus?.on(event, callback)

  // 返回清理函数
  return () => {
    orion?.eventBus?.off(event, callback)
  }
}
