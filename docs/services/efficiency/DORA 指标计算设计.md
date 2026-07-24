# DORA 指标计算与效能看板设计

## 1. DORA 四大指标定义

### 1.1 指标概览

| 指标 | 英文名称 | 计算公式 | 数据来源 | 采集频率 |
|------|---------|---------|---------|---------|
| 部署频率 | Deployment Frequency (DF) | 单位时间内部署次数 | deployments 表 | 实时 |
| 变更前置时间 | Lead Time for Changes (LT) | 从 commit 到 deploy 的平均时长 | commits + deployments | 实时 |
| 服务恢复时间 | MTTR | 故障从发生到恢复的平均时长 | incidents 表 | 实时 |
| 变更失败率 | Change Failure Rate (CFR) | 部署失败次数 / 总部署次数 | deployments 表 | 实时 |

### 1.2 数据表结构

```sql
-- 部署记录表
CREATE TABLE deployments (
    id              BIGSERIAL PRIMARY KEY,
    team_id         VARCHAR(64) NOT NULL,      -- 团队 ID
    product_line    VARCHAR(64) NOT NULL,      -- 产品线
    environment     VARCHAR(32) NOT NULL,      -- 环境：prod/staging
    commit_sha      VARCHAR(64) NOT NULL,      -- 关联的 commit
    status          VARCHAR(32) NOT NULL,      -- success/failed/rollback
    started_at      TIMESTAMP NOT NULL,        -- 部署开始时间
    completed_at    TIMESTAMP,                 -- 部署完成时间
    duration_seconds INTEGER,                  -- 部署耗时
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Commit 记录表
CREATE TABLE commits (
    sha             VARCHAR(64) PRIMARY KEY,
    author_id       VARCHAR(64) NOT NULL,
    team_id         VARCHAR(64) NOT NULL,
    message         TEXT NOT NULL,
    committed_at    TIMESTAMP NOT NULL,
    files_changed   INTEGER,
    lines_added     INTEGER,
    lines_deleted   INTEGER
);

-- 故障事件表
CREATE TABLE incidents (
    id              BIGSERIAL PRIMARY KEY,
    team_id         VARCHAR(64) NOT NULL,
    product_line    VARCHAR(64) NOT NULL,
    severity        VARCHAR(16) NOT NULL,      -- P0/P1/P2/P3
    status          VARCHAR(32) NOT NULL,      -- open/resolved
    detected_at     TIMESTAMP NOT NULL,        -- 故障发现时间
    resolved_at     TIMESTAMP,                 -- 故障恢复时间
    related_deploy_id BIGINT,                  -- 关联的部署 ID
    created_at      TIMESTAMP DEFAULT NOW()
);
```

---

## 2. 详细计算公式

### 2.1 部署频率 (Deployment Frequency)

**定义**：单位时间内的成功部署次数，通常按天/周/月统计。

#### SQL 查询示例

```sql
-- 按天统计部署频率（最近 30 天）
SELECT 
    team_id,
    product_line,
    DATE(completed_at) AS date,
    COUNT(*) AS deployment_count
FROM deployments
WHERE status = 'success'
  AND completed_at >= NOW() - INTERVAL '30 days'
GROUP BY team_id, product_line, DATE(completed_at)
ORDER BY date DESC;

-- 按周统计部署频率（最近 12 周）
SELECT 
    team_id,
    product_line,
    DATE_TRUNC('week', completed_at) AS week_start,
    COUNT(*) AS deployment_count
FROM deployments
WHERE status = 'success'
  AND completed_at >= NOW() - INTERVAL '12 weeks'
GROUP BY team_id, product_line, DATE_TRUNC('week', completed_at)
ORDER BY week_start DESC;

-- 计算平均部署频率（次/天）
SELECT 
    team_id,
    product_line,
    COUNT(*) * 1.0 / 
        (MAX(DATE(completed_at)) - MIN(DATE(completed_at)) + 1) AS avg_deployments_per_day
FROM deployments
WHERE status = 'success'
  AND completed_at >= NOW() - INTERVAL '30 days'
GROUP BY team_id, product_line;
```

#### PromQL 查询示例

```promql
# 部署次数计数器
deployments_total{status="success"}

# 每日部署频率（过去 24 小时）
rate(deployments_total{status="success"}[24h]) * 86400

# 每周部署频率（过去 7 天）
rate(deployments_total{status="success"}[7d]) * 604800

# 按团队分组
sum by (team) (rate(deployments_total{status="success"}[24h])) * 86400
```

#### 数据聚合逻辑

| 维度 | 聚合方式 | 说明 |
|------|---------|------|
| 团队 | SUM/COUNT | 统计团队内所有部署 |
| 产品线 | SUM/COUNT | 统计产品线内所有部署 |
| 时间 | COUNT per period | 按日/周/月分组统计 |
| 环境 | 过滤 prod | 仅统计生产环境部署 |

#### 异常值处理

```sql
-- 剔除离群点（超过 3 倍标准差）
WITH stats AS (
    SELECT 
        team_id,
        AVG(deployment_count) AS avg_count,
        STDDEV(deployment_count) AS stddev_count
    FROM (
        SELECT team_id, DATE(completed_at) AS date, COUNT(*) AS deployment_count
        FROM deployments
        WHERE status = 'success'
        GROUP BY team_id, DATE(completed_at)
    ) daily_counts
    GROUP BY team_id
)
SELECT d.team_id, d.date, d.deployment_count
FROM (
    SELECT team_id, DATE(completed_at) AS date, COUNT(*) AS deployment_count
    FROM deployments
    WHERE status = 'success'
    GROUP BY team_id, DATE(completed_at)
) d
JOIN stats s ON d.team_id = s.team_id
WHERE d.deployment_count <= s.avg_count + 3 * s.stddev_count;
```

---

### 2.2 变更前置时间 (Lead Time for Changes)

**定义**：从代码提交 (commit) 到部署到生产环境的平均时长。

#### SQL 查询示例

