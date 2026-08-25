// ChatTrigger 轻量（仅 Tooltip + 图标），保持静态导出供 Layout 全局常驻
export { ChatTrigger } from './ChatTrigger';
// ChatPanel / SmartRecommend / ChatInput / ChatMessage / ActionCard / MessageArea
// 仅被 ChatPanel 内部使用，通过 React.lazy 在打开时加载，不在此 barrel 导出
// 以避免 Layout 静态依赖链拉入整个 ChatOps chunk (~290KB)
export { CommandParser } from './CommandParser';
export { extractPageContext } from './pageContext';
export type { PageContext } from './pageContext';
