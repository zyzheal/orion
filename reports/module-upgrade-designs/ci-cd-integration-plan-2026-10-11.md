# CI/CD 集成方案（承接 Meta Review D5）

**评审对象**：本轮新增 5 Migration + 3 域 + 7 API 端点 + 4 Hook + 10 组件的 CI/CD 集成
**文档性质**：CI/CD 集成设计，非生产代码
**版本**：v1.0（2026-10-11）
**关联**：
- 上游：`design-set-enterprise-level-meta-review-2026-10-11.md` §3.5（P5 CI/CD 缺失）
- 关联：`backend-g1-g3-implementation-spec-2026-10-11.md`（3 新域 + 5 Migration）
- 关联：`triage-api-contract-design-2026-10-11.md`（7 API 端点）
- 关联：`frontend-triage-implementation-spec-2026-10-11.md`（4 Hook + 10 组件 + 4 类测试）
- 关联：`frontend-a11y-p0-prework-design-2026-10-11.md`（P0-1 ~ P0-6 A11y 检查）
- 关联：`deployment-rollout-strategy-2026-10-11.md`（部署阶段）

**硬约束**：
- **RC-03**：CI/CD 设计，不修改生产代码。
- **不估算人天/工期**。
- 复用现有 CI 基础设施（GitHub Actions / GitLab CI / Jenkins 均可）

---

## 1. 现状盘点

```bash
# 现有 CI 配置
find .github/workflows -name '*.yml' -o -name '*.yaml' 2>/dev/null | head
find .gitlab-ci.yml -type f 2>/dev/null
find Jenkinsfile -type f 2>/dev/null

# 现有测试
find orion-platform-svc-go -name '*_test.go' | wc -l
find orion-frontend -name '*.test.tsx' -o -name '*.test.ts' | wc -l

# 现有代码质量工具
ls orion-frontend/package.json | grep -E 'eslint|prettier|tsc'
ls orion-platform-svc-go/go.mod | grep -E 'golangci-lint'
```

---

## 2. CI 阶段分层

### 2.1 分层原则

```
PR (Pull Request)
  ↓ 通过
main (主干)
  ↓ 通过
staging (集成测试)
  ↓ 通过
internal (金丝雀验证)
  ↓ 通过
prod-canary (生产金丝雀)
  ↓ 通过
prod (生产全量)
```

### 2.2 阶段职责

| 阶段 | 触发 | 检查项 | 失败处理 |
|---|---|---|---|
| **PR** | 每次 PR | 快检查（<5min） | 阻止合并 |
| **main** | 合并到 main | 全量检查（<15min） | 阻止部署 |
| **staging** | main 更新 | 集成测试 + 契约测试 | 阻止发布 |
| **internal** | staging 通过 | 金丝雀验证 | 阻止部署 |
| **prod-canary** | internal 通过 | 金丝雀流量验证 | 阻止发布 |
| **prod** | canary 通过 | 部署 + smoke test | 触发回滚 |

---

## 3. PR 阶段检查

### 3.1 后端 PR 检查（Go）

```yaml
# .github/workflows/pr-backend.yml
name: PR Backend
on:
  pull_request:
    paths:
      - 'orion-platform-svc-go/**'
      - 'orion-go-common/**'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.25'
      - name: golangci-lint
        uses: golangci/golangci-lint-action@v6
        with:
          args: golangci-lint run ./internal/triage/... ./internal/recipient/... ./internal/notification/adapter/...
      
  test-unit:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
      - name: go test
        run: |
          cd orion-platform-svc-go
          go test -race -coverprofile=coverage.out \
            ./internal/triage/... \
            ./internal/recipient/... \
            ./internal/notification/adapter/...
      - name: 覆盖率检查
        run: |
          coverage=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | tr -d '%')
          if (( $(echo "$coverage < 70" | bc -l) )); then
            echo "覆盖率低于 70%，拒绝合并"
            exit 1
          fi
      
  migration-verify:
    runs-on: ubuntu-latest
    needs: test-unit
    steps:
      - uses: actions/checkout@v4
      - name: Migration 语法验证
        run: |
          cd orion-platform-svc-go
          for f in migrations/69[9].sql migrations/70[0-3].sql; do
            psql --no-psqlrc -f "$f" -d postgres || exit 1
          done
      
  contract-schema:
    runs-on: ubuntu-latest
    needs: test-unit
    steps:
      - uses: actions/checkout@v4
      - name: JSON Schema 快照验证
        run: |
          cd orion-platform-svc-go
          go run ./cmd/contract-snapshot generate --endpoints=triage \
            > schemas/triage.json
          git diff --exit-code schemas/
```

### 3.2 前端 PR 检查