```sql
-- 计算每次部署的 lead time
SELECT 
    d.team_id,
    d.product_line,
    d.id AS deployment_id,
    d.commit_sha,
    EXTRACT(EPOCH FROM (d.completed_at - c.committed_at)) / 60 AS lead_time_minutes
FROM deployments d
JOIN commits c ON d.commit_sha = c.sha
WHERE d.status = 'success'
  AND d.environment = 'prod'
  AND d.completed_at >= NOW() - INTERVAL '30 days';

-- 计算平均变更前置时间（按团队）
SELECT 
    d.team_id,
    AVG(EXTRACT(EPOCH FROM (d.completed_at - c.committed_at)) / 3600) AS avg_lead_time_hours,
    PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (d.completed_at - c.committed_at)) / 3600
    ) AS median_lead_time_hours
FROM deployments d
JOIN commits c ON d.commit_sha = c.sha
WHERE d.status = 'success'
  AND d.environment = 'prod'
  AND d.completed_at >= NOW() - INTERVAL '30 days'
GROUP BY d.team_id;

-- 按 PR 粒度统计（如有 PR 表）
SELECT 
    pr.team_id,
    AVG(EXTRACT(EPOCH FROM (d.completed_at - pr.merged_at)) / 3600) AS avg_lead_time_hours
FROM deployments d
JOIN pull_requests pr ON d.pull_request_id = pr.id
WHERE d.status = 'success'
  AND d.environment = 'prod'
GROUP BY pr.team_id;
```

#### PromQL 查询示例

```promql
# Lead Time 直方图
lead_time_for_changes_seconds_bucket

# 平均 Lead Time
rate(lead_time_for_changes_seconds_sum[7d]) / rate(lead_time_for_changes_seconds_count[7d])

# P50 Lead Time
histogram_quantile(0.50, sum(rate(lead_time_for_changes_seconds_bucket[7d])) by (le, team))

# P90 Lead Time
histogram_quantile(0.90, sum(rate(lead_time_for_changes_seconds_bucket[7d])) by (le, team))

# P99 Lead Time
histogram_quantile(0.99, sum(rate(lead_time_for_changes_seconds_bucket[7d])) by (le, team))
```

#### 数据聚合逻辑

| 维度 | 聚合方式 | 说明 |
|------|---------|------|
| 团队 | AVG/MEDIAN | 计算团队平均值/中位数 |
| 产品线 | AVG/MEDIAN | 计算产品线平均值/中位数 |
| 时间 | AVG over period | 按周/月计算平均趋势 |
| 百分位 | P50/P90/P99 | 分析分布情况 |

#### 异常值处理

```sql
-- 剔除异常值（负值和超大值）
SELECT 
    team_id,
    AVG(lead_time_minutes) AS avg_lead_time
FROM (
    SELECT 
        d.team_id,
        EXTRACT(EPOCH FROM (d.completed_at - c.committed_at)) / 60 AS lead_time_minutes
    FROM deployments d
    JOIN commits c ON d.commit_sha = c.sha
    WHERE d.status = 'success'
      AND d.completed_at > c.committed_at  -- 排除负值
      AND EXTRACT(EPOCH FROM (d.completed_at - c.committed_at)) / 3600 <= 720  -- 排除超过 30 天的
) valid_lead_times
GROUP BY team_id;

-- 使用 IQR 方法剔除离群点
WITH lead_times AS (
    SELECT 
        team_id,
        EXTRACT(EPOCH FROM (d.completed_at - c.committed_at)) / 3600 AS lead_time_hours
    FROM deployments d
    JOIN commits c ON d.commit_sha = c.sha
    WHERE d.status = 'success'
),
quartiles AS (
    SELECT 
        team_id,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY lead_time_hours) AS q1,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY lead_time_hours) AS q3
    FROM lead_times
    GROUP BY team_id
)
SELECT AVG(lt.lead_time_hours) AS avg_lead_time
FROM lead_times lt
JOIN quartiles q ON lt.team_id = q.team_id
WHERE lt.lead_time_hours BETWEEN q.q1 - 1.5 * (q.q3 - q.q1) 
                            AND q.q3 + 1.5 * (q.q3 - q.q1);
```

---

### 2.3 服务恢复时间 (MTTR)

**定义**：故障从发生到恢复的平均时长（Mean Time To Recovery）。

#### SQL 查询示例

```sql
-- 计算 MTTR（平均恢复时间）
SELECT 
    team_id,
    AVG(EXTRACT(EPOCH FROM (resolved_at - detected_at)) / 3600) AS avg_mttr_hours,
    PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (resolved_at - detected_at)) / 3600
    ) AS median_mttr_hours
FROM incidents
WHERE status = 'resolved'
  AND resolved_at >= NOW() - INTERVAL '30 days'
GROUP BY team_id;

-- 按严重程度统计 MTTR
SELECT 
    team_id,
    severity,
    COUNT(*) AS incident_count,
    AVG(EXTRACT(EPOCH FROM (resolved_at - detected_at)) / 3600) AS avg_mttr_hours
FROM incidents
WHERE status = 'resolved'
  AND resolved_at >= NOW() - INTERVAL '30 days'
GROUP BY team_id, severity
ORDER BY team_id, severity;

-- 滚动 7 日 MTTR 趋势
SELECT 
    team_id,
    DATE(detected_at) AS date,
    AVG(EXTRACT(EPOCH FROM (resolved_at - detected_at)) / 3600) 
        OVER (PARTITION BY team_id ORDER BY DATE(detected_at) ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)
        AS rolling_7d_mttr_hours
FROM incidents
WHERE status = 'resolved'
ORDER BY team_id, date;
```

#### PromQL 查询示例

```promql
# MTTR 计算（秒）
mttr_seconds

# 平均 MTTR（过去 7 天）
avg(mttr_seconds{status="resolved"}) 

# 按严重程度分组
avg by (severity) (mttr_seconds{status="resolved"})

# MTTR 趋势（过去 30 天）
avg_over_time(mttr_seconds{status="resolved"}[30d])
```

#### 数据聚合逻辑

| 维度 | 聚合方式 | 说明 |
|------|---------|------|
| 团队 | AVG/MEDIAN | 计算团队平均恢复时间 |
| 严重程度 | AVG by severity | 按 P0/P1/P2/P3 分组 |
| 时间 | AVG over period | 按日/周计算趋势 |
| 产品线 | AVG by product | 按产品线统计 |

#### 异常值处理

