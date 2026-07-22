---
name: frontend-interaction-check
enabled: true
event: file
pattern: orion-frontend/src/.*\.tsx$
action: warn
---

🔍 **前端文件已修改**

建议运行以下命令验证交互链完整性：
```bash
npx tsx docs/design-constraints/framework/core/cli-check.ts --verify <文件路径>
```

确保通过 8 项交互检查：
- Has interactive handlers (P1)
- Has user feedback (P0)
- Has loading state (P0)
- Has Empty for lists (P1)
- Has submit for forms (P1)
- Has edit entry for CRUD (P1)
- Uses Design Token (P2)
- Has component states (P2)
