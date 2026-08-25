# Plan 33 — Lighthouse CI 性能门禁

- **优先级**: P1
- **来源**: 全量代码扫描发现 — 无 `.lighthouserc` 文件

## 本地证据

| 检查项 | 结果 |
|--------|------|
| `.lighthouserc` 文件 | **不存在** |
| `package.json` lighthouse 依赖 | **无** |
| CI 管道中 lighthouse 步骤 | **无** |
| 前端 Vite dev server 端口 | 3000 (默认) |

## 方案

### 1. 安装依赖

```bash
cd orion-frontend
npm install --save-dev @lhci/cli@^0.13.0
```

### 2. 配置文件

参见 `.lighthouserc.json` — 配置 5 个核心页面、3 次运行取平均、性能≥0.8 门禁。

### 3. 添加 npm 脚本

```json
// package.json scripts
{
  "lighthouse": "lhci autorun --config=.lighthouserc.json",
  "lighthouse:collect": "lhci collect --config=.lighthouserc.json",
  "lighthouse:assert": "lhci assert --config=.lighthouserc.json",
  "lighthouse:upload": "lhci upload --target=filesystem --outputDir=lighthouse-reports"
}
```

### 4. CI 集成

```yaml
# .github/workflows/lighthouse.yml 或 Jenkinsfile
- name: Build frontend
  run: cd orion-frontend && npm run build

- name: Preview build
  run: cd orion-frontend && npx vite preview --port 3000 &
  # 等待服务启动
  run: sleep 5

- name: Run Lighthouse CI
  run: cd orion-frontend && npx @lhci/cli autorun --config=.lighthouserc.json

- name: Upload Lighthouse reports
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: lighthouse-reports
    path: orion-frontend/lighthouse-reports/
```

### 5. 关键指标门禁

| 指标 | 阈值 | 级别 |
|------|------|------|
| Performance score | ≥ 0.8 | error |
| Accessibility score | ≥ 0.9 | error |
| Best Practices score | ≥ 0.8 | warn |
| SEO score | ≥ 0.7 | warn |
| FCP | ≤ 2000ms | warn |
| LCP | ≤ 2500ms | error |
| CLS | ≤ 0.1 | error |
| TBT | ≤ 300ms | warn |