```sql
-- 排除未解决的故障和异常时长
SELECT 
    team_id,
    AVG(mttr_hours) AS avg_mttr
FROM (
    SELECT 
        team_id,
        EXTRACT(EPOCH FROM (resolved_at - detected_at)) / 3600 AS mttr_hours
    FROM incidents
    WHERE status = 'resolved'
      AND resolved_at > detected_at  -- 排除负值
      AND EXTRACT(EPOCH FROM (resolved_at - detected_at)) / 3600 <= 168  -- 排除超过 7 天的
) valid_mttr
GROUP BY team_id;

-- 排除因外部依赖导致的长时间故障
SELECT 
    team_id,
    AVG(mttr_hours) AS adjusted_mttr
FROM (
    SELECT 
        team_id,
        EXTRACT(EPOCH FROM (resolved_at - detected_at)) / 3600 AS mttr_hours
    FROM incidents
    WHERE status = 'resolved'
      AND root_cause_category != 'external_dependency'  -- 排除外部依赖
) adjusted_mttr
GROUP BY team_id;
```

---

### 2.4 变更失败率 (Change Failure Rate)

**定义**：部署失败次数占总部署次数的百分比。

#### SQL 查询示例

```sql
-- 计算变更失败率
SELECT 
    team_id,
    COUNT(*) FILTER (WHERE status IN ('failed', 'rollback')) * 100.0 / COUNT(*) AS failure_rate_percent,
    COUNT(*) AS total_deployments,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
    COUNT(*) FILTER (WHERE status = 'rollback') AS rollback_count
FROM deployments
WHERE completed_at >= NOW() - INTERVAL '30 days'
GROUP BY team_id;

-- 按时间趋势统计失败率
SELECT 
    team_id,
    DATE(completed_at) AS date,
    COUNT(*) FILTER (WHERE status IN ('failed', 'rollback')) * 100.0 / COUNT(*) AS failure_rate_percent
FROM deployments
WHERE completed_at >= NOW() - INTERVAL '30 days'
GROUP BY team_id, DATE(completed_at)
ORDER BY team_id, date;

-- 按部署类型统计（区分正常部署和热修复）
SELECT 
    team_id,
    deploy_type,  -- normal/hotfix
    COUNT(*) FILTER (WHERE status IN ('failed', 'rollback')) * 100.0 / COUNT(*) AS failure_rate_percent
FROM deployments
WHERE completed_at >= NOW() - INTERVAL '30 days'
GROUP BY team_id, deploy_type;
```

#### PromQL 查询示例

```promql
# 部署失败率
(sum(rate(deployments_total{status="failed"}[7d])) + sum(rate(deployments_total{status="rollback"}[7d]))) 
/ sum(rate(deployments_total[7d])) * 100

# 按团队分组
(sum by (team) (rate(deployments_total{status=~"failed|rollback"}[7d]))) 
/ (sum by (team) (rate(deployments_total[7d]))) * 100

# 滚动失败率（24 小时窗口）
sum(rate(deployments_total{status=~"failed|rollback"}[24h])) 
/ sum(rate(deployments_total[24h])) * 100
```

#### 数据聚合逻辑

| 维度 | 聚合方式 | 说明 |
|------|---------|------|
| 团队 | COUNT ratio | 计算团队失败率 |
| 时间 | COUNT ratio per period | 按日/周计算趋势 |
| 部署类型 | COUNT ratio by type | 区分正常/热修复 |
| 回滚单独统计 | COUNT where rollback | 单独统计回滚率 |

#### 异常值处理

```sql
-- 排除计划内的回滚（预定的灰度回滚）
SELECT 
    team_id,
    COUNT(*) FILTER (WHERE status = 'failed') * 100.0 / 
        COUNT(*) FILTER (WHERE status IN ('success', 'failed')) AS adjusted_failure_rate
FROM deployments
WHERE completed_at >= NOW() - INTERVAL '30 days'
  AND (status != 'rollback' OR is_planned_rollback = false);

-- 排除测试环境的部署
SELECT 
    team_id,
    COUNT(*) FILTER (WHERE status IN ('failed', 'rollback')) * 100.0 / COUNT(*) AS failure_rate
FROM deployments
WHERE completed_at >= NOW() - INTERVAL '30 days'
  AND environment IN ('prod', 'staging');  -- 仅统计生产/预发
```

---

## 3. 效能评分模型

### 3.1 评分算法

基于 DORA 四大指标计算团队效能评分（0-100 分）。

#### 评分公式

```
效能评分 = w1 × DF 得分 + w2 × LT 得分 + w3 × MTTR 得分 + w4 × CFR 得分

权重配置（可调整）:
- w1 (DF) = 0.25  -- 部署频率权重
- w2 (LT) = 0.30  -- 变更前置时间权重
- w3 (MTTR) = 0.25 -- 服务恢复时间权重
- w4 (CFR) = 0.20  -- 变更失败率权重
```

#### 各指标得分计算

| 指标 | Elite 阈值 | High 阈值 | Medium 阈值 | 得分计算 |
|------|-----------|----------|------------|---------|
| DF (次/天) | ≥ 3 | ≥ 1 | ≥ 0.3 | min(实际值/3, 1) × 100 |
| LT (小时) | ≤ 1 | ≤ 24 | ≤ 168 | max(0, (168-实际值)/167) × 100 |
| MTTR (小时) | ≤ 1 | ≤ 24 | ≤ 168 | max(0, (168-实际值)/167) × 100 |
| CFR (%) | ≤ 5% | ≤ 15% | ≤ 30% | max(0, (30-实际值)/25) × 100 |

### 3.2 Python 实现代码