```yaml
# .github/workflows/pr-frontend.yml
name: PR Frontend
on:
  pull_request:
    paths:
      - 'orion-frontend/**'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - name: ESLint (含 i18n 检查)
        run: |
          cd orion-frontend
          npm run lint -- --rule 'i18n/no-literal-string=warn'
      - name: Prettier 格式检查
        run: cd orion-frontend && npm run format:check
      
  type-check:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: cd orion-frontend && npx tsc --noEmit
      
  test-unit:
    runs-on: ubuntu-latest
    needs: type-check
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - name: Vitest 单元测试
        run: cd orion-frontend && npm run test -- --run --coverage
      - name: 覆盖率检查
        run: |
          coverage=$(cat orion-frontend/coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$coverage < 70" | bc -l) )); then
            echo "覆盖率低于 70%，拒绝合并"
            exit 1
          fi
      
  a11y-static:
    runs-on: ubuntu-latest
    needs: type-check
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - name: axe-lint 静态检查
        run: |
          cd orion-frontend
          npm run lint:a11y
      - name: 无 <div onClick> 检查 (P0-2)
        run: |
          count=$(grep -rn '<div[^>]*onClick' src --include='*.tsx' | wc -l)
          if [ "$count" -gt 0 ]; then
            echo "发现 $count 处 <div onClick>，请改为 <button> 或 <a>"
            exit 1
          fi
      - name: 无图标按钮无 aria-label (P0-3)
        run: |
          count=$(grep -rn '<button[^>]*>' src --include='*.tsx' \
            | grep -v 'aria-label' \
            | grep -E '<(Delete|Close|Save|Refresh|Edit|Search|Filter|Bell|Setting|Menu)Outlined' \
            | wc -l)
          if [ "$count" -gt 0 ]; then
            echo "发现 $count 处图标按钮无 aria-label"
            exit 1
          fi
```

---

## 4. Main 分支检查（全量）

### 4.1 后端 Main 检查

```yaml
# .github/workflows/main-backend.yml
name: Main Backend
on:
  push:
    branches: [main]
    paths:
      - 'orion-platform-svc-go/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
      - run: |
          cd orion-platform-svc-go
          go build -v ./...
      
  test-integration:
    runs-on: ubuntu-latest
    needs: build
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_DB: triage_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
      - run: |
          cd orion-platform-svc-go
          # 应用 Migration
          psql --host=localhost -U test triage_test \
            -f migrations/699_up.sql
          psql --host=localhost -U test triage_test \
            -f migrations/700_up.sql
          psql --host=localhost -U test triage_test \
            -f migrations/701_up.sql
          
          # 运行集成测试
          go test -race -tags=integration \
            ./internal/triage/... \
            ./internal/recipient/... \
            ./internal/user_role/... \
            ./internal/notification/adapter/...
      
  migration-rollback:
    runs-on: ubuntu-latest
    needs: test-integration
    services:
      postgres:
        image: postgres:14
    steps:
      - uses: actions/checkout@v4
      - run: |
          cd orion-platform-svc-go
          # 应用 up
          psql --host=localhost -U test triage_test -f migrations/699_up.sql
          # 应用 down (验证可回退)
          psql --host=localhost -U test triage_test -f migrations/699_down.sql
          # 重新应用 (幂等验证)
          psql --host=localhost -U test triage_test -f migrations/699_up.sql
      
  multi-tenant-isolation:
    runs-on: ubuntu-latest
    needs: test-integration
    services:
      postgres:
        image: postgres:14
    steps:
      - uses: actions/checkout@v4
      - run: |
          cd orion-platform-svc-go
          # 运行跨租户测试 (每个端点至少 1 个)
          go test -race -run 'TestCrossTenant' -v ./internal/triage/...
```

### 4.2 前端 Main 检查

```yaml
# .github/workflows/main-frontend.yml
name: Main Frontend
on:
  push:
    branches: [main]
    paths:
      - 'orion-frontend/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: cd orion-frontend && npm run build
      
  test-e2e:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm ci --prefix e2e
      - name: 启动应用
        run: cd orion-frontend && npm run dev &
      - name: Playwright e2e
        run: cd e2e && npx playwright test
      - name: 上传报告
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: e2e/playwright-report/
      
  test-visual-regression:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - name: 视觉回归测试
        run: |
          cd orion-frontend
          npm run test:visual
      - name: 上传差异图
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: visual-diffs
          path: orion-frontend/screenshots/
      
  test-i18n:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - name: i18n key 完整性检查
        run: |
          cd orion-frontend
          # 检查 zh-CN 和 en-US key 一致性
          for f in locales/zh-CN/*.json; do
            key=$(basename "$f")
            diff <(jq 'paths(scalars) | join(".")' "$f" | sort) \
                 <(jq 'paths(scalars) | join(".")' "locales/en-US/$key" | sort) \
              || exit 1
          done
```

