---
name: design-doc-review
enabled: true
event: file
pattern: docs/architecture/.*\.md$
action: warn
---

📝 **设计文档已创建/修改**

建议调用 design-doc-reviewer 进行 7 维度评审：
- 操作链路完整性
- 页面交互串联
- 跨系统串联
- 产品用户视角
- 开发者视角
- 大厂模式对标
- 页面级设计质量

评审完成后再转交 task-decomposer 拆分修复任务。