```python
#!/usr/bin/env python3
"""
DORA 效能评分计算模块
"""

from dataclasses import dataclass
from typing import Optional
from enum import Enum


class PerformanceLevel(Enum):
    """效能等级"""
    ELITE = "Elite"       # 90-100
    HIGH = "High"         # 75-89
    MEDIUM = "Medium"     # 50-74
    LOW = "Low"           # < 50


@dataclass
class DORAMetrics:
    """DORA 四大指标"""
    deployment_frequency: float  # 次/天
    lead_time_hours: float       # 小时
    mttr_hours: float            # 小时
    change_failure_rate: float   # 百分比 (0-100)


@dataclass
class ScoreResult:
    """评分结果"""
    df_score: float
    lt_score: float
    mttr_score: float
    cfr_score: float
    total_score: float
    level: PerformanceLevel
    team_id: str
    period: str


class EfficiencyScorer:
    """效能评分器"""
    
    # 权重配置
    WEIGHTS = {
        'df': 0.25,
        'lt': 0.30,
        'mttr': 0.25,
        'cfr': 0.20,
    }
    
    # Elite 阈值（DORA 标准）
    ELITE_THRESHOLDS = {
        'df': 3.0,        # 每天 3 次部署
        'lt': 1.0,        # 1 小时
        'mttr': 1.0,      # 1 小时
        'cfr': 5.0,       # 5%
    }
    
    # 行业基准阈值
    BENCHMARK_THRESHOLDS = {
        'df': {'elite': 3.0, 'high': 1.0, 'medium': 0.3},
        'lt': {'elite': 1.0, 'high': 24.0, 'medium': 168.0},  # 小时
        'mttr': {'elite': 1.0, 'high': 24.0, 'medium': 168.0},  # 小时
        'cfr': {'elite': 5.0, 'high': 15.0, 'medium': 30.0},   # 百分比
    }
    
    def calculate_df_score(self, df: float) -> float:
        """
        计算部署频率得分
        DF >= 3 次/天 得满分
        """
        if df <= 0:
            return 0.0
        # 对数评分，鼓励高频部署但避免无限增长
        import math
        score = min(math.log(df + 1, 4) * 100, 100)
        return round(score, 2)
    
    def calculate_lt_score(self, lt_hours: float) -> float:
        """
        计算变更前置时间得分
        LT <= 1 小时 得满分，> 168 小时 (1 周) 得 0 分
        """
        if lt_hours <= 0:
            return 100.0
        if lt_hours >= 168:
            return 0.0
        # 线性评分
        score = max(0, (168 - lt_hours) / 167 * 100)
        return round(score, 2)
    
    def calculate_mttr_score(self, mttr_hours: float) -> float:
        """
        计算服务恢复时间得分
        MTTR <= 1 小时 得满分，> 168 小时 得 0 分
        """
        if mttr_hours <= 0:
            return 100.0
        if mttr_hours >= 168:
            return 0.0
        # 线性评分
        score = max(0, (168 - mttr_hours) / 167 * 100)
        return round(score, 2)
    
    def calculate_cfr_score(self, cfr_percent: float) -> float:
        """
        计算变更失败率得分
        CFR <= 5% 得满分，>= 30% 得 0 分
        """
        if cfr_percent <= 0:
            return 100.0
        if cfr_percent >= 30:
            return 0.0
        # 线性评分，失败率越低得分越高
        score = max(0, (30 - cfr_percent) / 25 * 100)
        return round(score, 2)
    
    def calculate_level(self, total_score: float) -> PerformanceLevel:
        """根据总分确定效能等级"""
        if total_score >= 90:
            return PerformanceLevel.ELITE
        elif total_score >= 75:
            return PerformanceLevel.HIGH
        elif total_score >= 50:
            return PerformanceLevel.MEDIUM
        else:
            return PerformanceLevel.LOW
    
    def calculate(self, metrics: DORAMetrics, team_id: str, period: str) -> ScoreResult:
        """
        计算效能评分
        
        Args:
            metrics: DORA 指标数据
            team_id: 团队 ID
            period: 统计周期
            
        Returns:
            ScoreResult: 评分结果
        """
        # 计算各指标得分
        df_score = self.calculate_df_score(metrics.deployment_frequency)
        lt_score = self.calculate_lt_score(metrics.lead_time_hours)
        mttr_score = self.calculate_mttr_score(metrics.mttr_hours)
        cfr_score = self.calculate_cfr_score(metrics.change_failure_rate)
        
        # 计算加权总分
        total_score = (
            df_score * self.WEIGHTS['df'] +
            lt_score * self.WEIGHTS['lt'] +
            mttr_score * self.WEIGHTS['mttr'] +
            cfr_score * self.WEIGHTS['cfr']
        )
        
        # 确定等级
        level = self.calculate_level(total_score)
        
        return ScoreResult(
            df_score=df_score,
            lt_score=lt_score,
            mttr_score=mttr_score,
            cfr_score=cfr_score,
            total_score=round(total_score, 2),
            level=level,
            team_id=team_id,
            period=period,
        )


# 使用示例
if __name__ == "__main__":
    scorer = EfficiencyScorer()
    
    # 示例数据：某团队最近 30 天的 DORA 指标
    metrics = DORAMetrics(
        deployment_frequency=2.5,      # 每天 2.5 次部署
        lead_time_hours=4.0,           # 平均 4 小时
        mttr_hours=2.0,                # 平均 2 小时恢复
        change_failure_rate=8.0,       # 8% 失败率
    )
    
    result = scorer.calculate(metrics, team_id="team-alpha", period="2026-03")
    
    print(f"团队：{result.team_id}")
    print(f"周期：{result.period}")
    print(f"效能等级：{result.level.value}")
    print(f"总分：{result.total_score}")
    print(f"  - DF 得分：{result.df_score}")
    print(f"  - LT 得分：{result.lt_score}")
    print(f"  - MTTR 得分：{result.mttr_score}")
    print(f"  - CFR 得分：{result.cfr_score}")
```

### 3.3 等级划分标准

| 等级 | 分数范围 | 特征描述 |
|------|---------|---------|
| **Elite** | 90-100 | 按需部署，小时级交付，快速恢复，极低失败率 |
| **High** | 75-89 | 日级部署，天级交付，快速响应，低失败率 |
| **Medium** | 50-74 | 周级部署，周级交付，可接受恢复时间 |
| **Low** | < 50 | 部署频率低，交付周期长，需要改进 |

---

## 4. AI 改进建议生成

### 4.1 建议生成规则引擎

