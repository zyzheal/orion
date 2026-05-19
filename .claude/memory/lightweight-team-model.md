---
name: Lightweight Team Model Implementation
description: Team model for batch permission management, CODEOWNERS resolution, and team-based authorization
type: project
---

**Fact**: 轻量 Team 模型已实现，包含 3 张新表 + TeamRepository/TeamService + 集成到 AuthorizationEngine。

**Why**: RBAC+ABAC 引擎缺少团队级别的批量权限管理能力，CODEOWNERS 中的 @team-name 无法解析为实际成员。

**How to apply**: 
- `teams` 表: 团队基本信息 (slug 唯一, team_type: functional/project/sre/dba/security, 可选 parent_team)
- `team_members` 表: 用户-团队关联 (role: member/lead/admin)
- `team_roles` 表: 团队-角色映射 (团队获得角色后成员自动继承权限)
- TeamService: CRUD + 成员管理 + 角色分配 + 权限聚合 + CODEOWNERS 解析
- AuthorizationEngine [2.7] 层: 当用户无直接角色时，检查团队角色权限
- RelationshipService [3]: 新增 team_member 关系检查
- requirePermission 中间件: 传递 user.teams 到 AuthZRequest
- API 路由: `/api/v1/teams` (13 个端点)