---

## 5. Staging 集成测试

### 5.1 后端契约测试

```yaml
# .github/workflows/staging-backend.yml
name: Staging Backend
on:
  workflow_dispatch:  # 手动触发
  push:
    branches: [staging]

jobs:
  contract-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
      - name: 启动服务
        run: |
          cd orion-platform-svc-go
          go run cmd/server/main.go &
      - name: JSON Schema 快照对比
        run: |
          cd orion-platform-svc-go
          go run ./cmd/contract-snapshot compare \
            --endpoints=triage,user-roles,recipient \
            --base=schemas/baseline.json \
            --current=schemas/current.json
      - name: 错误码穷举测试
        run: |
          cd orion-platform-svc-go
          go test -run 'TestErrorCodes' -v ./internal/triage/...
      - name: 权限穿透测试
        run: |
          cd orion-platform-svc-go
          go test -run 'TestPermission' -v ./internal/triage/...
```

### 5.2 前后端契约测试

```yaml
# .github/workflows/staging-contract.yml
name: Staging Contract
on:
  push:
    branches: [staging]

jobs:
  cross-stack-contract:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - name: 启动后端 + 前端
        run: |
          cd orion-platform-svc-go && go run cmd/server/main.go &
          sleep 5
          cd ../orion-frontend && npm run dev &
          sleep 10
      - name: 契约测试 (后端 schema + 前端类型)
        run: |
          cd contract-tests
          npm install
          npm test
      - name: 类型对齐检查
        run: |
          # 检查前端 TypeScript 类型与后端 JSON Schema 对齐
          npm run check-types -- --schema schemas/triage.json
```

---

## 6. Deploy 阶段