```python
#!/usr/bin/env python3
"""
AI 改进建议生成模块
"""

from dataclasses import dataclass
from typing import List


@dataclass
class ImprovementSuggestion:
    """改进建议"""
    category: str           # 建议类别
    priority: str           # high/medium/low
    title: str              # 建议标题
    description: str        # 详细描述
    expected_impact: str    # 预期影响
    implementation_steps: List[str]  # 实施步骤


class SuggestionGenerator:
    """建议生成器"""
    
    def generate(self, score_result) -> List[ImprovementSuggestion]:
        """根据评分结果生成改进建议"""
        suggestions = []
        
        # 检查各指标短板
        if score_result.df_score < 75:
            suggestions.extend(self._df_suggestions(score_result.df_score))
        if score_result.lt_score < 75:
            suggestions.extend(self._lt_suggestions(score_result.lt_score))
        if score_result.mttr_score < 75:
            suggestions.extend(self._mttr_suggestions(score_result.mttr_score))
        if score_result.cfr_score < 75:
            suggestions.extend(self._cfr_suggestions(score_result.cfr_score))
        
        # 按优先级排序
        priority_order = {'high': 0, 'medium': 1, 'low': 2}
        suggestions.sort(key=lambda s: priority_order[s.priority])
        
        return suggestions
    
    def _df_suggestions(self, score: float) -> List[ImprovementSuggestion]:
        """部署频率低的改进建议"""
        priority = 'high' if score < 50 else 'medium'
        return [
            ImprovementSuggestion(
                category="CI/CD 优化",
                priority=priority,
                title="优化 CI 流水线",
                description="当前部署频率较低，建议优化 CI 流水线以加快构建和部署速度。",
                expected_impact="可将部署时间缩短 30-50%，提升部署频率",
                implementation_steps=[
                    "分析当前流水线瓶颈（构建、测试、部署各阶段耗时）",
                    "实施增量构建，避免全量编译",
                    "并行化测试执行",
                    "使用构建缓存（Docker layer cache, Maven/Gradle cache）",
                    "考虑使用更快的构建工具或语言（如 Rust 替代部分脚本）",
                ],
            ),
            ImprovementSuggestion(
                category="自动化",
                priority=priority,
                title="增加自动化测试覆盖",
                description="完善的自动化测试可以减少人工干预，提高部署信心。",
                expected_impact="减少人工验证时间，提升部署频率",
                implementation_steps=[
                    "梳理当前手动测试场景",
                    "优先自动化回归测试用例",
                    "集成测试到 CI 流水线",
                    "建立测试覆盖率门禁（建议>80%）",
                ],
            ),
            ImprovementSuggestion(
                category="流程优化",
                priority="medium",
                title="实施小批量频繁发布",
                description="将大版本拆分为小批次，降低单次部署风险，提高发布频率。",
                expected_impact="降低部署风险，提升团队发布信心",
                implementation_steps=[
                    "建立特性开关（Feature Flag）机制",
                    "按功能模块拆分发布计划",
                    "建立每日/每周固定发布窗口",
                    "培训团队小批量发布意识",
                ],
            ),
        ]
    
    def _lt_suggestions(self, score: float) -> List[ImprovementSuggestion]:
        """变更前置时间长的改进建议"""
        priority = 'high' if score < 50 else 'medium'
        return [
            ImprovementSuggestion(
                category="代码审查",
                priority=priority,
                title="优化 Code Review 流程",
                description="变更前置时间长通常与 Code Review 周期长相关。",
                expected_impact="可将 PR 合并时间缩短 40-60%",
                implementation_steps=[
                    "设定 SLA：PR 应在 24 小时内完成审查",
                    "实施小 PR 策略（建议<400 行）",
                    "建立自动化审查（lint、格式化检查）",
                    "指定备份审查人避免单点阻塞",
                    "使用 PR 模板明确审查要点",
                ],
            ),
            ImprovementSuggestion(
                category="流程优化",
                priority=priority,
                title="减小 PR 粒度",
                description="大 PR 难以审查且易被阻塞，建议按功能拆分。",
                expected_impact="加速审查流程，减少返工",
                implementation_steps=[
                    "按功能/模块拆分 PR",
                    "单个 PR 不超过 400 行代码变更",
                    "相关重构单独提交",
                    "使用 PR 依赖链管理大功能",
                ],
            ),
            ImprovementSuggestion(
                category="自动化",
                priority="medium",
                title="自动化合并流程",
                description="对于低风险变更，可配置自动合并。",
                expected_impact="减少等待时间，提升开发效率",
                implementation_steps=[
                    "配置 Renovate/Dependabot 自动更新依赖",
                    "对文档变更开启自动合并",
                    "对测试覆盖率提升的 PR 开启自动合并",
                    "建立可信贡献者自动合并机制",
                ],
            ),
        ]
    
    def _mttr_suggestions(self, score: float) -> List[ImprovementSuggestion]:
        """MTTR 长的改进建议"""
        priority = 'high' if score < 50 else 'medium'
        return [
            ImprovementSuggestion(
                category="监控告警",
                priority=priority,
                title="完善监控告警体系",
                description="快速的故障发现是缩短 MTTR 的第一步。",
                expected_impact="故障发现时间可缩短 50% 以上",
                implementation_steps=[
                    "建立四层监控：基础设施、应用、业务、用户体验",
                    "配置合理的告警阈值（避免告警疲劳）",
                    "实施告警分级（P0/P1/P2/P3）",
                    "建立告警路由和升级机制",
                    "定期审查和优化告警规则",
                ],
            ),
            ImprovementSuggestion(
                category="应急响应",
                priority=priority,
                title="建立 On-Call 机制",
                description="明确的值班制度确保故障及时响应。",
                expected_impact="确保 7x24 小时故障响应能力",
                implementation_steps=[
                    "建立轮值表（建议每周轮换）",
                    "明确 On-Call 响应 SLA（如 15 分钟内响应）",
                    "提供 On-Call 津贴或调休",
                    "建立交接班流程",
                    "定期进行故障演练",
                ],
            ),
            ImprovementSuggestion(
                category="工具建设",
                priority="medium",
                title="建设故障诊断工具",
                description="完善的诊断工具可加速问题定位。",
                expected_impact="问题定位时间缩短 30-50%",
                implementation_steps=[
                    "统一日志收集和分析平台",
                    "建设分布式追踪系统",
                    "建立标准 runbook/playbook",
                    "开发一键诊断脚本",
                    "建立故障知识库",
                ],
            ),
            ImprovementSuggestion(
                category="流程优化",
                priority="medium",
                title="建立快速回滚机制",
                description="当无法快速修复时，快速回滚是最有效的恢复手段。",
                expected_impact="严重故障恢复时间<5 分钟",
                implementation_steps=[
                    "保持生产环境始终可回滚",
                    "自动化回滚流程",
                    "定期演练回滚流程",
                    "建立回滚决策树（何时修复 vs 何时回滚）",
                ],
            ),
        ]
    
    def _cfr_suggestions(self, score: float) -> List[ImprovementSuggestion]:
        """变更失败率高的改进建议"""
        priority = 'high' if score < 50 else 'medium'
        return [
            ImprovementSuggestion(
                category="测试质量",
                priority=priority,
                title="加强测试覆盖",
                description="高失败率通常意味着测试覆盖不足。",
                expected_impact="可将部署失败率降低 50% 以上",
                implementation_steps=[
                    "分析历史失败原因，针对性补充测试",
                    "提高单元测试覆盖率（目标>80%）",
                    "加强集成测试覆盖核心链路",
                    "实施契约测试保证服务兼容性",
                    "建立测试门禁，禁止低覆盖率合并",
                ],
            ),
            ImprovementSuggestion(
                category="发布策略",
                priority=priority,
                title="实施灰度发布",
                description="灰度发布可将故障影响范围降至最低。",
                expected_impact="故障影响用户减少 90%+",
                implementation_steps=[
                    "建立金丝雀发布能力",
                    "配置流量比例控制（1% -> 5% -> 20% -> 100%）",
                    "实施自动化健康检查",
                    "配置自动回滚触发条件",
                    "建立发布观察期（建议 30 分钟）",
                ],
            ),
            ImprovementSuggestion(
                category="流程优化",
                priority="medium",
                title="加强上线前检查",
                description="完善的检查清单可减少人为失误。",
                expected_impact="减少人为操作失误导致的失败",
                implementation_steps=[
                    "建立上线检查清单（Checklist）",
                    "实施双人确认机制",
                    "自动化检查项集成到流水线",
                    "建立上线审批流程（针对重大变更）",
                ],
            ),
            ImprovementSuggestion(
                category="文化建设",
                priority="low",
                title="建立无责复盘文化",
                description="鼓励从失败中学习，而非追责。",
                expected_impact="提升团队透明度，加速问题解决",
                implementation_steps=[
                    "每次故障后进行复盘（Post-mortem）",
                    "关注系统性原因而非个人责任",
                    "记录并跟踪改进行动项",
                    "定期分享复盘学习",
                ],
            ),
        ]
```

