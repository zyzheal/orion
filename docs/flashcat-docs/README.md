# FlashCat 文档库

从 [docs.flashcat.cloud](https://docs.flashcat.cloud) 抓取的中文文档

## 统计信息

- 总页面数: 195
- 成功下载: 193
- 下载失败: 2 (首页重复、状态页 URL 拼写错误)
- 总大小: 3.1 MB
- 更新时间: 2026-05-25

## 分类目录

| 分类 | 文件数 | 说明 |
|------|--------|------|
| 01-首页 | 2 | 产品概览 |
| 02-OnCall告警管理 | 109 | 告警管理核心模块，含 100+ 集成、分派策略、值班管理、事件响应 |
| 03-RUM用户体验监控 | 49 | 用户体验监控，含 Web/Android/iOS/小程序 SDK、会话回放、异常追踪 |
| 04-Monitors监控管理 | 19 | 统一监控引擎，支持 Prometheus/ES/ClickHouse/Loki/MySQL 等数据源 |
| 05-平台通用配置 | 5 | 产品定价、组织管理、权限设计、SSO、审计日志 |
| 06-开发者工具 | 6 | CLI、MCP Server、Terraform Provider、API 文档 |
| 07-API文档 | 1 | OpenAPI 规范文档 |
| 08-安全合规 | 4 | 服务条款、用户协议、SLA、数据保护 |
| 09-更新日志 | 2 | 产品更新记录 |

## 文档用途

这些文档可用于：
- 了解 FlashCat 平台的功能和架构
- 参考监控告警平台的最佳实践
- 对比 Orion 平台与 FlashCat 的功能差异
- 学习 SRE/DevOps 事件管理流程

## 抓取工具

抓取脚本位于 `fetch_docs.py`，通过 Mintlify 的 `llms.txt` 索引获取所有文档链接。
