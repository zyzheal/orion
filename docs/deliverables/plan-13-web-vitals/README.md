# Plan 13 — Web Vitals 性能监控

> **状态**: 已合并到 [plan-32-web-vitals/](../plan-32-web-vitals/)
>
> 本方案的设计内容已由 plan-32 覆盖。

## 本地代码扫描结果

- **本地模块**: 无 `web-vitals` 依赖，前端未集成性能采集
- **缺口**: 完全缺失 LCP/CLS/INP/TTFB 采集和上报
- **合并方向**: plan-32-web-vitals/ 包含前端 TS 采集器 + 后端 Go Prometheus 接收器

## 详细设计

参见 [plan-32-web-vitals/web-vitals.ts](../plan-32-web-vitals/web-vitals.ts) (229 行) + [web_vitals.go](../plan-32-web-vitals/web_vitals.go) (164 行)