### 4.2 建议优先级判定

| 指标得分 | 优先级 | 建议数量 |
|---------|--------|---------|
| < 50 | high | 3-4 条核心建议 |
| 50-74 | medium | 2-3 条改进建议 |
| 75-89 | low | 1-2 条优化建议 |
| 90+ | - | 保持最佳实践 |

---

## 5. 效能看板设计

### 5.1 看板整体布局

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Orion 研发效能看板                      [刷新] [导出] │
├─────────────────────────────────────────────────────────────────────────────┤
│  时间范围：[最近 7 天 ▼]  团队：[全部 ▼]  产品线：[全部 ▼]                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │ 部署频率    │  │ 变更前置时间│  │ 服务恢复时间│  │ 变更失败率  │       │
│  │ 2.5 次/天   │  │ 4.2 小时    │  │ 1.8 小时    │  │ 6.3%        │       │
│  │ ↑ +12%      │  │ ↓ -8%       │  │ ↓ -15%      │  │ ↓ -2%       │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  团队效能评分趋势                                                    │   │
│  │                                                                      │   │
│  │  100 ┤                       ● Elite                                │   │
│  │      │                    ●──────●                                  │   │
│  │   75 ┤              ●────●          ●────● High                     │   │
│  │      │         ●────●                    ●────●                     │   │
│  │   50 ┤    ●────●                              ●────● Medium         │   │
│  │      │────●                                        ●────●           │   │
│  │   25 ┤                                                  ●────● Low  │   │
│  │      │                                                         ●     │   │
│  │    0 ┼────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬──    │   │
│  │     W1   W2   W3   W4   W5   W6   W7   W8   W9   W10  W11  W12       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────┐   │
│  │  团队对比雷达图               │  │  改进建议                        │   │
│  │                               │  │                                  │   │
│  │         DF                    │  │  🔴 [高] 完善监控告警体系        │   │
│  │       ╱   ╲                   │  │     故障发现时间可缩短 50% 以上    │   │
│  │     ╱       ╲                 │  │     → 查看详情                   │   │
│  │   ╱    TeamA  ╲  TeamB        │  │                                  │   │
│  │  │     ●      │               │  │  🟡 [中] 优化 CI 流水线            │   │
│  │   ╲  TeamC  ╱                 │  │     部署时间可缩短 30-50%         │   │
│  │     ╲       ╱                 │  │     → 查看详情                   │   │
│  │       ╲   ╱                   │  │                                  │   │
│  │         CFR                   │  │  🟢 [低] 实施小批量频繁发布       │   │
│  │                               │  │     降低部署风险                  │   │
│  │   [切换团队▼]                 │  │     → 查看详情                   │   │
│  └──────────────────────────────┘  └──────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  团队效能排名（点击查看详情）                                        │   │
│  │  ┌────┬────────────┬───────┬────────┬────────┬────────┬───────┐    │   │
│  │  │排名│ 团队       │ 总分  │ 等级   │   DF   │   LT   │ MTTR  │    │   │
│  │  ├────┼────────────┼───────┼────────┼────────┼────────┼───────┤    │   │
│  │  │ 1  │ 支付团队   │ 92.5  │ Elite  │ 95     │ 88     │ 90    │    │   │
│  │  │ 2  │ 用户团队   │ 85.3  │ High   │ 82     │ 90     │ 85    │    │   │
│  │  │ 3  │ 订单团队   │ 72.1  │ Medium │ 70     │ 68     │ 78    │    │   │
│  │  │ 4  │ 商品团队   │ 58.4  │ Medium │ 55     │ 60     │ 52    │    │   │
│  │  │ 5  │ 物流团队   │ 42.8  │ Low    │ 40     │ 45     │ 38    │    │   │
│  │  └────┴────────────┴───────┴────────┴────────┴────────┴───────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 指标详情钻取页面

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  < 返回总览                      部署频率详情              [导出 CSV]       │
├─────────────────────────────────────────────────────────────────────────────┤
│  团队：支付团队  │  时间：最近 30 天  │  环境：生产环境                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  每日部署趋势                                                        │   │
│  │                                                                      │   │
│  │   8 ┤                    ●                                           │   │
│  │   6 ┤           ●      ●   ●      ●                                  │   │
│  │   4 ┤      ●  ●   ●  ●    ●   ●  ●   ●  ●                           │   │
│  │   2 ┤   ●  ●   ●  ●    ●       ●  ●   ●   ●  ●  ●                   │   │
│  │   0 ┼───┬──┬───┬──┬────┬───┬──┬───┬──┬───┬──┬───┬──┬───             │   │
│  │      1  2  3  4  5  6  7  8  9  10 11 12 13 14 ...                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────┐   │
│  │  部署时段分布                 │  │  部署耗时分布                     │   │
│  │                               │  │                                   │   │
│  │  00-04  │███░░░░  3          │  │  <5min  │████████░░░░  45%        │   │
│  │  04-08  │░░░░░░░░  0          │  │  5-10m  │████░░░░░░░░  25%        │   │
│  │  08-12  │████████░░  8          │  │  10-20m │██░░░░░░░░░░  15%        │   │
│  │  12-16  │██████░░░░  6          │  │  20-30m │█░░░░░░░░░░░   8%        │   │
│  │  16-20  │████░░░░░░  4          │  │  >30min │█░░░░░░░░░░░   7%        │   │
│  │  20-24  │███░░░░░░  3          │  │                                   │   │
│  └──────────────────────────────┘  └──────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  部署记录明细                                                        │   │
│  │  ┌─────────────────────┬────────┬──────────┬────────┬────────────┐  │   │
│  │  │ 时间                │ 版本   │ 耗时     │ 状态   │ 操作人     │  │   │
│  │  ├─────────────────────┼────────┼──────────┼────────┼────────────┤  │   │
│  │  │ 2026-04-10 14:32   │ v2.3.1 │ 4m 12s   │ ✅     │ 张三       │  │   │
│  │  │ 2026-04-10 11:15   │ v2.3.0 │ 5m 08s   │ ✅     │ 李四       │  │   │
│  │  │ 2026-04-09 16:45   │ v2.2.9 │ 28m 33s  │ ❌     │ 王五       │  │   │
│  │  │ 2026-04-09 15:22   │ v2.2.8 │ 4m 45s   │ ✅     │ 王五       │  │   │
│  │  │ ...                 │ ...    │ ...      │ ...    │ ...        │  │   │
│  │  └─────────────────────┴────────┴──────────┴────────┴────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 组件设计