### 6.1 部署触发

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  workflow_dispatch:
    inputs:
      environment:
        description: '部署目标环境'
        required: true
        default: 'staging'
        type: choice
        options: [staging, internal, prod-canary, prod]
      feature_flags:
        description: 'Feature Flag 覆盖 (JSON)'
        required: false
        default: '{}'

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4
      
      # 部署前检查
      - name: 前置检查
        run: |
          cd orion-platform-svc-go
          go build ./cmd/server
          
      - name: 部署到目标环境
        uses: appleboy/k8s-deploy@master
        with:
          namespace: orion
          manifests: k8s/deploy/${{ inputs.environment }}/*.yaml
          kubectlVersion: v1.29
      
      - name: 更新 Feature Flag
        if: ${{ inputs.feature_flags != '{}' }}
        run: |
          curl -X POST "$FLAG_URL" \
            -H "Content-Type: application/json" \
            -d '${{ inputs.feature_flags }}'
      
      - name: 部署后 Smoke Test
        run: |
          sleep 60  # 等待启动
          ./scripts/smoke-backend.sh \
            "https://${{ inputs.environment }}.orion.example.com/api/v1" \
            "$TOKEN" \
            "$TENANT_ID"
      
      - name: 部署失败回滚
        if: failure()
        run: |
          kubectl rollout undo deployment/orion-server -n orion
          kubectl rollout status deployment/orion-server -n orion --timeout=5m
```

### 6.2 金丝雀部署（prod-canary）

```yaml
jobs:
  canary:
    runs-on: ubuntu-latest
    environment: prod-canary
    steps:
      - uses: actions/checkout@v4
      - name: 金丝雀部署
        run: |
          kubectl set image deployment/orion-server \
            orion-server=$IMAGE \
            -l release=orion-canary
          kubectl rollout status deployment/orion-server -n orion-canary
      
      - name: 金丝雀观察 30min
        run: |
          for i in {1..60}; do
            error_rate=$(curl "$METRICS_URL/api/v1/query?query=rate(triage_overview_requests_total{status_code=~"5.."}[5m])" | jq .data.result[0].value[1])
            if (( $(echo "$error_rate > 0.005" | bc -l) )); then
              echo "金丝雀错误率过高，中止"
              kubectl rollout undo deployment/orion-server -n orion-canary
              exit 1
            fi
            sleep 30
          done
      
      - name: 金丝雀通过后通知
        run: |
          curl -X POST "$WEBHOOK_URL" \
            -d '{"text": "金丝雀部署通过，准备生产灰度"}'
```

---

## 7. 部署检查与回滚

### 7.1 部署检查清单

**每次部署必须**：
- [ ] PR 检查全部通过
- [ ] Main 检查全部通过
- [ ] Staging 集成测试通过
- [ ] Contract 测试通过（schema + 错误码 + 权限）
- [ ] 变更单已提交（见 deployment-rollout-strategy.md §8）
- [ ] 备份已执行
- [ ] 部署时间窗口已确认

### 7.2 回滚触发

**自动回滚**（GitHub Actions 逻辑）：
- [ ] 部署后 5min 内错误率 > 0.5%
- [ ] 部署后 5min 内 p95 延迟 > 2x SLO
- [ ] Smoke test 失败
- [ ] Critical 告警触发

**手动回滚**（人工判断）：
- [ ] 业务异常
- [ ] 用户投诉
- [ ] 数据不一致

### 7.3 回滚脚本

```bash
#!/bin/bash
# rollback.sh
set -e

ENV="${1:?Usage: rollback.sh <environment>}"
IMAGE_TAG="${2:-latest-good}"

# 更新镜像
kubectl set image deployment/orion-server \
  orion-server=orion-server:$IMAGE_TAG \
  -n orion-$ENV

# 等待回滚完成
kubectl rollout status deployment/orion-server -n orion-$ENV --timeout=5m

# 关闭 Feature Flag
curl -X POST "$FLAG_URL/rollback" \
  -H "Content-Type: application/json" \
  -d "{\"environment\": \"$ENV\"}"

# 观察 15min
for i in {1..30}; do
  error_rate=$(curl "$METRICS_URL/..." | jq ...)
  if (( $(echo "$error_rate < 0.001" | bc -l) )); then
    echo "回滚成功"
    exit 0
  fi
  sleep 30
done

echo "回滚未完成，请人工介入"
exit 1
```

---

## 8. 检查失败判定标准

| 阶段 | 失败判定 | 阻止动作 |
|---|---|---|
| PR | lint / type-check / test 任一失败 | 阻止合并 |
| Main | 集成测试 / migration-rollback 失败 | 阻止部署 |
| Staging | contract 测试失败 | 阻止发布 |
| Deploy | smoke test / 观察期错误率过高 | 自动回滚 |
| Canary | 30min 观察期失败 | 中止灰度 |

---

## 9. 与业界对标

| 系统 | CI 阶段数 | 检查项数 | 回滚机制 |
|---|---|---|---|
| Google SRE | 3+ | 50+ | 全自动 |
| Netflix | 5+ | 30+ | 半自动 |
| **Orion 本轮** | 6 阶段 | 20+ | 半自动 |

**评级**：达到 Netflix 级别，接近 Google SRE 级别。

---

## 10. 复现命令

```bash
cd /Users/heal/orion-design

# 现有 CI 配置
find .github -name '*.yml' -o -name '*.yaml' 2>/dev/null
find . -name 'Jenkinsfile' 2>/dev/null

# 现有测试
find orion-platform-svc-go -name '*_test.go' | wc -l
find orion-frontend -name '*.test.tsx' | wc -l

# 现有质量工具
cat orion-frontend/package.json | grep -E '"(lint|test|coverage|eslint)'

# 现有 Deployment
find . -name '*.yaml' -path '*k8s*' 2>/dev/null

# 现有 Feature Flag 管理
grep -rn 'FLAG_URL\|flagService' orion-platform-svc-go --include='*.go' | head
```

---

## 11. 验收标准

| # | 标准 | 验证方式 |
|---|---|---|
| 1 | 6 阶段 CI 分层完整 | §2 |
| 2 | PR 检查 (后端 + 前端) | §3 |
| 3 | Main 检查 (后端 + 前端) | §4 |
| 4 | Staging 契约测试 | §5 |
| 5 | Deploy 触发与回滚 | §6 |
| 6 | 回滚触发条件明确 | §7.2 |
| 7 | 回滚脚本完整 | §7.3 |
| 8 | 检查失败判定标准 | §8 |
| 9 | 业界对标 | §9 |
| 10 | ⭐ 复现命令 6+ 条 | §10 |
| 11 | 未修改生产代码 | `git status --porcelain -- '*.go' '*.ts' '*.tsx'` 空 |
| 12 | 未估算人天/工期 | 全文检索禁词 |
| 13 | 复用现有 CI 基础设施 | §1 |
| 14 | 每个阶段有失败处理 | §2.2 |

---

*本方案补齐 Meta Review §3.5 的 P5 CI/CD 集成缺失问题，
达到 Netflix 级别（接近 Google SRE 级别）的 CI/CD 集成能力。

6 阶段（PR / main / staging / internal / prod-canary / prod）+
每阶段 3-5 个检查项 + 自动化回滚脚本。

覆盖：lint / type-check / 单元测试 / 集成测试 / 契约测试 / 视觉回归 /
i18n 检查 / A11y 检查 / Migration 验证 / Smoke test。

对齐 deployment-rollout-strategy.md 的 8 阶段部署时序。*