| 组件 | 技术选型 | 说明 |
|------|---------|------|
| 图表库 | Apache ECharts | 支持折线图、柱状图、雷达图 |
| 前端框架 | React + TypeScript | 组件化开发 |
| 状态管理 | Zustand | 轻量级状态管理 |
| 数据请求 | TanStack Query | 缓存和重试机制 |
| UI 组件 | Ant Design | 企业级 UI 组件库 |

### 5.4 API 设计

```typescript
// 效能数据 API
GET /api/v1/efficiency/metrics
  Query: { teamId?, productId?, startDate, endDate, granularity }
  Response: {
    metrics: {
      deploymentFrequency: number,
      leadTimeHours: number,
      mttrHours: number,
      changeFailureRate: number,
    },
    trend: Array<{ date: string; metrics: ... }>,
  }

// 效能评分 API
GET /api/v1/efficiency/score
  Query: { teamId?, period? }
  Response: {
    scores: Array<{
      teamId: string,
      teamName: string,
      totalScore: number,
      level: 'ELITE' | 'HIGH' | 'MEDIUM' | 'LOW',
      breakdown: { df: number; lt: number; mttr: number; cfr: number },
    }>,
  }

// 改进建议 API
GET /api/v1/efficiency/suggestions/:teamId
  Response: {
    suggestions: Array<{
      id: string,
      category: string,
      priority: 'high' | 'medium' | 'low',
      title: string,
      description: string,
      expectedImpact: string,
      implementationSteps: string[],
    }>,
  }
```

---

## 6. 实施计划

### 6.1 阶段划分

| 阶段 | 内容 | 工期 |
|------|------|------|
| Phase 1 | 数据采集层：埋点、ETL、数据仓库 | 2 周 |
| Phase 2 | 计算引擎：SQL/PromQL 查询、缓存 | 1 周 |
| Phase 3 | 评分服务：Python 评分模块、API | 1 周 |
| Phase 4 | 看板前端：React 组件、图表 | 2 周 |
| Phase 5 | AI 建议：规则引擎、集成 | 1 周 |

### 6.2 关键依赖

- GitLab API / GitHub API（commit/PR 数据）
- Jenkins / GitLab CI（部署数据）
- Prometheus / Grafana（监控数据）
- 故障管理系统（故障数据）

---

## 7. 新手引导与术语解释

### 7.1 术语解释 Tooltip 设计

为降低用户理解门槛，所有 DORA 术语在界面中均需配备 info tooltip，鼠标悬停或点击时显示：

| 指标 | 简称 | 完整名称 | 通俗解释 | Tooltip 文案 |
|------|------|---------|---------|-------------|
| 部署频率 | DF | Deployment Frequency | 团队多久部署一次 | **部署频率 (DF)**：你的团队平均每周部署 X 次。频率越高，说明交付能力越强。Elite 团队通常按需部署（每天多次）。 |
| 变更前置时间 | LT | Lead Time for Changes | 代码从提交到上线需要多久 | **变更前置时间 (LT)**：从代码提交 (commit) 到成功部署到生产环境的平均时长。越短说明交付流程越高效。Elite 团队通常 < 1 小时。 |
| 服务恢复时间 | MTTR | Mean Time To Recovery | 出故障后多久能恢复 | **服务恢复时间 (MTTR)**：生产故障从发生到恢复服务的平均时长。越短说明应急响应能力越强。Elite 团队通常 < 5 分钟。 |
| 变更失败率 | CFR | Change Failure Rate | 多少比例的部署会失败 | **变更失败率 (CFR)**：部署失败或需要回滚的次数占总部署次数的百分比。越低说明发布质量越稳定。Elite 团队通常 < 5%。 |

**Tooltip 交互设计**：
- 触发方式：鼠标悬停 0.3s 或点击 (移动端)
- 展示形式：气泡卡片，深色背景，白色文字
- 关闭方式：鼠标移出或点击外部
- 位置：指标名称右侧的 ⓘ 图标

---

### 7.2 新手引导弹窗设计

**触发条件**：用户首次访问效能看板时自动弹出（本地存储标记 `hasSeenEfficiencyOnboarding`）

**弹窗内容**：

```
┌─────────────────────────────────────────────────────────────┐
│ 欢迎使用效能看板！👋                                   [×]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DORA 指标是业界标准的研发效能度量指标，帮助你了解团队      │
│  的交付速度、质量和稳定性。                                 │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📦 部署频率 (DF)                                    │   │
│  │  你的团队平均每周部署 12 次                          │   │
│  │  行业 Elite 水平：按需部署（每天多次）               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ⏱️ 变更前置时间 (LT)                                │   │
│  │  你的团队平均 2.5 小时                               │   │
│  │  行业 Elite 水平：< 1 小时                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  了解更多指标含义，随时点击指标旁的 ⓘ 图标。               │
│                                                             │
│                    [跳过]        [下一步：查看等级说明]     │
└─────────────────────────────────────────────────────────────┘
```

**引导分步设计**（可选）：

| 步骤 | 内容 | 操作 |
|------|------|------|
| 1 | 欢迎语 + DORA 简介 | [跳过] [下一步] |
| 2 | 当前团队指标速览（动态数据） | [上一步] [下一步] |
| 3 | 效能等级说明 | [上一步] [完成] |
| 4 | 如何使用帮助中心 | [上一步] [完成] |

**本地存储逻辑**：
```javascript
// 首次访问检查
if (!localStorage.getItem('hasSeenEfficiencyOnboarding')) {
  showOnboardingModal();
}

// 用户关闭引导后标记
localStorage.setItem('hasSeenEfficiencyOnboarding', 'true');

// 提供重新查看入口：帮助中心 > 新手引导
```

---

### 7.3 效能等级说明卡片

在效能评分旁常驻展示等级说明，或在新手引导第 3 步展示：

```
┌─────────────────────────────────────────────────────────────┐
│  效能等级说明                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🏆 Elite (90-100 分)                                       │
│  ─────────────────────────────────────────────────────────  │
│  • 部署频率：按需部署（每天多次）                           │
│  • 变更前置时间：< 1 小时                                   │
│  • 服务恢复时间：< 5 分钟                                   │
│  • 变更失败率：< 5%                                         │
│                                                             │
│  📈 High (75-89 分)                                         │
│  ─────────────────────────────────────────────────────────  │
│  • 部署频率：每周部署                                       │
│  • 变更前置时间：< 1 天                                     │
│  • 服务恢复时间：< 1 小时                                   │
│  • 变更失败率：< 15%                                        │
│                                                             │
│  📊 Medium (50-74 分)                                       │
│  ─────────────────────────────────────────────────────────  │
│  • 部署频率：每月部署                                       │
│  • 变更前置时间：< 1 周                                     │
│  • 服务恢复时间：< 1 天                                     │
│  • 变更失败率：< 30%                                        │
│                                                             │
│  📉 Low (< 50 分)                                           │
│  ─────────────────────────────────────────────────────────  │
│  • 需要改进                                                 │
│  • 建议查看详细改进建议                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**等级说明交互**：
- 入口：看板右上角「效能等级说明」链接
- 展示形式：侧边抽屉或模态框
- 动态高亮：根据当前团队等级，高亮对应等级卡片

---

### 7.4 帮助中心设计

在看板右上角常驻「如何使用」入口（图标：❓），点击展开帮助中心：

```
┌─────────────────────────────────────────────────────────────┐
│  帮助中心                                               [×] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📖 指标计算说明                                            │
│  ─────────────────────────────────────────────────────────  │
│  • 数据来源：GitLab（提交/PR）、Jenkins（部署记录）、       │
│    Prometheus（监控指标）、故障管理系统                     │
│  • 统计周期：默认最近 30 天，可切换 7 天/90 天/自定义          │
│  • 环境过滤：仅统计生产环境部署（可切换包含预发）           │
│                                                             │
│  🔍 常见问题                                                │
│  ─────────────────────────────────────────────────────────  │
│  Q: 为什么我的部署频率是 0？                                │
│  A: 请确认团队已配置 GitLab 项目关联，且最近 30 天有成功部署  │
│                                                             │
│  Q: 变更前置时间为什么这么长？                              │
│  A: 可能与 Code Review 周期长、审批流程复杂有关，建议查看    │
│     改进建议中的流程优化项                                  │
│                                                             │
│  Q: 数据多久更新一次？                                      │
│  A: 实时指标每分钟更新，汇总指标每小时聚合                  │
│                                                             │
│  Q: 如何提升团队效能评分？                                  │
│  A: 查看「改进建议」模块，优先实施高优先级建议              │
│                                                             │
│  📞 联系支持                                                │
│  ─────────────────────────────────────────────────────────  │
│  如有问题，请联系：devops-support@example.com              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**帮助中心导航结构**：

| 一级菜单 | 二级内容 |
|---------|---------|
| 指标计算说明 | 数据来源、统计口径、更新时间 |
| 效能评分模型 | 评分公式、权重说明、等级划分 |
| 新手引导 | 重新播放新手引导 |
| 常见问题 | FAQ 列表（可搜索） |
| 联系支持 | 邮箱、工单系统入口 |

---

### 7.5 实施建议

**前端组件优先级**：

| 组件 | 优先级 | 工期估算 |
|------|--------|---------|
| Tooltip | P0 | 0.5 天 |
| 新手引导弹窗 | P0 | 1 天 |
| 等级说明卡片 | P1 | 0.5 天 |
| 帮助中心 | P1 | 1 天 |

**文案管理建议**：
- 所有 Tooltip 文案和帮助中心内容应抽取为独立的文案配置文件（如 `i18n/zh-CN/efficiency.json`）
- 便于后续多语言扩展和文案迭代

**可访问性考虑**：
- Tooltip 需支持键盘 Tab 聚焦触发
- 新手引导弹窗需支持 ESC 关闭
- 所有交互元素需有 ARIA 标签

---

## 附录

### A. 指标口径说明

- **部署**：指成功部署到生产环境的变更，包含正常发布和热修复
- **失败**：包含部署失败和服务回滚
- **故障**：指 P0-P3 级别的生产事件

### B. 数据更新频率

- 实时指标：每分钟更新
- 汇总指标：每小时聚合
- 历史趋势：每日归档
